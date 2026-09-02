/**
 * Linux Search Assistant — SSH security rules (enforced in code).
 *
 * Password
 * - Prompt only during connection (connection dialog).
 * - Keep only long enough to establish the SSH session.
 * - Destroy immediately after authentication (clear local references).
 * - Never save, log, or expose passwords (not in config, handles, or logs).
 *
 * Session
 * - Keep SSH session alive (TCP keepalive on the transport).
 * - Reuse an existing live session for the same server.
 * - Destroy on application exit, window close, and inactivity timeout.
 *
 * Commands
 * - Only predefined allowlisted commands.
 * - Escape / shell-quote parameters; validate paths.
 * - Reject unknown commands.
 * - No write operations.
 */

/** Idle time after which an unused SSH session is destroyed. */
export const SSH_SESSION_INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000

/** How often SessionManager checks for idle sessions. */
export const SSH_INACTIVITY_CHECK_INTERVAL_MS = 30 * 1000

/** TCP keepalive interval used by the SSH transport to keep the session alive. */
export const SSH_TRANSPORT_KEEPALIVE_INTERVAL_MS = 15 * 1000

/**
 * Best-effort wipe of a password string reference.
 * JS strings are immutable; callers must drop every remaining reference.
 */
export function destroyPassword(password: string): string {
  void password
  return ''
}
