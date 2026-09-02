import { useCallback, useEffect, useState } from 'react'
import type {
  RecentActionInput,
  RecentActionRecord,
  RecentActionsPreferences,
} from '../../models'

type LogicalActionApiResult = Awaited<
  ReturnType<typeof window.api.linuxSearchAssistantExecuteLogicalAction>
>

export function useRecentActions(): {
  actions: RecentActionRecord[]
  preferences: RecentActionsPreferences | null
  filter: string
  setFilter: (value: string) => void
  loading: boolean
  error: string | null
  lastResult: LogicalActionApiResult | null
  refresh: () => Promise<void>
  replay: (actionId: string) => Promise<LogicalActionApiResult>
  execute: (action: RecentActionInput) => Promise<LogicalActionApiResult>
  executeBatch: (actions: RecentActionInput[]) => Promise<{
    ok: boolean
    results: LogicalActionApiResult[]
  }>
  setPinned: (actionId: string, pinned: boolean) => Promise<void>
  remove: (actionId: string) => Promise<void>
  clearUnpinned: () => Promise<void>
  setHistorySize: (size: number) => Promise<void>
} {
  const [actions, setActions] = useState<RecentActionRecord[]>([])
  const [preferences, setPreferences] = useState<RecentActionsPreferences | null>(null)
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<LogicalActionApiResult | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [nextActions, prefs] = await Promise.all([
        window.api.linuxSearchAssistantListRecentActions(filter || undefined),
        window.api.linuxSearchAssistantGetRecentActionsPrefs(),
      ])
      setActions(nextActions)
      setPreferences(prefs)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load recent actions.')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void refresh()
    }, 120)
    return () => window.clearTimeout(handle)
  }, [refresh])

  const replay = useCallback(
    async (actionId: string) => {
      setError(null)
      const result = await window.api.linuxSearchAssistantReplayRecentAction(actionId)
      setLastResult(result)
      if (!result.ok) setError(result.message || 'Replay failed.')
      await refresh()
      return result
    },
    [refresh]
  )

  const execute = useCallback(
    async (action: RecentActionInput) => {
      setError(null)
      const result = await window.api.linuxSearchAssistantExecuteLogicalAction(action)
      setLastResult(result)
      if (!result.ok) setError(result.message || 'Action failed.')
      await refresh()
      return result
    },
    [refresh]
  )

  const executeBatch = useCallback(
    async (actions: RecentActionInput[]) => {
      setError(null)
      if (actions.length === 1) {
        const one = await execute(actions[0])
        return { ok: one.ok, results: [one] }
      }
      const batch = await window.api.linuxSearchAssistantExecuteLogicalActionBatch(actions)
      const firstFail = batch.results.find((r) => !r.ok)
      if (firstFail) setError(firstFail.message || 'Action failed.')
      setLastResult(batch.results[batch.results.length - 1] ?? null)
      await refresh()
      return batch
    },
    [execute, refresh]
  )

  return {
    actions,
    preferences,
    filter,
    setFilter,
    loading,
    error,
    lastResult,
    refresh,
    replay,
    execute,
    executeBatch,
    setPinned: async (actionId, pinned) => {
      await window.api.linuxSearchAssistantSetRecentActionPinned(actionId, pinned)
      await refresh()
    },
    remove: async (actionId) => {
      await window.api.linuxSearchAssistantRemoveRecentAction(actionId)
      await refresh()
    },
    clearUnpinned: async () => {
      await window.api.linuxSearchAssistantClearUnpinnedRecentActions()
      await refresh()
    },
    setHistorySize: async (size) => {
      await window.api.linuxSearchAssistantSetRecentActionsHistorySize(size)
      await refresh()
    },
  }
}
