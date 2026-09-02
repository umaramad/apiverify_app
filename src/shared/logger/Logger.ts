import type { LogLevel, LogMeta, LogTransport, LoggerOptions } from './types'
import { shouldLog } from './types'
import { ConsoleTransport } from './transports/consoleTransport'
import { FileTransport, resolveDefaultLogFilePath } from './transports/fileTransport'
import { redactLogMeta, redactString } from '../security/redact'

function normalizeErrorMeta(meta?: LogMeta | Error): LogMeta | undefined {
  if (!meta) return undefined
  if (meta instanceof Error) {
    return {
      name: meta.name,
      message: meta.message,
      stack: meta.stack,
    }
  }
  return meta
}

export class Logger {
  private level: LogLevel
  private transports: LogTransport[]
  private context?: string

  constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? 'debug'
    this.context = options.context
    this.transports =
      options.transports ??
      createDefaultTransports()
  }

  debug(message: string, meta?: LogMeta): void {
    this.write('debug', message, meta)
  }

  info(message: string, meta?: LogMeta): void {
    this.write('info', message, meta)
  }

  warn(message: string, meta?: LogMeta): void {
    this.write('warn', message, meta)
  }

  error(message: string, meta?: LogMeta | Error): void {
    this.write('error', message, normalizeErrorMeta(meta))
  }

  /** Replace transports at runtime (e.g. swap in a Winston adapter). */
  setTransports(transports: LogTransport[]): void {
    this.transports = transports
  }

  /** Add a transport without replacing existing ones. */
  addTransport(transport: LogTransport): void {
    this.transports.push(transport)
  }

  getTransports(): readonly LogTransport[] {
    return this.transports
  }

  setLevel(level: LogLevel): void {
    this.level = level
  }

  getLevel(): LogLevel {
    return this.level
  }

  child(context: string): Logger {
    const childContext = this.context ? `${this.context}:${context}` : context
    const child = new Logger({
      level: this.level,
      transports: [...this.transports],
      context: childContext,
    })
    return child
  }

  async flush(): Promise<void> {
    await Promise.all(
      this.transports.map((t) => {
        const result = t.flush?.()
        return result instanceof Promise ? result : Promise.resolve()
      })
    )
  }

  async close(): Promise<void> {
    await Promise.all(
      this.transports.map((t) => {
        const result = t.close?.()
        return result instanceof Promise ? result : Promise.resolve()
      })
    )
  }

  private write(level: LogLevel, message: string, meta?: LogMeta): void {
    if (!shouldLog(this.level, level)) return

    const formattedMessage = this.context ? `[${this.context}] ${message}` : message
    const entry = {
      level,
      message: redactString(formattedMessage),
      timestamp: new Date().toISOString(),
      meta: meta ? redactLogMeta(meta) : undefined,
    }

    for (const transport of this.transports) {
      try {
        transport.log(entry)
      } catch (err) {
        console.error('Logger transport failed:', err)
      }
    }
  }
}

export function createDefaultTransports(): LogTransport[] {
  return [new ConsoleTransport(), new FileTransport(resolveDefaultLogFilePath())]
}

export function createLogger(options?: LoggerOptions): Logger {
  return new Logger(options)
}

let defaultLogger: Logger | null = null

export function getLogger(): Logger {
  if (!defaultLogger) {
    defaultLogger = createLogger()
  }
  return defaultLogger
}

/** Replace the process-wide logger (e.g. with a Winston-backed instance). */
export function configureLogger(logger: Logger): void {
  defaultLogger = logger
}

/**
 * Example future integration:
 *
 * class WinstonTransport implements LogTransport {
 *   constructor(private winston: winston.Logger) {}
 *   log(entry: LogEntry): void {
 *     this.winston.log(entry.level, entry.message, entry.meta)
 *   }
 * }
 *
 * configureLogger(createLogger({ transports: [new WinstonTransport(winstonInstance)] }))
 */
