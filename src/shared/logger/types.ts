export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export type LogMeta = Record<string, unknown>

export interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  meta?: LogMeta
}

/**
 * Pluggable log sink. Implement this interface to add transports
 * (e.g. console, file, or a future Winston-backed adapter).
 */
export interface LogTransport {
  log(entry: LogEntry): void
  flush?(): void | Promise<void>
  close?(): void | Promise<void>
}

export interface LoggerOptions {
  /** Minimum level to emit. Default: debug */
  level?: LogLevel
  /** Transports to write log entries to */
  transports?: LogTransport[]
  /** Context label prepended to every message (e.g. service name) */
  context?: string
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

export function shouldLog(configuredLevel: LogLevel, entryLevel: LogLevel): boolean {
  return LEVEL_PRIORITY[entryLevel] >= LEVEL_PRIORITY[configuredLevel]
}

export function formatLogLine(entry: LogEntry, context?: string): string {
  const prefix = context ? `[${context}] ` : ''
  const meta =
    entry.meta && Object.keys(entry.meta).length > 0 ? ` ${JSON.stringify(entry.meta)}` : ''
  return `${entry.timestamp} [${entry.level.toUpperCase()}] ${prefix}${entry.message}${meta}`
}

export { LEVEL_PRIORITY }
