import { useCallback, useEffect, useState } from 'react'
import type { AskAiConfig } from '../../models'
import { EMPTY_ASK_AI_CONFIG } from '../../models'

export function useAskAiConfig(): {
  config: AskAiConfig
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  save: (next: AskAiConfig) => Promise<AskAiConfig>
} {
  const [config, setConfig] = useState<AskAiConfig>(EMPTY_ASK_AI_CONFIG)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const next = await window.api.linuxSearchAssistantGetAskAiConfig()
      setConfig(next)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Ask AI settings.')
      setConfig(EMPTY_ASK_AI_CONFIG)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return {
    config,
    loading,
    error,
    refresh,
    save: async (next) => {
      const saved = await window.api.linuxSearchAssistantSaveAskAiConfig(next)
      setConfig(saved)
      return saved
    },
  }
}
