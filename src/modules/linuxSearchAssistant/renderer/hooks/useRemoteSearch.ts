import { useCallback, useState } from 'react'
import type { RemoteSearchRequest, RemoteSearchResult } from '../../models'

/**
 * Invokes SearchService via IPC. Never handles passwords —
 * SESSION_REQUIRED / connectRequired events open the SSH dialog instead.
 */
export function useRemoteSearch(): {
  searching: boolean
  result: RemoteSearchResult | null
  error: string | null
  search: (request: RemoteSearchRequest) => Promise<RemoteSearchResult>
  clear: () => void
} {
  const [searching, setSearching] = useState(false)
  const [result, setResult] = useState<RemoteSearchResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const search = useCallback(async (request: RemoteSearchRequest) => {
    setSearching(true)
    setError(null)
    try {
      const next = await window.api.linuxSearchAssistantRemoteSearch(request)
      setResult(next)
      if (!next.ok) {
        setError(next.message)
      }
      return next
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Remote search failed.'
      setError(message)
      const failed: RemoteSearchResult = {
        ok: false,
        code: 'EXECUTION_FAILED',
        message,
      }
      setResult(failed)
      return failed
    } finally {
      setSearching(false)
    }
  }, [])

  return {
    searching,
    result,
    error,
    search,
    clear: () => {
      setResult(null)
      setError(null)
    },
  }
}
