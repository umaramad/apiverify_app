import { useCallback, useEffect, useState } from 'react'
import type { LinuxSearchAssistantModuleStatus, LinuxSearchQuery, LinuxSearchResponse } from '../../models'

export function useLinuxSearchAssistantStatus(): {
  status: LinuxSearchAssistantModuleStatus | null
  loading: boolean
  refresh: () => Promise<void>
  setEnabled: (enabled: boolean) => Promise<void>
} {
  const [status, setStatus] = useState<LinuxSearchAssistantModuleStatus | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const next = await window.api.linuxSearchAssistantGetStatus()
      setStatus(next)
    } finally {
      setLoading(false)
    }
  }, [])

  const setEnabled = useCallback(async (enabled: boolean) => {
    const next = await window.api.linuxSearchAssistantSetEnabled(enabled)
    setStatus(next)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { status, loading, refresh, setEnabled }
}

export function useLinuxSearch(): {
  searching: boolean
  result: LinuxSearchResponse | null
  error: string | null
  search: (query: LinuxSearchQuery) => Promise<void>
  clear: () => void
} {
  const [searching, setSearching] = useState(false)
  const [result, setResult] = useState<LinuxSearchResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const search = useCallback(async (query: LinuxSearchQuery) => {
    setSearching(true)
    setError(null)
    try {
      const next = await window.api.linuxSearchAssistantSearch(query)
      setResult(next)
    } catch (err) {
      setResult(null)
      setError(err instanceof Error ? err.message : 'Search failed.')
    } finally {
      setSearching(false)
    }
  }, [])

  const clear = useCallback(() => {
    setResult(null)
    setError(null)
  }, [])

  return { searching, result, error, search, clear }
}
