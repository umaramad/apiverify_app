/**
 * Lightweight SSH session manager (password / keyboard-interactive only).
 *
 * Security contract:
 * - Passwords are requested via injected prompt, used once for auth, then discarded.
 * - Passwords are never stored, cached, logged, or returned on the public API.
 * - One live session per server id; operations are serialized per server (async mutex).
 * - Only {@link PredefinedSshCommand} allowlisted remote operations are executed.
 * - Never uses SSH agent or private keys (unlike terminal `ssh`, which often does).
 */
import { Client, type ClientChannel, type ConnectConfig } from 'ssh2'
import type {
  PredefinedSshCommand,
  SshCommandResult,
  SshConnectResult,
  SshPasswordPrompt,
  SshServerIdentity,
  SshSessionHandle,
} from '../models/ssh'
import {
  assertPredefinedCommand,
  buildPredefinedRemoteCommand,
  PredefinedCommandError,
} from '../services/predefinedCommands'
import { destroyPassword, SSH_TRANSPORT_KEEPALIVE_INTERVAL_MS } from './securityRules'
import { broadcastLinuxSearchConsole } from './consoleBroadcast'

const CONNECT_TIMEOUT_MS = 20_000
const EXEC_TIMEOUT_MS = 60_000
const KEEPALIVE_INTERVAL_MS = SSH_TRANSPORT_KEEPALIVE_INTERVAL_MS

export class SshServiceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SshServiceError'
  }
}

interface LiveSession {
  server: SshServerIdentity
  client: Client
  ready: boolean
}

function serverKey(server: SshServerIdentity | { id: string }): string {
  return server.id
}

function scrubSecret(_secret: string): void {
  // Intentionally unused — JS strings are immutable; callers must drop references.
  void _secret
}

function assertServerIdentity(server: SshServerIdentity): SshServerIdentity {
  const id = (server.id || '').trim()
  const host = (server.host || '').trim()
  const username = (server.username || '').trim()
  const port = Number(server.port)
  if (!id) throw new SshServiceError('Server id is required.')
  if (!host) throw new SshServiceError('Server host is required.')
  if (!username) throw new SshServiceError('Username is required.')
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new SshServiceError('SSH port must be an integer between 1 and 65535.')
  }
  return {
    id,
    host,
    port,
    username,
    label: server.label,
  }
}

export class SshService {
  private readonly sessions = new Map<string, LiveSession>()
  private readonly locks = new Map<string, Promise<void>>()
  private readonly passwordPrompt: SshPasswordPrompt
  private sessionLostHandler: ((serverId: string, identity: SshServerIdentity) => void) | null = null
  private closed = false

  constructor(passwordPrompt: SshPasswordPrompt) {
    if (typeof passwordPrompt !== 'function') {
      throw new SshServiceError('A password prompt callback is required.')
    }
    this.passwordPrompt = passwordPrompt
  }

  /** Register a listener for unexpected session drops (no passwords involved). */
  setSessionLostHandler(
    handler: ((serverId: string, identity: SshServerIdentity) => void) | null
  ): void {
    this.sessionLostHandler = handler
  }

  isConnected(server: SshServerIdentity | { id: string }): boolean {
    const session = this.sessions.get(serverKey(server))
    return Boolean(session?.ready)
  }

  async connect(server: SshServerIdentity): Promise<SshConnectResult> {
    this.assertOpen()
    const identity = assertServerIdentity(server)
    const key = serverKey(identity)

    return this.withLock(key, async () => {
      const existing = this.sessions.get(key)
      if (existing?.ready) {
        return { serverId: identity.id, connected: true }
      }
      if (existing) {
        await this.destroySession(key, existing)
      }

      let password = await this.passwordPrompt(identity)
      try {
        return await this.authenticateLocked(identity, key, password)
      } finally {
        password = destroyPassword(password)
      }
    })
  }

  /**
   * Authenticate with a one-time password from the connection dialog.
   * The password argument must not be retained by the caller after this returns.
   */
  async connectWithPassword(server: SshServerIdentity, password: string): Promise<SshConnectResult> {
    this.assertOpen()
    const identity = assertServerIdentity(server)
    const key = serverKey(identity)

    return this.withLock(key, async () => {
      const existing = this.sessions.get(key)
      if (existing?.ready) {
        return { serverId: identity.id, connected: true }
      }
      if (existing) {
        await this.destroySession(key, existing)
      }

      let ephemeral = password
      try {
        return await this.authenticateLocked(identity, key, ephemeral)
      } finally {
        ephemeral = destroyPassword(ephemeral)
      }
    })
  }

  getSessionHandle(server: SshServerIdentity | { id: string }): SshSessionHandle | null {
    const session = this.sessions.get(serverKey(server))
    if (!session?.ready) return null
    return {
      serverId: session.server.id,
      server: session.server.label || session.server.host,
      host: session.server.host,
      port: session.server.port,
      username: session.server.username,
      connected: true,
    }
  }

  private async authenticateLocked(
    identity: SshServerIdentity,
    key: string,
    password: string
  ): Promise<SshConnectResult> {
    if (typeof password !== 'string' || password.length === 0) {
      throw new SshServiceError('Password is required to connect.')
    }

    const client = await this.openClient(identity, password)
    scrubSecret(password)

    const session: LiveSession = { server: identity, client, ready: true }
    this.bindClientLifecycle(key, session)
    this.sessions.set(key, session)
    return { serverId: identity.id, connected: true }
  }

  async disconnect(server: SshServerIdentity | { id: string }): Promise<void> {
    const key = serverKey(server)
    return this.withLock(key, async () => {
      const session = this.sessions.get(key)
      if (!session) return
      await this.destroySession(key, session)
    })
  }

  async executePredefined(command: PredefinedSshCommand): Promise<SshCommandResult> {
    this.assertOpen()
    const serverId = (command.serverId || '').trim()
    if (!serverId) throw new SshServiceError('serverId is required on the command.')

    return this.withLock(serverId, async () => {
      let session = this.sessions.get(serverId)
      if (!session?.ready) {
        throw new SshServiceError(
          'SSH session is not connected. Reconnect via the connection dialog to continue.'
        )
      }

      let remote: string
      try {
        const safeCommand = assertPredefinedCommand(command)
        remote = buildPredefinedRemoteCommand(safeCommand)
      } catch (error) {
        if (error instanceof PredefinedCommandError) throw error
        throw new SshServiceError('Invalid predefined command.')
      }

      // Always surface the exact remote line in the in-app console (never includes secrets).
      broadcastLinuxSearchConsole('info', `$ ${remote}`, 'cmd')

      try {
        return await this.execOnSession(session, command.kind, remote)
      } catch (error) {
        // Session may have dropped mid-flight — clear it so the next connect re-prompts.
        const lost = !session.ready || this.isTransportError(error)
        if (lost) {
          await this.destroySession(serverId, session)
          throw new SshServiceError(
            'SSH connection was lost. Reconnect via the connection dialog to re-authenticate.'
          )
        }
        throw error
      }
    })
  }

  /**
   * Run multiple allowlisted commands on the same server under one session lock.
   * Keeps the SSH session alive across a multi-file grep batch.
   */
  async executePredefinedBatch(commands: PredefinedSshCommand[]): Promise<SshCommandResult[]> {
    this.assertOpen()
    if (!Array.isArray(commands) || commands.length === 0) {
      throw new SshServiceError('At least one command is required.')
    }
    const serverId = (commands[0]?.serverId || '').trim()
    if (!serverId) throw new SshServiceError('serverId is required on the command.')
    if (commands.some((c) => (c.serverId || '').trim() !== serverId)) {
      throw new SshServiceError('Batch commands must target the same serverId.')
    }

    return this.withLock(serverId, async () => {
      const session = this.sessions.get(serverId)
      if (!session?.ready) {
        throw new SshServiceError(
          'SSH session is not connected. Reconnect via the connection dialog to continue.'
        )
      }

      const results: SshCommandResult[] = []
      for (const command of commands) {
        let remote: string
        try {
          const safeCommand = assertPredefinedCommand(command)
          remote = buildPredefinedRemoteCommand(safeCommand)
        } catch (error) {
          if (error instanceof PredefinedCommandError) throw error
          throw new SshServiceError('Invalid predefined command.')
        }

        broadcastLinuxSearchConsole('info', `$ ${remote}`, 'cmd')

        try {
          results.push(await this.execOnSession(session, command.kind, remote))
        } catch (error) {
          const lost = !session.ready || this.isTransportError(error)
          if (lost) {
            await this.destroySession(serverId, session)
            throw new SshServiceError(
              'SSH connection was lost. Reconnect via the connection dialog to re-authenticate.'
            )
          }
          throw error
        }
      }
      return results
    })
  }

  /**
   * Read-only SFTP download of a remote file into a local destination path.
   * Never accepts shell commands; remote path must already be allowlisted by the caller.
   */
  async downloadFile(serverId: string, remotePath: string, localPath: string): Promise<{
    serverId: string
    remotePath: string
    localPath: string
    bytes: number
  }> {
    this.assertOpen()
    const id = (serverId || '').trim()
    if (!id) throw new SshServiceError('serverId is required.')
    const remote = (remotePath || '').trim()
    const local = (localPath || '').trim()
    if (!remote.startsWith('/')) throw new SshServiceError('Remote path must be absolute.')
    if (!local) throw new SshServiceError('Local destination path is required.')

    return this.withLock(id, async () => {
      const session = this.sessions.get(id)
      if (!session?.ready) {
        throw new SshServiceError(
          'SSH session is not connected. Reconnect via the connection dialog to continue.'
        )
      }

      return new Promise((resolve, reject) => {
        session.client.sftp((error, sftp) => {
          if (error) {
            reject(new SshServiceError(sanitizeSshError(error)))
            return
          }

          const timer = setTimeout(() => {
            try {
              sftp.end()
            } catch {
              // ignore
            }
            reject(new SshServiceError('SFTP download timed out.'))
          }, EXEC_TIMEOUT_MS)

          sftp.fastGet(remote, local, (err) => {
            clearTimeout(timer)
            try {
              sftp.end()
            } catch {
              // ignore
            }
            if (err) {
              reject(new SshServiceError(sanitizeSshError(err)))
              return
            }
            // Size is best-effort; success is defined by fastGet completion.
            resolve({
              serverId: id,
              remotePath: remote,
              localPath: local,
              bytes: 0,
            })
          })
        })
      })
    })
  }

  async closeAll(): Promise<void> {
    const keys = Array.from(this.sessions.keys())
    await Promise.all(
      keys.map(async (key) => {
        await this.withLock(key, async () => {
          const session = this.sessions.get(key)
          if (session) await this.destroySession(key, session)
        })
      })
    )
    this.sessions.clear()
  }

  /** Permanent shutdown — rejects further connect attempts. */
  async shutdown(): Promise<void> {
    this.closed = true
    await this.closeAll()
    this.locks.clear()
    this.sessionLostHandler = null
  }

  private assertOpen(): void {
    if (this.closed) {
      throw new SshServiceError('SSH service has been closed.')
    }
  }

  private async withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.locks.get(key) ?? Promise.resolve()
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const chained = previous.catch(() => undefined).then(() => gate)
    this.locks.set(key, chained)

    await previous.catch(() => undefined)
    try {
      return await fn()
    } finally {
      release()
    }
  }

  private bindClientLifecycle(key: string, session: LiveSession): void {
    const markLost = (): void => {
      if (!session.ready) return
      session.ready = false
      const current = this.sessions.get(key)
      if (current === session) {
        this.sessions.delete(key)
      }
      try {
        session.client.end()
      } catch {
        // ignore
      }
      try {
        this.sessionLostHandler?.(key, session.server)
      } catch {
        // ignore listener errors
      }
    }

    // Only treat close/end as session loss. Attaching markLost to 'error' tears down the
    // connection mid-flight (e.g. after the first grep in a multi-file batch) because ssh2
    // can emit non-fatal/channel-related errors that are followed by a clean stream close.
    session.client.on('close', markLost)
    session.client.on('end', markLost)
    session.client.on('error', () => {
      // Fatal transport failures are followed by 'close'; avoid destroying while an exec runs.
    })
  }

  private openClient(server: SshServerIdentity, password: string): Promise<Client> {
    return new Promise((resolve, reject) => {
      const client = new Client()
      let settled = false
      // Keep a local reference for keyboard-interactive replies; wiped in finish().
      let authPassword: string | undefined = password
      const config: ConnectConfig = {
        host: server.host,
        port: server.port,
        username: server.username,
        password: authPassword,
        // Many OpenSSH servers offer keyboard-interactive (PAM) instead of/before
        // the plain "password" method. Terminal `ssh` handles this automatically;
        // ssh2 needs tryKeyboard + a keyboard-interactive handler.
        tryKeyboard: true,
        readyTimeout: CONNECT_TIMEOUT_MS,
        keepaliveInterval: KEEPALIVE_INTERVAL_MS,
        keepaliveCountMax: 3,
        // Password / keyboard-interactive only — never attach agent or private keys.
        agent: undefined,
        privateKey: undefined,
        passphrase: undefined,
      }

      const wipePasswordFromConfig = (): void => {
        // Drop credential material from the local config object as soon as auth completes or fails.
        config.password = undefined
        authPassword = undefined
      }

      const finish = (error?: Error): void => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        wipePasswordFromConfig()
        if (error) {
          try {
            client.end()
          } catch {
            // ignore
          }
          reject(error)
        } else {
          resolve(client)
        }
      }

      const timer = setTimeout(() => {
        finish(new SshServiceError(`SSH connection timed out for ${server.host}:${server.port}.`))
      }, CONNECT_TIMEOUT_MS)

      client.on('ready', () => finish())
      client.on('error', (err) => {
        finish(new SshServiceError(sanitizeSshError(err)))
      })
      // @types/ssh2 omits 'keyboard-interactive'; the ssh2 Client emits it at runtime.
      ;(client as NodeJS.EventEmitter).on(
        'keyboard-interactive',
        (
          _name: string,
          _instructions: string,
          _instructionsLang: string,
          prompts: Array<{ prompt: string; echo: boolean }>,
          done: (responses: string[]) => void
        ) => {
          // Answer each prompt with the one-time password (typical single "Password:" prompt).
          // Do not fall back to SSH agent/keys. Multi-factor extra prompts will still fail.
          const secret = authPassword ?? ''
          done(prompts.map(() => secret))
        }
      )

      try {
        client.connect(config)
      } catch (error) {
        finish(new SshServiceError(sanitizeSshError(error)))
      }
    })
  }

  private execOnSession(
    session: LiveSession,
    kind: SshCommandResult['kind'],
    remoteCommand: string
  ): Promise<SshCommandResult> {
    return new Promise((resolve, reject) => {
      if (!session.ready) {
        reject(new SshServiceError('SSH session is not connected.'))
        return
      }

      const timer = setTimeout(() => {
        reject(new SshServiceError('Remote command timed out.'))
      }, EXEC_TIMEOUT_MS)

      session.client.exec(remoteCommand, (error, stream) => {
        if (error) {
          clearTimeout(timer)
          session.ready = false
          reject(new SshServiceError(sanitizeSshError(error)))
          return
        }
        this.collectStream(session.server.id, kind, stream)
          .then((result) => {
            clearTimeout(timer)
            resolve(result)
          })
          .catch((err) => {
            clearTimeout(timer)
            reject(err)
          })
      })
    })
  }

  private collectStream(
    serverId: string,
    kind: SshCommandResult['kind'],
    stream: ClientChannel
  ): Promise<SshCommandResult> {
    return new Promise((resolve, reject) => {
      const stdoutChunks: Buffer[] = []
      const stderrChunks: Buffer[] = []

      stream.on('data', (chunk: Buffer) => {
        stdoutChunks.push(Buffer.from(chunk))
      })
      stream.stderr.on('data', (chunk: Buffer) => {
        stderrChunks.push(Buffer.from(chunk))
      })
      stream.on('error', (error) => {
        reject(new SshServiceError(sanitizeSshError(error)))
      })
      stream.on('close', (code: number | null) => {
        const stdout = Buffer.concat(stdoutChunks).toString('utf8')
        const stderr = scrubSessionStderr(Buffer.concat(stderrChunks).toString('utf8'))
        resolve({
          serverId,
          kind,
          exitCode: typeof code === 'number' ? code : 1,
          stdout,
          stderr,
        })
      })
    })
  }

  private async destroySession(key: string, session: LiveSession): Promise<void> {
    session.ready = false
    this.sessions.delete(key)
    await new Promise<void>((resolve) => {
      try {
        session.client.once('close', () => resolve())
        session.client.end()
        setTimeout(resolve, 500)
      } catch {
        resolve()
      }
    })
  }

  private isTransportError(error: unknown): boolean {
    const message = error instanceof Error ? error.message.toLowerCase() : ''
    return (
      message.includes('not connected') ||
      message.includes('connection lost') ||
      message.includes('socket') ||
      message.includes('handshake')
    )
  }
}

function scrubSessionStderr(stderr: string): string {
  // OpenSSH often prints this when the account home is missing; commands still run after our cd.
  return (stderr || '')
    .split(/\r?\n/)
    .filter((line) => !/could not chdir to home directory/i.test(line))
    .join('\n')
    .trim()
}

function sanitizeSshError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'SSH operation failed.'
  // Strip anything that looks like credential material if a library ever echoes it.
  const scrubbed = message
    .replace(/password[=:]\s*\S+/gi, 'password=[redacted]')
    .replace(/passphrase[=:]\s*\S+/gi, 'passphrase=[redacted]')

  if (/all configured authentication methods failed/i.test(scrubbed)) {
    return (
      'SSH authentication failed (password / keyboard-interactive). ' +
      'Check username, host, port, and password. ' +
      'If terminal `ssh` works without typing a password, it may be using an SSH key — this app only supports password login.'
    )
  }
  return scrubbed
}
