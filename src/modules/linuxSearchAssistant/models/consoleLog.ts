/** Console log lines pushed from main → renderer for Linux Search Assistant. */
export type LinuxSearchConsoleLevel = 'info' | 'warn' | 'error' | 'debug'

export interface LinuxSearchConsoleLogEvent {
  type: 'consoleLog'
  level: LinuxSearchConsoleLevel
  message: string
  /** ISO timestamp */
  timestamp: string
  /** Optional source tag, e.g. ssh | search | action */
  source?: string
}
