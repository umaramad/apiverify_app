import type { ValidationConsoleLogEntry, ValidationConsoleLogLevel } from '../models/validationRunner'

function logId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function createConsoleLog(
  level: ValidationConsoleLogLevel,
  message: string,
  detail?: string
): ValidationConsoleLogEntry {
  return {
    id: logId(),
    timestamp: new Date().toISOString(),
    level,
    message,
    detail,
  }
}

export function redactHeadersForLog(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) {
    const lower = key.toLowerCase()
    if (
      lower.includes('authorization') ||
      lower.includes('token') ||
      lower.includes('secret') ||
      lower.includes('password') ||
      lower.includes('api-key') ||
      lower.includes('apikey')
    ) {
      out[key] = '[REDACTED]'
    } else {
      out[key] = value
    }
  }
  return out
}

export function truncateForLog(value: unknown, maxLen = 1200): string {
  if (value === null || value === undefined) return ''
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
  if (text.length <= maxLen) return text
  return `${text.slice(0, maxLen)}\n… (truncated)`
}
