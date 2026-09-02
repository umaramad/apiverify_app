import type { LogEntry, LogTransport } from '../types'
import { formatLogLine } from '../types'

export interface ConsoleTransportOptions {
  /** Write debug/info to stdout and warn/error to stderr. Default: true */
  useStderrForWarnings?: boolean
}

export class ConsoleTransport implements LogTransport {
  private useStderrForWarnings: boolean

  constructor(options: ConsoleTransportOptions = {}) {
    this.useStderrForWarnings = options.useStderrForWarnings ?? true
  }

  log(entry: LogEntry): void {
    const line = formatLogLine(entry)

    if (this.useStderrForWarnings && (entry.level === 'warn' || entry.level === 'error')) {
      console.error(line)
      return
    }

    switch (entry.level) {
      case 'debug':
        console.debug(line)
        break
      case 'info':
        console.info(line)
        break
      case 'warn':
        console.warn(line)
        break
      case 'error':
        console.error(line)
        break
    }
  }
}
