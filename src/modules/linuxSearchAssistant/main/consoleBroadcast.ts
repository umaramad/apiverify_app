/**
 * Broadcast non-secret console lines to all renderer windows.
 * Never include passwords or raw secret material.
 */
import { BrowserWindow } from 'electron'
import type { LinuxSearchConsoleLevel, LinuxSearchConsoleLogEvent } from '../models/consoleLog'
import { LINUX_SEARCH_ASSISTANT_IPC_EVENTS } from '../ipc/channels'
import { getLogger } from '../../../shared/logger'

const logger = getLogger().child('linuxSearchAssistant.console')

function scrub(message: string): string {
  return message
    .replace(/password[=:]\s*\S+/gi, 'password=[redacted]')
    .replace(/passphrase[=:]\s*\S+/gi, 'passphrase=[redacted]')
}

export function broadcastLinuxSearchConsole(
  level: LinuxSearchConsoleLevel,
  message: string,
  source?: string
): void {
  const safeMessage = scrub(message)
  const event: LinuxSearchConsoleLogEvent = {
    type: 'consoleLog',
    level,
    message: safeMessage,
    timestamp: new Date().toISOString(),
    source,
  }

  if (level === 'error') logger.error(safeMessage, { source })
  else if (level === 'warn') logger.warn(safeMessage, { source })
  else logger.info(safeMessage, { source })

  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send(LINUX_SEARCH_ASSISTANT_IPC_EVENTS.consoleLog, event)
    }
  }
}
