import { useCallback, useEffect, useState } from 'react'
import type { LinuxSearchAssistantConfigDocument, LinuxSearchTargetConfig } from '../../models'

export function useLinuxSearchConfig(): {
  document: LinuxSearchAssistantConfigDocument | null
  targets: LinuxSearchTargetConfig[]
  loading: boolean
  error: string | null
  refresh: (opts?: { silent?: boolean }) => Promise<void>
  save: (document: LinuxSearchAssistantConfigDocument) => Promise<void>
} {
  const [document, setDocument] = useState<LinuxSearchAssistantConfigDocument | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true)
    setError(null)
    try {
      const next = await window.api.linuxSearchAssistantGetConfig()
      setDocument((prev) => {
        // Avoid re-render storms when config is unchanged (multi-server connect).
        try {
          if (prev && JSON.stringify(prev) === JSON.stringify(next)) return prev
        } catch {
          /* fall through */
        }
        return next
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load configuration.')
    } finally {
      if (!opts?.silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return {
    document,
    targets: document?.targets ?? [],
    loading,
    error,
    refresh,
    save: async (next) => {
      const saved = await window.api.linuxSearchAssistantSaveConfig(next)
      setDocument(saved)
    },
  }
}
