import { getLogger } from '../../shared/logger'

const logger = getLogger().child('updater')

export interface AutoUpdaterConfig {
  /** Release feed base URL (generic provider). */
  feedUrl?: string
  /** Check for updates automatically on startup. */
  checkOnStartup?: boolean
}

/**
 * Auto-update entry point (placeholder).
 *
 * Intended future implementation:
 * - electron-updater with `publish.provider: generic` from electron-builder.yml
 * - dev feed override via dev-app-update.yml during local testing
 * - IPC channels for manual "Check for updates" from Settings
 * - download progress + restart-to-install flow
 *
 * Not implemented — releases are manual until a feed URL and electron-updater are added.
 */
export function initAutoUpdater(_config: AutoUpdaterConfig = {}): void {
  logger.info('Auto-update disabled (placeholder architecture only)')
}

/** Reserved for a future manual update check triggered from the renderer. */
export async function checkForUpdates(): Promise<{ available: false }> {
  return { available: false }
}
