export type AppErrorCode =
  | 'NETWORK'
  | 'TIMEOUT'
  | 'OPENAPI'
  | 'DATABASE'
  | 'VALIDATION'
  | 'CANCELLED'
  | 'SSH'
  | 'UNKNOWN'

/** Serializable error shape for IPC and UI state */
export interface AppErrorPayload {
  code: AppErrorCode
  /** User-facing message */
  message: string
  /** Developer-oriented detail (stack, SQL, raw response, etc.) */
  technicalDetails?: string
  retryable: boolean
}

export interface IpcSuccess<T> {
  success: true
  data: T
}

export interface IpcFailure {
  success: false
  error: AppErrorPayload
}

export type IpcResult<T> = IpcSuccess<T> | IpcFailure

export function isIpcResult<T>(value: unknown): value is IpcResult<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'success' in value &&
    typeof (value as IpcResult<T>).success === 'boolean'
  )
}
