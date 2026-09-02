export type { AppErrorCode, AppErrorPayload, IpcResult, IpcSuccess, IpcFailure } from './types'
export { isIpcResult } from './types'
export { AppError, isAppErrorPayload } from './AppError'
export {
  normalizeError,
  normalizeHttpError,
  normalizeOpenApiError,
  normalizeDatabaseError,
  normalizeValidationError,
  normalizeSshError,
  appErrorFromCode,
  extractHttpErrorCause,
  toAppError,
} from './normalize'
import { toAppError as convertToAppError } from './normalize'

export function getFriendlyMessage(error: unknown, fallback = 'Something went wrong'): string {
  return convertToAppError(error, fallback).message
}
