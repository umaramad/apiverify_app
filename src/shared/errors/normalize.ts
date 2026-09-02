import { AppError } from './AppError'
import type { AppErrorCode } from './types'

const USER_FACING_HTTP_CODES: AppErrorCode[] = ['NETWORK', 'TIMEOUT', 'CANCELLED']

function isAggregateError(error: unknown): error is AggregateError {
  return (
    error instanceof AggregateError ||
    (typeof error === 'object' &&
      error !== null &&
      (error as { name?: string }).name === 'AggregateError')
  )
}

function collectUnderlyingErrors(error: unknown, depth = 0): unknown[] {
  if (depth > 6 || error == null) return []

  const collected: unknown[] = [error]

  if (isAggregateError(error)) {
    for (const inner of error.errors) {
      collected.push(...collectUnderlyingErrors(inner, depth + 1))
    }
  }

  if (typeof error === 'object') {
    const candidate = error as { cause?: unknown; errors?: unknown[] }
    if (candidate.cause != null) {
      collected.push(...collectUnderlyingErrors(candidate.cause, depth + 1))
    }
    if (Array.isArray(candidate.errors)) {
      for (const inner of candidate.errors) {
        collected.push(...collectUnderlyingErrors(inner, depth + 1))
      }
    }
  }

  return collected
}

function isStackTraceLine(line: string): boolean {
  const trimmed = line.trim()
  return (
    trimmed.startsWith('at ') ||
    trimmed.includes('node_modules/') ||
    trimmed.includes('AxiosError.from') ||
    trimmed.includes('RedirectableRequest.')
  )
}

function sanitizeTechnicalText(text: string): string {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !isStackTraceLine(line))
    .join('\n')
}

function isUsefulCauseMessage(message: string): boolean {
  const trimmed = message.trim()
  if (!trimmed || trimmed === 'AggregateError' || trimmed === 'Error') return false
  if (isStackTraceLine(trimmed)) return false
  return true
}

/** Short, user-safe cause for logs / optional detail — never a stack trace. */
export function extractHttpErrorCause(error: unknown): string | undefined {
  const messages: string[] = []

  for (const candidate of collectUnderlyingErrors(error)) {
    if (typeof candidate !== 'object' || candidate === null) continue

    const item = candidate as { code?: string; message?: string }
    if (item.code && item.code !== 'ERR_NETWORK' && item.code !== 'AggregateError') {
      if (!messages.includes(item.code)) messages.push(item.code)
    }

    if (typeof item.message === 'string' && isUsefulCauseMessage(item.message)) {
      const sanitized = sanitizeTechnicalText(item.message)
      if (sanitized && !messages.includes(sanitized)) {
        messages.push(sanitized)
      }
    }
  }

  const joined = messages.slice(0, 3).join(' — ')
  return joined || undefined
}

function buildHttpTechnicalDetails(error: unknown, code: AppErrorCode): string | undefined {
  if (USER_FACING_HTTP_CODES.includes(code)) {
    return extractHttpErrorCause(error)
  }

  if (isAxiosLikeError(error)) {
    return [error.message, error.stack].filter(Boolean).join('\n')
  }

  if (error instanceof Error) {
    return error.stack || error.message
  }

  return undefined
}

function isAxiosLikeError(error: unknown): error is {
  code?: string
  message: string
  response?: { status: number; statusText?: string; data?: unknown }
  stack?: string
  isAxiosError?: boolean
} {
  if (typeof error !== 'object' || error === null || !('message' in error)) {
    return false
  }
  const candidate = error as { isAxiosError?: boolean; code?: string }
  return candidate.isAxiosError === true || typeof candidate.code === 'string'
}

function isSqliteError(error: unknown): error is { code: string; message: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string' &&
    (error as { code: string }).code.startsWith('SQLITE_')
  )
}

export function normalizeHttpError(error: unknown): AppError {
  if (!isAxiosLikeError(error)) {
    if (isAggregateError(error)) {
      return new AppError({
        code: 'NETWORK',
        message: 'Unable to reach the server. Check your network connection, base URL, and proxy settings.',
        technicalDetails: extractHttpErrorCause(error),
        retryable: true,
      })
    }

    if (error instanceof Error) {
      if (/timeout/i.test(error.message)) {
        return new AppError({
          code: 'TIMEOUT',
          message: 'The request timed out. The server took too long to respond.',
          technicalDetails: extractHttpErrorCause(error),
          retryable: true,
        })
      }
      if (/network|unreachable|ENOTFOUND|ECONNREFUSED|ECONNRESET|AggregateError/i.test(error.message)) {
        return new AppError({
          code: 'NETWORK',
          message: 'Unable to reach the server. Check your network connection and base URL.',
          technicalDetails: extractHttpErrorCause(error),
          retryable: true,
        })
      }
    }
    return AppError.fromUnknown(error, 'The request could not be completed.')
  }

  const code = error.code

  if (code === 'ECONNABORTED' || code === 'ETIMEDOUT' || /timeout/i.test(error.message)) {
    return new AppError({
      code: 'TIMEOUT',
      message: 'The request timed out. The server took too long to respond.',
      technicalDetails: buildHttpTechnicalDetails(error, 'TIMEOUT'),
      retryable: true,
    })
  }

  if (
    code === 'ERR_CANCELED' ||
    code === 'ABORT_ERR' ||
    /aborted|cancel/i.test(error.message)
  ) {
    return new AppError({
      code: 'CANCELLED',
      message: 'The request was cancelled.',
      technicalDetails: buildHttpTechnicalDetails(error, 'CANCELLED'),
      retryable: false,
    })
  }

  const technical = buildHttpTechnicalDetails(error, 'NETWORK')

  if (
    code === 'ENOTFOUND' ||
    code === 'ECONNREFUSED' ||
    code === 'ECONNRESET' ||
    code === 'EAI_AGAIN' ||
    code === 'ERR_NETWORK' ||
    code === 'ERR_FR_PROXY_CONNECTION_FAILED' ||
    code === 'ERR_FR_PROXY_AUTH_REQUIRED' ||
    /network|AggregateError/i.test(error.message)
  ) {
    const proxyHint = /proxy|407|tunnel|squid|gateway/i.test(technical ?? '')
      ? ' Check Settings → Network Proxy (host, port, username/password).'
      : ''
    return new AppError({
      code: 'NETWORK',
      message: `Unable to reach the server. Check your network connection, base URL, and proxy settings.${proxyHint}`,
      technicalDetails: technical,
      retryable: true,
    })
  }

  if (error.response) {
    return new AppError({
      code: 'NETWORK',
      message: `The server responded with an error (${error.response.status}).`,
      technicalDetails: [
        error.message,
        `Status: ${error.response.status} ${error.response.statusText ?? ''}`.trim(),
        error.response.data ? JSON.stringify(error.response.data, null, 2) : undefined,
      ]
        .filter(Boolean)
        .join('\n'),
      retryable: error.response.status >= 500,
    })
  }

  return new AppError({
    code: 'NETWORK',
    message:
      'The request failed due to a network error. If you are behind a corporate firewall, configure Settings → Network Proxy and verify the API base URL.',
    technicalDetails: buildHttpTechnicalDetails(error, 'NETWORK'),
    retryable: true,
  })
}

export function normalizeOpenApiError(error: unknown): AppError {
  if (error instanceof AppError) return error

  const message =
    error instanceof Error ? error.message : typeof error === 'string' ? error : 'Invalid specification'

  const lower = message.toLowerCase()
  let friendly = 'The OpenAPI specification is invalid or could not be parsed.'

  if (lower.includes('json') || lower.includes('yaml') || lower.includes('parse')) {
    friendly = 'The specification file is not valid JSON or YAML. Check the syntax and try again.'
  } else if (lower.includes('$ref') || lower.includes('reference')) {
    friendly = 'The specification contains unresolved or invalid $ref references.'
  } else if (lower.includes('openapi') || lower.includes('swagger')) {
    friendly = 'The document is not a valid OpenAPI/Swagger specification.'
  }

  return new AppError({
    code: 'OPENAPI',
    message: friendly,
    technicalDetails: error instanceof Error ? error.stack || error.message : message,
    retryable: false,
  })
}

export function normalizeDatabaseError(error: unknown): AppError {
  if (isSqliteError(error)) {
    let friendly = 'A database error occurred. Your changes may not have been saved.'

    if (error.code === 'SQLITE_CONSTRAINT' || error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      friendly = 'This record already exists or conflicts with existing data.'
    } else if (error.code === 'SQLITE_BUSY') {
      friendly = 'The database is busy. Please try again in a moment.'
    } else if (error.code === 'SQLITE_CORRUPT') {
      friendly = 'The local database appears to be corrupted.'
    }

    return new AppError({
      code: 'DATABASE',
      message: friendly,
      technicalDetails: `${error.code}: ${error.message}`,
      retryable: error.code === 'SQLITE_BUSY',
    })
  }

  const text = error instanceof Error ? error.message : String(error)
  if (/SQLITE|sqlite|database/i.test(text)) {
    return new AppError({
      code: 'DATABASE',
      message: 'A database error occurred. Your changes may not have been saved.',
      technicalDetails: error instanceof Error ? error.stack || error.message : text,
      retryable: /busy/i.test(text),
    })
  }

  return AppError.fromUnknown(error, 'A database error occurred.')
}

export function normalizeValidationError(message: string, technical?: string): AppError {
  return new AppError({
    code: 'VALIDATION',
    message,
    technicalDetails: technical,
    retryable: false,
  })
}

function isSshRelatedError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const name = (error as { name?: string }).name || ''
  const message = error instanceof Error ? error.message : String(error)
  if (name === 'SshServiceError' || name === 'PredefinedCommandError') return true
  return /ssh|handshake|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|authentication|authorized|banner|channel|sftp/i.test(
    message
  )
}

/**
 * Keep SSH failure reasons user-visible (do not collapse to "Something went wrong").
 * Never include passwords.
 */
export function normalizeSshError(error: unknown): AppError {
  const raw = error instanceof Error ? error.message : String(error)
  const sanitized = raw
    .replace(/password[=:]\s*\S+/gi, 'password=[redacted]')
    .replace(/passphrase[=:]\s*\S+/gi, 'passphrase=[redacted]')

  let message = sanitized || 'SSH connection failed.'
  let retryable = true

  if (/ECONNREFUSED|actively refused/i.test(sanitized)) {
    message =
      'SSH connection refused. Check host, port, and that sshd is running and reachable from this machine.'
  } else if (/ENOTFOUND|getaddrinfo/i.test(sanitized)) {
    message = 'SSH host could not be resolved. Check the hostname/IP.'
  } else if (/ETIMEDOUT|timed out|Timeout/i.test(sanitized)) {
    message =
      'SSH connection timed out. Check VPN/firewall, host, and port (often 22).'
  } else if (/All configured authentication methods failed|authentication|Permission denied/i.test(sanitized)) {
    message =
      'SSH authentication failed. Check username/password (this app uses password auth only — key-only servers will fail).'
    retryable = false
  } else if (/handshake|protocol/i.test(sanitized)) {
    message = `SSH handshake failed: ${sanitized}`
  } else if (error instanceof Error && error.name === 'SshServiceError') {
    message = sanitized
  }

  return new AppError({
    code: 'SSH',
    message,
    technicalDetails: sanitized !== message ? sanitized : undefined,
    retryable,
  })
}

export function normalizeError(error: unknown): AppError {
  if (error instanceof AppError) return error

  if (isSqliteError(error)) return normalizeDatabaseError(error)

  if (isSshRelatedError(error)) return normalizeSshError(error)

  if (isAxiosLikeError(error)) {
    const normalized = normalizeHttpError(error)
    if (normalized.code !== 'UNKNOWN') return normalized
  }

  const message = error instanceof Error ? error.message : String(error)

  if (/openapi|swagger|\$ref|specification/i.test(message)) {
    return normalizeOpenApiError(error)
  }

  if (/SQLITE|sqlite|database/i.test(message)) {
    return normalizeDatabaseError(error)
  }

  if (error instanceof Error) {
    if (/timeout/i.test(error.message)) {
      return new AppError({
        code: 'TIMEOUT',
        message: 'The request timed out. The server took too long to respond.',
        technicalDetails: extractHttpErrorCause(error),
        retryable: true,
      })
    }
    if (/network|ENOTFOUND|ECONNREFUSED|ECONNRESET|unreachable|AggregateError/i.test(error.message)) {
      return new AppError({
        code: 'NETWORK',
        message: 'Unable to reach the server. Check your network connection and base URL.',
        technicalDetails: extractHttpErrorCause(error),
        retryable: true,
      })
    }
  }

  return AppError.fromUnknown(error)
}

export function toAppError(error: unknown, fallbackMessage?: string): AppError {
  const normalized = normalizeError(error)
  if (normalized.code !== 'UNKNOWN' || !fallbackMessage) {
    return normalized
  }

  return new AppError({
    code: 'UNKNOWN',
    message: fallbackMessage,
    technicalDetails: normalized.technicalDetails,
    retryable: normalized.retryable,
  })
}

export function appErrorFromCode(
  code: AppErrorCode,
  message: string,
  options?: { technicalDetails?: string; retryable?: boolean }
): AppError {
  return new AppError({
    code,
    message,
    technicalDetails: options?.technicalDetails,
    retryable: options?.retryable ?? false,
  })
}
