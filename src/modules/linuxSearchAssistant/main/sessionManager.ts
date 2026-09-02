/**
 * SessionManager — owns active SSH session handles for Linux Search Assistant.
 *
 * Security contract (see securityRules.ts):
 * - Password: used only in open(); cleared immediately; never stored on handles
 * - Session: keepalive + reuse; destroyed on exit / window close / inactivity
 * - Commands: executePredefined only (allowlisted)
 */
import { BrowserWindow } from 'electron'
import type {
  PredefinedSshCommand,
  SshCommandResult,
  SshServerIdentity,
  SshSessionExpiredEvent,
  SshSessionHandle,
} from '../models/ssh'
import { ensureSshService, getSshService, shutdownSshService } from './sshServiceSingleton'
import { SshServiceError } from './sshService'
import {
  destroyPassword,
  SSH_INACTIVITY_CHECK_INTERVAL_MS,
  SSH_SESSION_INACTIVITY_TIMEOUT_MS,
} from './securityRules'
import { assertPredefinedCommand } from '../services/predefinedCommands'
import { broadcastLinuxSearchConsole } from './consoleBroadcast'

const SESSION_EXPIRED_EVENT = 'linuxSearchAssistant:sessionExpired'

export class SessionManager {
  private readonly handles = new Map<string, SshSessionHandle>()
  private readonly identities = new Map<string, SshServerIdentity>()
  private readonly lastActivityAt = new Map<string, number>()
  private inactivityTimer: ReturnType<typeof setInterval> | null = null
  private wired = false

  /** Ensure underlying SSH transport exists and expiry notifications are wired. */
  ensureReady(): void {
    ensureSshService()
    if (this.wired) return
    this.wired = true
    getSshService().setSessionLostHandler((serverId, identity) => {
      this.handleUnexpectedLoss(serverId, identity)
    })
    this.startInactivityWatch()
  }

  listSessions(): SshSessionHandle[] {
    this.ensureReady()
    this.pruneStale()
    return Array.from(this.handles.values())
  }

  getSession(serverId: string): SshSessionHandle | null {
    this.ensureReady()
    this.pruneStale()
    return this.handles.get(serverId) ?? null
  }

  /**
   * Return an existing live session for the server, or null if none.
   * Never opens a connection and never touches passwords.
   * Reuse does not reset inactivity — only open / command execution do.
   */
  reuse(server: SshServerIdentity | { id: string }): SshSessionHandle | null {
    this.ensureReady()
    this.pruneStale()
    const id = server.id
    const existing = this.handles.get(id)
    if (existing && getSshService().isConnected({ id })) {
      return existing
    }
    this.handles.delete(id)
    this.lastActivityAt.delete(id)
    return null
  }

  /**
   * Authenticate (or reuse) and return a session object only.
   * Password is used once by the transport layer and must not be retained by callers.
   */
  async open(server: SshServerIdentity, password: string): Promise<SshSessionHandle> {
    this.ensureReady()
    const reused = this.reuse(server)
    if (reused) {
      this.touchActivity(reused.serverId)
      return reused
    }

    let ephemeral = password
    try {
      await getSshService().connectWithPassword(server, ephemeral)
    } finally {
      ephemeral = destroyPassword(ephemeral)
    }

    const handle = getSshService().getSessionHandle(server)
    if (!handle) {
      throw new SshServiceError('SSH authentication succeeded but no session handle is available.')
    }

    this.handles.set(handle.serverId, handle)
    this.identities.set(handle.serverId, {
      id: server.id,
      host: server.host,
      port: server.port,
      username: server.username,
      label: server.label,
    })
    this.touchActivity(handle.serverId)
    return handle
  }

  async close(serverId: string): Promise<void> {
    this.ensureReady()
    this.handles.delete(serverId)
    this.identities.delete(serverId)
    this.lastActivityAt.delete(serverId)
    await getSshService().disconnect({ id: serverId })
  }

  /** Close every active session (window close). Service remains available for reconnect. */
  async closeAll(): Promise<void> {
    this.handles.clear()
    this.identities.clear()
    this.lastActivityAt.clear()
    this.ensureReady()
    await getSshService().closeAll()
  }

  /** Tear down every session for application exit. */
  async closeAllAndShutdown(): Promise<void> {
    this.stopInactivityWatch()
    this.handles.clear()
    this.identities.clear()
    this.lastActivityAt.clear()
    this.wired = false
    await shutdownSshService()
  }

  async executePredefined(command: PredefinedSshCommand): Promise<SshCommandResult> {
    this.ensureReady()
    const safeCommand = assertPredefinedCommand(command)
    const session = this.getSession(safeCommand.serverId)
    if (!session) {
      throw new SshServiceError('No active SSH session for this server. Reconnect to continue.')
    }
    this.touchActivity(safeCommand.serverId)
    const result = await getSshService().executePredefined(safeCommand)
    this.touchActivity(safeCommand.serverId)
    return result
  }

  async executePredefinedBatch(commands: PredefinedSshCommand[]): Promise<SshCommandResult[]> {
    this.ensureReady()
    if (!Array.isArray(commands) || commands.length === 0) {
      throw new SshServiceError('At least one command is required.')
    }
    const serverId = commands[0].serverId
    const session = this.getSession(serverId)
    if (!session) {
      throw new SshServiceError('No active SSH session for this server. Reconnect to continue.')
    }
    this.touchActivity(serverId)
    const safe = commands.map((c) => assertPredefinedCommand(c))
    const results = await getSshService().executePredefinedBatch(safe)
    this.touchActivity(serverId)
    return results
  }

  async downloadFile(
    serverId: string,
    remotePath: string,
    localPath: string
  ): Promise<{ serverId: string; remotePath: string; localPath: string; bytes: number }> {
    this.ensureReady()
    const session = this.getSession(serverId)
    if (!session) {
      throw new SshServiceError('No active SSH session for this server. Reconnect to continue.')
    }
    this.touchActivity(serverId)
    const result = await getSshService().downloadFile(serverId, remotePath, localPath)
    this.touchActivity(serverId)
    return result
  }

  private touchActivity(serverId: string): void {
    this.lastActivityAt.set(serverId, Date.now())
  }

  private startInactivityWatch(): void {
    if (this.inactivityTimer) return
    this.inactivityTimer = setInterval(() => {
      void this.enforceInactivityTimeouts()
    }, SSH_INACTIVITY_CHECK_INTERVAL_MS)
    this.inactivityTimer.unref?.()
  }

  private stopInactivityWatch(): void {
    if (!this.inactivityTimer) return
    clearInterval(this.inactivityTimer)
    this.inactivityTimer = null
  }

  private async enforceInactivityTimeouts(): Promise<void> {
    const now = Date.now()
    const expiredIds: string[] = []
    for (const [serverId, at] of this.lastActivityAt) {
      if (now - at >= SSH_SESSION_INACTIVITY_TIMEOUT_MS) {
        expiredIds.push(serverId)
      }
    }
    for (const serverId of expiredIds) {
      await this.expireForInactivity(serverId)
    }
  }

  private async expireForInactivity(serverId: string): Promise<void> {
    const handle = this.handles.get(serverId)
    const identity = this.identities.get(serverId)
    if (!handle && !identity) {
      this.lastActivityAt.delete(serverId)
      return
    }

    const previous =
      handle ??
      ({
        serverId,
        server: identity?.label || identity?.host || serverId,
        host: identity?.host || '',
        port: identity?.port || 22,
        username: identity?.username || '',
        connected: true as const,
      } satisfies SshSessionHandle)

    this.handles.delete(serverId)
    this.lastActivityAt.delete(serverId)

    try {
      await getSshService().disconnect({ id: serverId })
    } catch {
      // Session may already be gone.
    }

    if (identity) {
      broadcastSessionExpired({
        type: 'sessionExpired',
        reason: 'inactivity_timeout',
        session: { ...previous, connected: true },
        reconnect: {
          id: identity.id,
          server: identity.label || identity.host,
          host: identity.host,
          username: identity.username,
          port: identity.port,
        },
      })
    }
  }

  private pruneStale(): void {
    for (const [id] of this.handles) {
      if (!getSshService().isConnected({ id })) {
        this.handles.delete(id)
        this.lastActivityAt.delete(id)
      }
    }
  }

  private handleUnexpectedLoss(serverId: string, identity: SshServerIdentity): void {
    const previous =
      this.handles.get(serverId) ??
      ({
        serverId,
        server: identity.label || identity.host,
        host: identity.host,
        port: identity.port,
        username: identity.username,
        connected: true as const,
      } satisfies SshSessionHandle)

    this.handles.delete(serverId)
    this.lastActivityAt.delete(serverId)
    this.identities.set(serverId, identity)

    const event: SshSessionExpiredEvent = {
      type: 'sessionExpired',
      reason: 'connection_lost',
      session: { ...previous, connected: true },
      reconnect: {
        id: identity.id,
        server: identity.label || identity.host,
        host: identity.host,
        username: identity.username,
        port: identity.port,
      },
    }

    broadcastSessionExpired(event)
  }
}

function broadcastSessionExpired(event: SshSessionExpiredEvent): void {
  const who = `${event.reconnect.username}@${event.reconnect.host}`
  broadcastLinuxSearchConsole(
    'warn',
    event.reason === 'inactivity_timeout'
      ? `SSH session timed out (inactivity): ${who}`
      : `SSH session expired: ${who}`,
    'ssh'
  )
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(SESSION_EXPIRED_EVENT, event)
    }
  }
}

export const SESSION_EXPIRED_IPC_EVENT = SESSION_EXPIRED_EVENT

let manager: SessionManager | null = null

export function getSessionManager(): SessionManager {
  if (!manager) {
    manager = new SessionManager()
  }
  return manager
}

export async function shutdownSessionManager(): Promise<void> {
  if (!manager) {
    await shutdownSshService()
    return
  }
  const current = manager
  manager = null
  await current.closeAllAndShutdown()
}
