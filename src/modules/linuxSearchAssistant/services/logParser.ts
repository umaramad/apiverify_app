/**
 * Tolerant parser for structured log lines, two layouts auto-detected:
 *
 *   1. timestamp-first (legacy):
 *        timestamp; businessId; class name with packages; level; message; thread; sessionId
 *
 *   2. server-first (NGTS-style, timestamp in the middle):
 *        server; parentGroup; timestamp; businessGroup; className; errorCode; message…; sessionId; ; threadId
 *
 * Field splitting is anchored at both ends — the timestamp is located by
 * pattern (ISO `YYYY-MM-DD` or `DD/MM/YYYY`), thread + sessionId are read
 * from the back — so a message that itself contains the separator still
 * parses (the extra parts fold into the message). Lines without a timestamp
 * in their leading fields are treated as stack-trace continuations of the
 * previous entry when they look like one, otherwise reported as unparsed
 * with their line numbers so the caller can surface format drift.
 *
 * Pure module (no Electron / no MUI) so it can be unit-tested directly.
 */

export const DEFAULT_LOG_SEPARATOR = ';'

export const KNOWN_LOG_LEVELS = ['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE', 'FATAL'] as const

export interface LogEntry {
  /** 1-based line number of the entry's first line. */
  lineNo: number
  /** The original first line, verbatim. */
  raw: string
  timestamp?: string
  /** Legacy layout field 1 (e.g. ORD-1001). */
  businessId?: string
  /** NGTS server field (e.g. 8:default). */
  server?: string
  /** NGTS parent group field (e.g. /NGTS). */
  parentGroup?: string
  /** NGTS business group field (e.g. MOBILE). */
  businessGroup?: string
  /** Fully-qualified class name ("class name with packages"). */
  className?: string
  /** Angle-bracket error category from the message region (e.g. <COMMONS_ERROR>). */
  errorCode?: string
  /** Normalized level (INFO / WARN / ERROR / ...), brackets stripped, upper-cased. */
  level?: string
  message: string
  /** Web container thread number, e.g. http-nio-8080-exec-3 / WebContainer : 11. */
  thread?: string
  /** Unique session id. */
  sessionId?: string
  /** Continuation lines attached to this entry (stack traces, wrapped text). */
  continuation: string[]
}

export interface UnparsedLine {
  lineNo: number
  text: string
}

export interface LogParseResult {
  entries: LogEntry[]
  unparsed: UnparsedLine[]
}

export interface LogParseOptions {
  /** Field separator. Defaults to ';' — the parser stays configurable. */
  separator?: string
}

/** ISO-ish timestamps: date + time with optional millis (`.` or `,`) and zone. */
const ISO_TS_RE =
  /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:[.,]\d{1,6})?(?:Z|[+-]\d{2}:?\d{2})?/

/** DD/MM/YYYY-style timestamps with millis separated by `:`/`.`/`,` (e.g. 08/05/2026 15:27:53:809). */
const DMY_TS_RE =
  /^\d{1,2}\/\d{1,2}\/\d{4}[ T]\d{1,2}:\d{2}:\d{2}(?:[:.,]\d{1,6})?(?:Z|[+-]\d{2}:?\d{2})?/

/** Lines that clearly continue the previous entry (indent / JVM stack markers). */
const CONTINUATION_RE = /^\s|^at\s|^Caused by:|^Suppressed:|^\.\.\.\s+\d+\s+more/

function isTimestampField(value: string): boolean {
  return ISO_TS_RE.test(value) || DMY_TS_RE.test(value)
}

export function normalizeLevel(raw?: string): string | undefined {
  if (!raw) return undefined
  const clean = raw.replace(/[[\]]/g, '').trim().toUpperCase()
  return clean || undefined
}

/** Infer a level from an angle-bracket error code like <COMMONS_ERROR>. */
export function inferLevelFromErrorCode(code?: string): string | undefined {
  if (!code) return undefined
  const c = code.toUpperCase()
  if (c.includes('FATAL')) return 'FATAL'
  if (c.includes('ERROR') || c.includes('EXCEPTION')) return 'ERROR'
  if (c.includes('WARN')) return 'WARN'
  if (c.includes('INFO')) return 'INFO'
  if (c.includes('DEBUG')) return 'DEBUG'
  return undefined
}

export function parseStructuredLog(text: string, opts?: LogParseOptions): LogParseResult {
  const sep = opts?.separator || DEFAULT_LOG_SEPARATOR
  const entries: LogEntry[] = []
  const unparsed: UnparsedLine[] = []
  const lines = text.split('\n')
  let current: LogEntry | null = null

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    const lineNo = i + 1

    if (!line.trim()) continue

    // Split once per line; both detection and parsing reuse the parts so
    // large windows aren't scanned twice.
    const parts = line.split(sep)
    if (looksLikeEntry(parts)) {
      current = parseEntryLine(parts, lineNo, line, sep)
      entries.push(current)
      continue
    }

    if (current && CONTINUATION_RE.test(line)) {
      current.continuation.push(line)
      continue
    }

    unparsed.push({ lineNo, text: line })
  }

  return { entries, unparsed }
}

/** A new entry starts with a recognizable timestamp in one of its leading fields. */
function looksLikeEntry(parts: string[]): boolean {
  const max = Math.min(4, parts.length)
  for (let i = 0; i < max; i += 1) {
    if (isTimestampField(parts[i].trim())) return true
  }
  return false
}

/** Index of the timestamp field among the leading fields, or -1. */
function findTimestampIndex(parts: string[]): number {
  const max = Math.min(4, parts.length)
  for (let i = 0; i < max; i += 1) {
    if (isTimestampField(parts[i].trim())) return i
  }
  return -1
}

function parseEntryLine(parts: string[], lineNo: number, line: string, sep: string): LogEntry {
  const trimmed = parts.map((p) => p.trim())
  const tsIdx = findTimestampIndex(trimmed)

  // Legacy layout: timestamp is the first field.
  if (tsIdx <= 0) return parseLegacyLine(trimmed, lineNo, line, sep)

  // Server-first layout: timestamp sits after server / parentGroup prefix.
  return parseServerFirstLine(trimmed, tsIdx, lineNo, line, sep)
}

function parseLegacyLine(parts: string[], lineNo: number, line: string, sep: string): LogEntry {
  const take = (i: number): string | undefined =>
    i >= 0 && i < parts.length ? parts[i] || undefined : undefined

  const timestamp = take(0)
  const businessId = take(1)
  const className = take(2)
  // The level slot only exists when something follows it (the message).
  const level = parts.length >= 5 ? normalizeLevel(take(3)) : undefined

  // Thread + sessionId are read from the back so messages containing the
  // separator don't shift them. Everything between level and the tail fields
  // is the message.
  const tailCount = parts.length >= 7 ? 2 : parts.length >= 6 ? 1 : 0
  const messageStart = parts.length <= 4 ? 3 : 4
  const messageEnd = Math.max(messageStart, parts.length - tailCount)
  const message = parts.slice(messageStart, messageEnd).join(`${sep} `)
  const thread = tailCount >= 1 ? take(parts.length - (tailCount === 2 ? 2 : 1)) : undefined
  const sessionId = tailCount >= 2 ? take(parts.length - 1) : undefined

  return {
    lineNo,
    raw: line,
    timestamp,
    businessId,
    className,
    level,
    message,
    thread,
    sessionId,
    continuation: [],
  }
}

function parseServerFirstLine(parts: string[], tsIdx: number, lineNo: number, line: string, sep: string): LogEntry {
  const prefix = parts.slice(0, tsIdx) // server, parentGroup, … (fields beyond 2 are dropped intentionally)
  const post = parts.slice(tsIdx + 1) // businessGroup, className, message…, sessionId, threadId

  const server = prefix[0] || undefined
  const parentGroup = prefix[1] || undefined
  const timestamp = parts[tsIdx]
  const businessGroup = post[0] || undefined
  const className = post[1] || undefined

  // Tail: threadId is the last non-empty field, sessionId the one before it
  // (empty gaps, e.g. the `; ` between sessionId and threadId, are skipped).
  // Guarded like the legacy branch: the tail only exists when at least
  // className + sessionId + threadId sit after businessGroup, i.e. the last
  // non-empty field is at index >= 3 in `post`. Otherwise a truncated line
  // (message but no session/thread) would mislabel its message as the thread.
  let end = post.length - 1
  while (end >= 0 && !post[end]) end -= 1
  const thread = end >= 3 ? post[end] : undefined

  let sIdx = end - 1
  while (sIdx >= 0 && !post[sIdx]) sIdx -= 1
  const sessionId = sIdx >= 2 ? post[sIdx] : undefined

  // Message region: everything between className and sessionId (or to the end
  // when the tail is missing). The first angle-bracket token (e.g.
  // <COMMONS_ERROR>) is exposed as errorCode.
  const midStart = 2
  const midEnd = sessionId !== undefined && sIdx >= midStart ? sIdx : post.length
  const middle = post.slice(midStart, midEnd)
  const errorCode = middle.find((p) => /^<[^>]+>$/.test(p))
  const message = middle.length ? middle.join(`${sep} `) : ''

  return {
    lineNo,
    raw: line,
    timestamp,
    server,
    parentGroup,
    businessGroup,
    className,
    errorCode,
    level: inferLevelFromErrorCode(errorCode),
    message,
    thread,
    sessionId,
    continuation: [],
  }
}
