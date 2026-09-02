/**
 * Process-wide SSH service singleton for Linux Search Assistant.
 * Wired for app-lifecycle cleanup; passwords never live here beyond the active prompt call.
 */
import type { SshPasswordPrompt } from '../models/ssh'
import { SshService, SshServiceError } from './sshService'

let instance: SshService | null = null

const defaultPasswordPrompt: SshPasswordPrompt = async () => {
  throw new SshServiceError(
    'Interactive password prompt is not available. Use the connection dialog to authenticate.'
  )
}

export function getSshService(): SshService {
  if (!instance) {
    throw new SshServiceError(
      'SSH service is not initialized. Call initSshService(passwordPrompt) during app startup.'
    )
  }
  return instance
}

export function initSshService(passwordPrompt: SshPasswordPrompt = defaultPasswordPrompt): SshService {
  if (instance) {
    return instance
  }
  instance = new SshService(passwordPrompt)
  return instance
}

/** Ensure a process-wide instance exists (dialog-driven auth). */
export function ensureSshService(): SshService {
  return initSshService()
}

export async function shutdownSshService(): Promise<void> {
  if (!instance) return
  const current = instance
  instance = null
  await current.shutdown()
}

export function isSshServiceInitialized(): boolean {
  return instance !== null
}
