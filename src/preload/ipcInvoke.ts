import { ipcRenderer } from 'electron'
import { AppError } from '../shared/errors/AppError'
import { isIpcResult } from '../shared/errors/types'
import { assertAllowedChannel } from '../shared/ipc/channels'

export async function ipcInvoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  assertAllowedChannel(channel)

  const result: unknown = await ipcRenderer.invoke(channel, ...args)

  if (isIpcResult<T>(result)) {
    if (result.success) {
      return result.data
    }
    throw AppError.fromPayload(result.error)
  }

  return result as T
}
