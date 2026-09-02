import { getLocalDateKey, getStoredTimestampMs, formatLocalDateHeader } from '../../../shared/utils/dateTime'
import type { ValidationRunSource } from '../../../shared/models'
import type { ValidationError } from '../../../shared/models'
import type { HistoryEntry } from '../store/app.store'

export type EndpointStatus = 'passed' | 'failed' | 'skipped'

export interface ParsedEndpointResult {
  entry: HistoryEntry
  status: EndpointStatus
  errors: ValidationError[]
  expectedStatusCodes: string[]
  actualStatus: number
  skipReason?: string
  responseTimeMs: number
  endpointLabel: string
}

export interface ValidationRunSession {
  id: string
  startedAt: string
  runSource: ValidationRunSource
  entries: HistoryEntry[]
  summary: {
    total: number
    passed: number
    failed: number
    skipped: number
    avgResponseTimeMs: number
  }
}

export interface ValidationRunDateGroup {
  dateKey: string
  dateLabel: string
  sessions: ValidationRunSession[]
}

const SESSION_GAP_MS = 5 * 60 * 1000

const SKIP_PATTERNS = [
  /validation skipped/i,
  /no json schema/i,
  /no response body defined/i,
  /response returned a body, but the specification defines no content/i,
  /no json content type/i,
  /empty schema definition/i,
  /no matching response definition/i,
  /no response received/i,
  /network error/i,
  /missing specification/i,
]

function extractExpectedStatusCodes(errors: ValidationError[]): string[] {
  for (const err of errors) {
    const match = err.message.match(/Expected:\s*(.+)$/i)
    if (match) {
      return match[1].split(',').map((s) => s.trim()).filter(Boolean)
    }
  }
  return []
}

function isInformationalOnlyError(errors: ValidationError[], responseStatus: number): boolean {
  if (responseStatus < 200 || responseStatus >= 300 || errors.length === 0) return false

  const isSuccessStatusMismatch =
    (responseStatus === 200 || responseStatus === 201) &&
    errors.every((err) => /status code (200|201) is not defined/i.test(err.message))

  if (isSuccessStatusMismatch) return true

  return errors.every(
    (err) =>
      SKIP_PATTERNS.some((p) => p.test(err.message)) ||
      /response returned a body, but the specification defines no content/i.test(err.message)
  )
}

function isSkipError(errors: ValidationError[], responseStatus: number): string | undefined {
  if (responseStatus === 0) {
    return 'No HTTP response received'
  }
  for (const err of errors) {
    if (SKIP_PATTERNS.some((p) => p.test(err.message))) {
      return err.message
    }
  }
  return undefined
}

function mapLegacyErrors(
  errors?: Array<{
    instancePath?: string
    keyword?: string
    message?: string
  }>
): ValidationError[] {
  if (!errors?.length) return []
  return errors.map((err, i) => ({
    id: `legacy-${i}`,
    path: err.instancePath,
    keyword: err.keyword,
    message: err.message || 'Validation failed',
    severity: 'high' as const,
  }))
}

export function parseEndpointResult(entry: HistoryEntry): ParsedEndpointResult {
  const result = entry.validationResult
  const actualStatus = result?.responseStatus ?? 0
  const responseTimeMs = result?.responseTimeMs ?? 0
  const raw = result?.validationErrors ?? null

  let errors: ValidationError[] = []
  let status: EndpointStatus = 'passed'
  let skipReason: string | undefined

  if (!raw) {
    status = actualStatus === 0 ? 'skipped' : 'passed'
    if (status === 'skipped') skipReason = 'No HTTP response received'
  } else {
    try {
      const parsed = JSON.parse(raw)

      if (Array.isArray(parsed)) {
        errors = parsed as ValidationError[]
        if (errors.length === 0) {
          status = actualStatus === 0 ? 'skipped' : 'passed'
        } else if (isInformationalOnlyError(errors, actualStatus)) {
          status = 'passed'
        } else {
          skipReason = isSkipError(errors, actualStatus)
          status = skipReason ? 'skipped' : 'failed'
        }
      } else if (parsed && typeof parsed === 'object') {
        if ('valid' in parsed) {
          const legacy = parsed as {
            valid?: boolean
            message?: string
            errors?: Array<{ instancePath?: string; keyword?: string; message?: string }>
          }
          if (legacy.valid === true) {
            status = legacy.message?.toLowerCase().includes('skipped') ? 'skipped' : 'passed'
            skipReason = status === 'skipped' ? legacy.message : undefined
          } else {
            errors = mapLegacyErrors(legacy.errors)
            if (legacy.message && errors.length === 0) {
              errors = [{ id: 'legacy-msg', message: legacy.message, severity: 'high' }]
            }
            skipReason = isSkipError(errors, actualStatus)
            status = skipReason ? 'skipped' : 'failed'
          }
        }
      }
    } catch {
      errors = [{ id: 'parse-err', message: raw, severity: 'high' }]
      status = 'failed'
    }
  }

  if (actualStatus === 0 && status === 'passed') {
    status = 'skipped'
    skipReason = skipReason || 'No HTTP response received'
  }

  const endpointLabel = extractEndpointLabel(entry.url, entry.method)

  return {
    entry,
    status,
    errors,
    expectedStatusCodes: extractExpectedStatusCodes(errors),
    actualStatus,
    skipReason,
    responseTimeMs,
    endpointLabel,
  }
}

export function extractEndpointLabel(url: string, method: string): string {
  try {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const u = new URL(url)
      return `${method.toUpperCase()} ${u.pathname}`
    }
  } catch {
    // fall through
  }
  const path = url.split('?')[0]
  return `${method.toUpperCase()} ${path}`
}

export function groupHistoryIntoSessions(history: HistoryEntry[]): ValidationRunSession[] {
  if (history.length === 0) return []

  const batched = history.filter((entry) => entry.batchId)
  const legacy = history.filter((entry) => !entry.batchId)

  const sessions = [
    ...groupEntriesByBatchId(batched),
    ...groupEntriesByTimeGap(legacy),
  ]

  return sessions.sort(
    (a, b) => getStoredTimestampMs(b.startedAt) - getStoredTimestampMs(a.startedAt)
  )
}

function groupEntriesByBatchId(history: HistoryEntry[]): ValidationRunSession[] {
  const groups = new Map<string, HistoryEntry[]>()

  for (const entry of history) {
    const batchId = entry.batchId
    if (!batchId) continue
    const existing = groups.get(batchId) ?? []
    existing.push(entry)
    groups.set(batchId, existing)
  }

  return Array.from(groups.entries()).map(([batchId, entries]) => {
    const sorted = [...entries].sort(
      (a, b) => getStoredTimestampMs(b.createdAt) - getStoredTimestampMs(a.createdAt)
    )
    const anchorTime = getStoredTimestampMs(sorted[0]?.createdAt)
    return buildSession(sorted, batchId, anchorTime)
  })
}

function groupEntriesByTimeGap(history: HistoryEntry[]): ValidationRunSession[] {
  if (history.length === 0) return []

  const sorted = [...history].sort(
    (a, b) => getStoredTimestampMs(b.createdAt) - getStoredTimestampMs(a.createdAt)
  )

  const sessions: ValidationRunSession[] = []
  let currentEntries: HistoryEntry[] = [sorted[0]]
  let anchorTime = getStoredTimestampMs(sorted[0].createdAt)

  for (let i = 1; i < sorted.length; i++) {
    const entry = sorted[i]
    const entryTime = getStoredTimestampMs(entry.createdAt)
    const oldestInGroup = getStoredTimestampMs(currentEntries[currentEntries.length - 1].createdAt)

    if (oldestInGroup - entryTime > SESSION_GAP_MS) {
      sessions.push(buildSession(currentEntries, buildLegacySessionId(currentEntries, anchorTime), anchorTime))
      currentEntries = [entry]
      anchorTime = entryTime
    } else {
      currentEntries.push(entry)
    }
  }

  sessions.push(buildSession(currentEntries, buildLegacySessionId(currentEntries, anchorTime), anchorTime))
  return sessions
}

function buildLegacySessionId(entries: HistoryEntry[], anchorTime: number): string {
  const oldestEntry = entries[entries.length - 1]
  return oldestEntry?.id ?? String(anchorTime)
}

export function groupSessionsByDate(sessions: ValidationRunSession[]): ValidationRunDateGroup[] {
  const groups: ValidationRunDateGroup[] = []
  const indexByDate = new Map<string, number>()

  for (const session of sessions) {
    const dateKey = getLocalDateKey(session.startedAt)
    const existingIndex = indexByDate.get(dateKey)

    if (existingIndex === undefined) {
      indexByDate.set(dateKey, groups.length)
      groups.push({
        dateKey,
        dateLabel: formatLocalDateHeader(session.startedAt) || dateKey,
        sessions: [session],
      })
      continue
    }

    groups[existingIndex].sessions.push(session)
  }

  return groups
}

function buildSession(
  entries: HistoryEntry[],
  sessionId: string,
  anchorTime: number
): ValidationRunSession {
  const parsed = entries.map(parseEndpointResult)
  const passed = parsed.filter((p) => p.status === 'passed').length
  const failed = parsed.filter((p) => p.status === 'failed').length
  const skipped = parsed.filter((p) => p.status === 'skipped').length
  const totalTime = parsed.reduce((sum, p) => sum + p.responseTimeMs, 0)
  const runSource = entries.every((entry) => entry.runSource === 'scheduler') ? 'scheduler' : 'manual'

  return {
    id: sessionId,
    startedAt: entries[0]?.createdAt ?? new Date(anchorTime).toISOString(),
    runSource,
    entries,
    summary: {
      total: entries.length,
      passed,
      failed,
      skipped,
      avgResponseTimeMs: entries.length > 0 ? Math.round(totalTime / entries.length) : 0,
    },
  }
}

export function formatResponseBodyPreview(body: string | null | undefined): string {
  if (!body) return 'No response body'
  try {
    return JSON.stringify(JSON.parse(body), null, 2)
  } catch {
    return body
  }
}

export function formatRequestBodyPreview(body: string | null | undefined): string {
  if (!body) return 'No request body'
  return formatResponseBodyPreview(body)
}

export function parseRequestHeaders(headersJson: string | undefined | null): Record<string, string> {
  if (!headersJson) return {}
  try {
    const parsed = JSON.parse(headersJson) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return Object.fromEntries(
        Object.entries(parsed as Record<string, unknown>).map(([key, value]) => [key, String(value)])
      )
    }
  } catch {
    // fall through
  }
  return {}
}

export function parseResponseHeaders(headersJson: string | undefined | null): Record<string, string> {
  return parseRequestHeaders(headersJson)
}

export function parseQueryParamsFromUrl(url: string): Array<{ key: string; value: string }> {
  try {
    const queryString =
      url.startsWith('http://') || url.startsWith('https://')
        ? new URL(url).search
        : url.includes('?')
          ? `?${url.split('?')[1]}`
          : ''

    if (!queryString || queryString === '?') return []

    const params = new URLSearchParams(queryString.startsWith('?') ? queryString.slice(1) : queryString)
    const result: Array<{ key: string; value: string }> = []
    params.forEach((value, key) => {
      result.push({ key, value })
    })
    return result
  } catch {
    return []
  }
}

export function formatKeyValuePreview(
  items: Record<string, string> | Array<{ key: string; value: string }>
): string {
  if (Array.isArray(items)) {
    if (items.length === 0) return 'None'
    return JSON.stringify(Object.fromEntries(items.map(({ key, value }) => [key, value])), null, 2)
  }

  if (Object.keys(items).length === 0) return 'None'
  return JSON.stringify(items, null, 2)
}

export function matchesSearch(parsed: ParsedEndpointResult, query: string): boolean {
  if (!query.trim()) return true
  const q = query.toLowerCase()
  const { entry, errors, endpointLabel } = parsed
  const haystack = [
    entry.url,
    entry.method,
    endpointLabel,
    ...errors.map((e) => e.message),
    ...errors.map((e) => e.path || ''),
  ]
    .join(' ')
    .toLowerCase()
  return haystack.includes(q)
}
