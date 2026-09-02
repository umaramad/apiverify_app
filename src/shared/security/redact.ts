/** Keys (case-insensitive) redacted from logs and error metadata */
const SENSITIVE_KEYS = new Set([
  'token',
  'password',
  'secret',
  'authorization',
  'apikey',
  'api_key',
  'access_token',
  'refresh_token',
  'bearer',
  'credentials',
  'cookie',
  'set-cookie',
])

const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9\-._~+/]+=*\b/gi
const BASIC_AUTH_PATTERN = /\bBasic\s+[A-Za-z0-9+/=]+\b/gi
const REDACTED = '[REDACTED]'

export function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[-_\s]/g, '')
  if (SENSITIVE_KEYS.has(key.toLowerCase())) return true
  return (
    normalized.includes('token') ||
    normalized.includes('password') ||
    normalized.includes('secret') ||
    normalized.includes('authorization') ||
    normalized.includes('apikey')
  )
}

export function redactString(value: string): string {
  return value.replace(BEARER_PATTERN, `Bearer ${REDACTED}`).replace(BASIC_AUTH_PATTERN, `Basic ${REDACTED}`)
}

export function redactValue(value: unknown): unknown {
  if (value === null || value === undefined) return value
  if (typeof value === 'string') return redactString(value)
  if (typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(redactValue)
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactString(value.message),
      stack: value.stack ? redactString(value.stack) : undefined,
    }
  }

  const record = value as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(record)) {
    if (isSensitiveKey(key)) {
      out[key] = REDACTED
    } else {
      out[key] = redactValue(val)
    }
  }
  return out
}

export function redactLogMeta(meta?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!meta || Object.keys(meta).length === 0) return meta
  return redactValue(meta) as Record<string, unknown>
}

export function maskSecret(value: string, visibleChars = 4): string {
  if (!value) return ''
  if (value.length <= visibleChars) return '••••••••'
  return `${'•'.repeat(Math.min(12, value.length - visibleChars))}${value.slice(-visibleChars)}`
}
