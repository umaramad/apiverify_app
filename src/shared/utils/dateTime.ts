const SQLITE_TIMESTAMP_RE = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}(?:\.\d+)?)$/

/**
 * Parses timestamps stored by SQLite (UTC, no timezone suffix) and ISO strings.
 */
export function parseStoredTimestamp(value: string | null | undefined): Date {
  if (!value) return new Date(Number.NaN)

  const trimmed = value.trim()
  if (!trimmed) return new Date(Number.NaN)

  if (/[zZ]$/.test(trimmed) || /[+-]\d{2}:\d{2}$/.test(trimmed)) {
    return new Date(trimmed)
  }

  if (trimmed.includes('T')) {
    return new Date(trimmed.endsWith('Z') ? trimmed : `${trimmed}Z`)
  }

  const sqliteMatch = SQLITE_TIMESTAMP_RE.exec(trimmed)
  if (sqliteMatch) {
    return new Date(`${sqliteMatch[1]}T${sqliteMatch[2]}Z`)
  }

  return new Date(trimmed)
}

export function formatLocalDateTime(
  value: string | null | undefined,
  options?: Intl.DateTimeFormatOptions,
  locale?: string
): string {
  const date = parseStoredTimestamp(value)
  if (Number.isNaN(date.getTime())) return ''

  return date.toLocaleString(locale, options)
}

export function formatLocalDateTimeFull(value: string | null | undefined, locale?: string): string {
  return formatLocalDateTime(
    value,
    {
      dateStyle: 'full',
      timeStyle: 'medium',
    },
    locale
  )
}

export function getLocalDateKey(value: string | null | undefined): string {
  const date = parseStoredTimestamp(value)
  if (Number.isNaN(date.getTime())) return 'unknown'

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatLocalDateHeader(value: string | null | undefined, locale?: string): string {
  return formatLocalDateTime(value, { dateStyle: 'full' }, locale)
}

export function formatLocalTime(value: string | null | undefined, locale?: string): string {
  return formatLocalDateTime(
    value,
    {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    },
    locale
  )
}

export function getStoredTimestampMs(value: string | null | undefined): number {
  const date = parseStoredTimestamp(value)
  return Number.isNaN(date.getTime()) ? 0 : date.getTime()
}
