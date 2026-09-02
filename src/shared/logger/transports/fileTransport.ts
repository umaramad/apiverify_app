import fs from 'fs'
import path from 'path'
import type { LogEntry, LogTransport } from '../types'
import { formatLogLine } from '../types'

export interface FileTransportOptions {
  /** Absolute path to the log file */
  filePath: string
  /** Ensure parent directory exists. Default: true */
  ensureDir?: boolean
}

export function resolveDefaultLogFilePath(): string {
  try {
    const { app } = require('electron') as { app?: { getPath: (name: string) => string } }
    if (app?.getPath) {
      return path.join(app.getPath('userData'), 'logs', 'validator.log')
    }
  } catch {
    // Not in Electron (tests, scripts)
  }

  if (process.env.NODE_ENV === 'test') {
    return path.join(process.cwd(), 'logs', 'test-validator.log')
  }

  return path.join(process.cwd(), 'logs', 'validator.log')
}

export class FileTransport implements LogTransport {
  private filePath: string
  private ensureDir: boolean

  constructor(options: FileTransportOptions | string) {
    if (typeof options === 'string') {
      this.filePath = options
      this.ensureDir = true
    } else {
      this.filePath = options.filePath
      this.ensureDir = options.ensureDir ?? true
    }
  }

  log(entry: LogEntry): void {
    const line = formatLogLine(entry)

    if (this.ensureDir) {
      const dir = path.dirname(this.filePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
    }

    fs.appendFileSync(this.filePath, `${line}\n`, 'utf8')
  }
}
