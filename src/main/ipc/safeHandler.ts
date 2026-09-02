import type { IpcMain, IpcMainInvokeEvent } from 'electron'
import type { IpcResult } from '../../shared/errors/types'
import { normalizeError } from '../../shared/errors/normalize'
import { getLogger } from '../../shared/logger'
import { redactValue } from '../../shared/security/redact'
import { assertAllowedChannel, type AllowedIpcChannel } from '../../shared/ipc/channels'

const logger = getLogger().child('ipc')

export function registerSafeHandler<T>(
  ipcMain: IpcMain,
  channel: AllowedIpcChannel,
  handler: (...args: unknown[]) => T | Promise<T>
): void {
  registerSafeHandlerWithEvent(ipcMain, channel, (_event, ...args) => handler(...args))
}

export function registerSafeHandlerWithEvent<T>(
  ipcMain: IpcMain,
  channel: AllowedIpcChannel,
  handler: (event: IpcMainInvokeEvent, ...args: unknown[]) => T | Promise<T>
): void {
  assertAllowedChannel(channel)

  ipcMain.handle(channel, async (event, ...args: unknown[]): Promise<IpcResult<T>> => {
    try {
      const data = await handler(event, ...args)
      return { success: true, data }
    } catch (error) {
      const appError = normalizeError(error)
      logger.error(`Handler failed: ${channel}`, redactValue(appError.toPayload()) as Record<string, unknown>)
      return { success: false, error: appError.toPayload() }
    }
  })
}
