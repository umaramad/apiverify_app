import type { SshServerIdentity, SshSessionHandle } from '../models/ssh'
import { SshServiceError } from './sshService'
import { getSessionManager } from './sessionManager'
import { destroyPassword } from './securityRules'
import { getLogger } from '../../../shared/logger'
import { app } from 'electron'
import { resolveDefaultLogFilePath } from '../../../shared/logger/transports/fileTransport'
import { broadcastLinuxSearchConsole } from './consoleBroadcast'

const logger = getLogger().child('linuxSearchAssistant.ssh')

function asServerIdentity(input: unknown): SshServerIdentity {
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const host = typeof raw.host === 'string' ? raw.host.trim() : ''
  const username = typeof raw.username === 'string' ? raw.username.trim() : ''
  const label =
    typeof raw.label === 'string'
      ? raw.label.trim()
      : typeof raw.server === 'string'
        ? raw.server.trim()
        : undefined
  const portRaw = raw.port
  const port = typeof portRaw === 'number' ? portRaw : Number(portRaw ?? 22)
  const id =
    typeof raw.id === 'string' && raw.id.trim()
      ? raw.id.trim()
      : `${username}@${host}:${Number.isFinite(port) ? port : 22}`

  return {
    id,
    host,
    port: Number.isFinite(port) ? port : 22,
    username,
    label: label || undefined,
  }
}

/**
 * Connect via SessionManager using a one-time password from the connection dialog.
 * Returns a session object only — never a password.
 */
export async function connectSshWithPassword(
  serverInput: unknown,
  passwordInput: unknown
): Promise<SshSessionHandle> {
  const server = asServerIdentity(serverInput)
  if (typeof passwordInput !== 'string') {
    throw new SshServiceError('Password is required to connect.')
  }

  logger.info('SSH connect attempt', {
    serverId: server.id,
    host: server.host,
    port: server.port,
    username: server.username,
    // never log password
  })
  broadcastLinuxSearchConsole(
    'info',
    `Connecting via SSH to ${server.username}@${server.host}:${server.port} …`,
    'ssh'
  )

  let password = passwordInput
  try {
    const handle = await getSessionManager().open(server, password)
    logger.info('SSH connect succeeded', {
      serverId: handle.serverId,
      host: handle.host,
      port: handle.port,
      username: handle.username,
    })
    broadcastLinuxSearchConsole(
      'info',
      `SSH connected: ${handle.username}@${handle.host}:${handle.port}`,
      'ssh'
    )
    return handle
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error('SSH connect failed', {
      serverId: server.id,
      host: server.host,
      port: server.port,
      username: server.username,
      message,
      name: error instanceof Error ? error.name : undefined,
    })
    broadcastLinuxSearchConsole('error', `SSH connect failed: ${message}`, 'ssh')
    throw error
  } finally {
    password = destroyPassword(password)
  }
}

export function getSshConnectionStatus(serverInput: unknown): {
  connected: boolean
  session: SshSessionHandle | null
} {
  const server = asServerIdentity(serverInput)
  const session = getSessionManager().reuse(server)
  return {
    connected: Boolean(session),
    session,
  }
}

export function listSshSessions(): SshSessionHandle[] {
  return getSessionManager().listSessions()
}

export async function disconnectSsh(serverInput: unknown): Promise<{ disconnected: true }> {
  const server = asServerIdentity(serverInput)
  await getSessionManager().close(server.id)
  return { disconnected: true }
}

/** Non-secret paths for debugging SSH on deployed machines. */
export function getLinuxSearchAssistantDebugInfo(): {
  logFilePath: string
  userDataPath: string
  platform: string
  arch: string
} {
  return {
    logFilePath: resolveDefaultLogFilePath(),
    userDataPath: app.getPath('userData'),
    platform: process.platform,
    arch: process.arch,
  }
}

export function getLinuxSearchAssistantLogTail(maxLines = 80): {
  logFilePath: string
  lines: string[]
} {
  const fs = require('fs') as typeof import('fs')
  const logFilePath = resolveDefaultLogFilePath()
  if (!fs.existsSync(logFilePath)) {
    return { logFilePath, lines: ['(log file not created yet)'] }
  }
  const content = fs.readFileSync(logFilePath, 'utf8')
  const all = content.split(/\r?\n/).filter((line) => line.trim().length > 0)
  const limit = Math.min(Math.max(Math.trunc(maxLines) || 80, 20), 200)
  return {
    logFilePath,
    lines: all.slice(-limit),
  }
}
