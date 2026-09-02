import { useCallback, useEffect, useState } from 'react'
import type {
  SearchConnectRequiredEvent,
  SshSessionExpiredEvent,
  SshSessionHandle,
} from '../../models'

/**
 * Tracks multiple active SSH session handles (one per serverId).
 * Never stores passwords — reconnect opens the connection dialog empty.
 */
export function useSshSessionManager(): {
  sessions: SshSessionHandle[]
  activeServerId: string | null
  setActiveServerId: (serverId: string | null) => void
  activeSession: SshSessionHandle | null
  upsertSession: (session: SshSessionHandle) => void
  removeSession: (serverId: string) => void
  refreshSessions: () => Promise<void>
  expiredEvent: SshSessionExpiredEvent | null
  clearExpiredEvent: () => void
  reconnectPrefill: SshSessionExpiredEvent['reconnect'] | null
  connectRequired: SearchConnectRequiredEvent | null
  clearConnectRequired: () => void
} {
  const [sessions, setSessions] = useState<SshSessionHandle[]>([])
  const [activeServerId, setActiveServerId] = useState<string | null>(null)
  const [expiredEvent, setExpiredEvent] = useState<SshSessionExpiredEvent | null>(null)
  const [connectRequired, setConnectRequired] = useState<SearchConnectRequiredEvent | null>(null)

  const refreshSessions = useCallback(async (): Promise<void> => {
    try {
      const listed = await window.api.linuxSearchAssistantSshListSessions()
      const next = Array.isArray(listed) ? listed.filter((s) => s?.connected) : []
      setSessions(next)
      setActiveServerId((current) => {
        if (current && next.some((s) => s.serverId === current)) return current
        return next[0]?.serverId ?? null
      })
    } catch {
      /* keep local state */
    }
  }, [])

  useEffect(() => {
    void refreshSessions()
  }, [refreshSessions])

  useEffect(() => {
    const unsubscribeExpired = window.api.onLinuxSearchAssistantSessionExpired((event) => {
      setSessions((prev) => prev.filter((s) => s.serverId !== event.session.serverId))
      setActiveServerId((current) => {
        if (current !== event.session.serverId) return current
        return null
      })
      setExpiredEvent(event)
    })
    const unsubscribeConnect = window.api.onLinuxSearchAssistantConnectRequired((event) => {
      setConnectRequired(event)
    })
    return () => {
      unsubscribeExpired()
      unsubscribeConnect()
    }
  }, [])

  useEffect(() => {
    setActiveServerId((current) => {
      if (current && sessions.some((s) => s.serverId === current)) return current
      return sessions[0]?.serverId ?? null
    })
  }, [sessions])

  const upsertSession = useCallback((session: SshSessionHandle): void => {
    setSessions((prev) => {
      const without = prev.filter((s) => s.serverId !== session.serverId)
      return [...without, session]
    })
    setActiveServerId(session.serverId)
  }, [])

  const removeSession = useCallback((serverId: string): void => {
    setSessions((prev) => prev.filter((s) => s.serverId !== serverId))
    setActiveServerId((current) => (current === serverId ? null : current))
  }, [])

  const activeSession = sessions.find((s) => s.serverId === activeServerId) ?? null

  return {
    sessions,
    activeServerId,
    setActiveServerId,
    activeSession,
    upsertSession,
    removeSession,
    refreshSessions,
    expiredEvent,
    clearExpiredEvent: () => setExpiredEvent(null),
    reconnectPrefill: expiredEvent?.reconnect ?? null,
    connectRequired,
    clearConnectRequired: () => setConnectRequired(null),
  }
}
