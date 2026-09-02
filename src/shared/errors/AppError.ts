import type { AppErrorCode, AppErrorPayload } from './types'

export class AppError extends Error {
  readonly code: AppErrorCode
  readonly technicalDetails?: string
  readonly retryable: boolean

  constructor(payload: AppErrorPayload) {
    super(payload.message)
    this.name = 'AppError'
    this.code = payload.code
    this.technicalDetails = payload.technicalDetails
    this.retryable = payload.retryable
  }

  toPayload(): AppErrorPayload {
    return {
      code: this.code,
      message: this.message,
      technicalDetails: this.technicalDetails,
      retryable: this.retryable,
    }
  }

  static fromPayload(payload: AppErrorPayload): AppError {
    return new AppError(payload)
  }

  static fromUnknown(error: unknown, fallbackMessage = 'Something went wrong'): AppError {
    if (error instanceof AppError) return error
    if (isAppErrorPayload(error)) return AppError.fromPayload(error)

    if (error instanceof Error) {
      return new AppError({
        code: 'UNKNOWN',
        message: fallbackMessage,
        technicalDetails: error.stack || error.message,
        retryable: false,
      })
    }

    return new AppError({
      code: 'UNKNOWN',
      message: fallbackMessage,
      technicalDetails: String(error),
      retryable: false,
    })
  }
}

export function isAppErrorPayload(value: unknown): value is AppErrorPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value &&
    'retryable' in value
  )
}
