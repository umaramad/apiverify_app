import { useCallback, useEffect, useState } from 'react'
import type { LinuxSearchConsoleLogEvent } from '../../models'

const MAX_LOGS = 500
const EXPANDED_KEY = 'linuxSearchAssistant.consoleExpanded'

export interface LinuxSearchConsoleEntry extends LinuxSearchConsoleLogEvent {
  id: string
}

function loadExpanded(): boolean {
  try {
    const raw = localStorage.getItem(EXPANDED_KEY)
    if (raw === null) return true
    return raw === '1' || raw === 'true'
  } catch {
    return true
  }
}

/**
 * Live console lines from main (SSH connect, remote grep/find, actions).
 */
export function useLinuxSearchConsole(): {
  logs: LinuxSearchConsoleEntry[]
  expanded: boolean
  setExpanded: (expanded: boolean) => void
  clear: () => void
  appendLocal: (level: LinuxSearchConsoleLogEvent['level'], message: string, source?: string) => void
} {
  const [logs, setLogs] = useState<LinuxSearchConsoleEntry[]>([])
  const [expanded, setExpandedState] = useState(loadExpanded)

  const setExpanded = useCallback((next: boolean) => {
    setExpandedState(next)
    try {
      localStorage.setItem(EXPANDED_KEY, next ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [])

  const clear = useCallback(() => setLogs([]), [])

  const appendLocal = useCallback(
    (level: LinuxSearchConsoleLogEvent['level'], message: string, source?: string) => {
      setLogs((prev) => {
        const entry: LinuxSearchConsoleEntry = {
          id: `${Date.now()}-${prev.length}`,
          type: 'consoleLog',
          level,
          message,
          timestamp: new Date().toISOString(),
          source,
        }
        const next = [...prev, entry]
        return next.length > MAX_LOGS ? next.slice(-MAX_LOGS) : next
      })
    },
    []
  )

  useEffect(() => {
    const unsubscribe = window.api.onLinuxSearchAssistantConsoleLog((event) => {
      setLogs((prev) => {
        const entry: LinuxSearchConsoleEntry = {
          ...event,
          id: `${event.timestamp}-${prev.length}`,
        }
        const next = [...prev, entry]
        return next.length > MAX_LOGS ? next.slice(-MAX_LOGS) : next
      })
    })
    return unsubscribe
  }, [])

  return { logs, expanded, setExpanded, clear, appendLocal }
}
