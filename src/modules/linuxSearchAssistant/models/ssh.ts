/**
 * SSH identity and predefined-command models.
 * Passwords are never part of these models.
 */

/** Non-secret identity used to open/reuse one SSH session per server. */
export interface SshServerIdentity {
  /** Stable server/target id (matches LinuxSearchTargetConfig.id). */
  id: string
  host: string
  port: number
  username: string
  /** Optional display label for password prompts (never logged with secrets). */
  label?: string
}

export type PredefinedSshCommandKind =
  | 'test_connection'
  | 'list_path'
  | 'list_dir_files'
  | 'read_cat'
  | 'read_head'
  | 'read_tail'
  | 'grep_path'
  | 'find_files'

/**
 * Allowlisted remote operations only.
 * No free-form shell string is accepted.
 */
export type PredefinedSshCommand =
  | { kind: 'test_connection'; serverId: string }
  /** cwd = selected configured directory; path = relative target (`.` or filename). */
  | { kind: 'list_path'; serverId: string; cwd: string; path: string }
  | { kind: 'list_dir_files'; serverId: string; cwd: string; path: string }
  | { kind: 'read_cat'; serverId: string; cwd: string; path: string }
  | { kind: 'read_head'; serverId: string; cwd: string; path: string; lines?: number }
  | { kind: 'read_tail'; serverId: string; cwd: string; path: string; lines?: number }
  | { kind: 'grep_path'; serverId: string; cwd: string; path: string; pattern: string; contextMode?: 'C' | 'A' | 'B'; contextLines?: number }
  | { kind: 'find_files'; serverId: string; cwd: string; path: string; namePattern: string }

export interface SshCommandResult {
  serverId: string
  kind: PredefinedSshCommandKind
  exitCode: number
  stdout: string
  stderr: string
}

export interface SshConnectResult {
  serverId: string
  connected: boolean
}

/**
 * Renderer-safe handle for an authenticated SSH session.
 * Never includes passwords or raw client objects.
 */
export interface SshSessionHandle {
  serverId: string
  server: string
  host: string
  port: number
  username: string
  connected: true
}

/** Fired when a live session drops unexpectedly. */
export interface SshSessionExpiredEvent {
  type: 'sessionExpired'
  reason: 'connection_lost' | 'closed' | 'inactivity_timeout'
  session: SshSessionHandle
  /** Non-secret identity for reconnect prefill (never includes a password). */
  reconnect: {
    server: string
    host: string
    username: string
    port: number
    id: string
  }
}

/** Injected password provider — password must not be persisted by the caller. */
export type SshPasswordPrompt = (server: SshServerIdentity) => Promise<string>

export const PREDEFINED_SSH_COMMAND_KINDS: readonly PredefinedSshCommandKind[] = [
  'test_connection',
  'list_path',
  'list_dir_files',
  'read_cat',
  'read_head',
  'read_tail',
  'grep_path',
  'find_files',
] as const
