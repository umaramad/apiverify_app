import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  MenuItem,
  Select,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import CloseIcon from '@mui/icons-material/Close'
import HistoryIcon from '@mui/icons-material/History'
import { toSshServerIdentity, LINUX_SEARCH_ASSISTANT_PAGE_ID } from '../../models'
import type { LinuxSearchTargetConfig, RecentActionInput, SshSessionHandle } from '../../models'
import { useAppStore } from '../../../../renderer/src/store/app.store'
import CommandTutorialsDialog from '../components/CommandTutorialsDialog'
import LinuxSearchConsolePanel from '../components/LinuxSearchConsolePanel'
import LinuxSearchOutputPanel, { type OutputViewMode } from '../components/LinuxSearchOutputPanel'
import LogicalActionForm from '../components/LogicalActionForm'
import RecentActionsPanel from '../components/RecentActionsPanel'
import SshConnectionDialog from '../components/SshConnectionDialog'
import { useLinuxSearchAssistantStatus } from '../hooks/useLinuxSearch'
import { useLinuxSearchConfig } from '../hooks/useLinuxSearchConfig'
import { useLinuxSearchConsole } from '../hooks/useLinuxSearchConsole'
import { useRecentActions } from '../hooks/useRecentActions'
import { useSshSessionManager } from '../hooks/useSshSessionManager'
import { useAskAiConfig } from '../hooks/useAskAiConfig'
import type { AskAiMode } from '../../models'

const RECENT_EXPANDED_KEY = 'linuxSearchAssistant.recentActionsExpanded'

function loadRecentExpanded(): boolean {
  try {
    const raw = localStorage.getItem(RECENT_EXPANDED_KEY)
    if (raw === null) return true
    return raw === '1' || raw === 'true'
  } catch {
    return true
  }
}

type PathTabState = {
  tabId: string
  pathId: string
  output: string | null
  busy: boolean
  followSpec: RecentActionInput | null
  exportFileName: string | null
  /** Raw vs Analyze (Log Analysis tree) for this path tab's output. */
  viewMode: OutputViewMode
}

type ServerWorkspaceState = {
  pathTabs: PathTabState[]
  activePathTabId: string
}

function collectEnabledPaths(target: LinuxSearchTargetConfig | undefined): Array<{
  id: string
  label: string
}> {
  if (!target) return []
  return [...target.logPaths, ...target.configPaths, ...target.searchPaths]
    .filter((p) => p.enabled && p.id)
    .map((p) => ({ id: p.id, label: p.label || p.path || p.id }))
}

function createPathTab(pathId: string): PathTabState {
  return {
    tabId: `path-${pathId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    pathId,
    output: null,
    busy: false,
    followSpec: null,
    exportFileName: null,
    viewMode: 'raw',
  }
}

function emptyServerWorkspace(pathId?: string): ServerWorkspaceState {
  if (!pathId) return { pathTabs: [], activePathTabId: '' }
  const tab = createPathTab(pathId)
  return { pathTabs: [tab], activePathTabId: tab.tabId }
}

function tabLabel(
  session: SshSessionHandle,
  targets: { id: string; applicationName?: string; serverName?: string }[]
): string {
  const target = targets.find((t) => t.id === session.serverId)
  const name = target?.applicationName || target?.serverName || session.server || session.host
  return `${name} · ${session.username}@${session.host}`
}

function suggestExportName(actions: RecentActionInput[]): string | null {
  const names = actions.map((a) => a.fileName).filter((n): n is string => Boolean(n && n.trim()))
  if (names.length === 1) return names[0]
  if (names.length > 1) return `${names[0]}-and-${names.length - 1}-more.log`
  return null
}

/**
 * Linux Search Assistant — outer server tabs, inner path tabs (same SSH), multi-file batch grep.
 */
export default function LinuxSearchAssistantPage(): React.JSX.Element {
  const { status, loading: statusLoading } = useLinuxSearchAssistantStatus()
  const {
    sessions,
    activeServerId,
    setActiveServerId,
    activeSession,
    upsertSession,
    removeSession,
    expiredEvent,
    clearExpiredEvent,
    reconnectPrefill,
    connectRequired,
    clearConnectRequired,
  } = useSshSessionManager()
  const { targets, refresh: refreshTargets, error: configError } = useLinuxSearchConfig()
  const recent = useRecentActions()
  const consolePanel = useLinuxSearchConsole()
  const { config: askAiConfig, refresh: refreshAskAi } = useAskAiConfig()
  const activePage = useAppStore((s) => s.activePage)
  const [connectOpen, setConnectOpen] = useState(false)
  const [tutorialsOpen, setTutorialsOpen] = useState(false)
  const [connectBusy, setConnectBusy] = useState(false)
  const [recentExpanded, setRecentExpanded] = useState(loadRecentExpanded)
  const [workspaces, setWorkspaces] = useState<Record<string, ServerWorkspaceState>>({})
  const [addPathId, setAddPathId] = useState('')
  const [askAiMode, setAskAiMode] = useState<AskAiMode>(askAiConfig.mode)
  const [selectedMcpServerId, setSelectedMcpServerId] = useState(askAiConfig.lastMcpServerId || '')

  const activeTarget = useMemo(
    () => (activeServerId ? targets.find((t) => t.id === activeServerId) : undefined),
    [targets, activeServerId]
  )
  const availablePaths = useMemo(() => collectEnabledPaths(activeTarget), [activeTarget])

  const activeWorkspace = activeServerId ? workspaces[activeServerId] : undefined
  const activePathTab = activeWorkspace?.pathTabs.find((t) => t.tabId === activeWorkspace.activePathTabId)

  const patchPathTab = (serverId: string, tabId: string, patch: Partial<PathTabState>): void => {
    setWorkspaces((prev) => {
      const ws = prev[serverId]
      if (!ws) return prev
      return {
        ...prev,
        [serverId]: {
          ...ws,
          pathTabs: ws.pathTabs.map((t) => (t.tabId === tabId ? { ...t, ...patch } : t)),
        },
      }
    })
  }

  const toggleRecentExpanded = (): void => {
    setRecentExpanded((prev) => {
      const next = !prev
      try {
        localStorage.setItem(RECENT_EXPANDED_KEY, next ? '1' : '0')
      } catch {
        /* ignore */
      }
      return next
    })
  }

  const openConnect = (): void => {
    // Silent refresh — avoid loading flicker while connecting multiple servers.
    void refreshTargets({ silent: true }).finally(() => setConnectOpen(true))
  }

  useEffect(() => {
    void refreshTargets({ silent: true })
  }, [refreshTargets])

  // PageRouter keeps LSA mounted — refresh targets when this page becomes active
  // so paths added in Settings appear without restarting. Silent to avoid UI stalls.
  useEffect(() => {
    if (activePage !== LINUX_SEARCH_ASSISTANT_PAGE_ID) return
    void refreshTargets({ silent: true })
    void refreshAskAi()
  }, [activePage, refreshTargets, refreshAskAi])

  useEffect(() => {
    setAskAiMode(askAiConfig.mode)
    const enabled = askAiConfig.mcpServers.filter((s) => s.enabled)
    const preferred =
      (askAiConfig.lastMcpServerId && enabled.some((s) => s.id === askAiConfig.lastMcpServerId)
        ? askAiConfig.lastMcpServerId
        : enabled[0]?.id) || ''
    setSelectedMcpServerId(preferred)
  }, [askAiConfig])

  useEffect(() => {
    if (connectRequired) {
      openConnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open on connect-required event only
  }, [connectRequired])

  const sessionIdsKey = useMemo(
    () =>
      sessions
        .map((s) => s.serverId)
        .sort()
        .join('|'),
    [sessions]
  )

  // Keep workspaces for live sessions; only rebuild when the set of server ids changes
  // (not on every targets refresh) to avoid multi-connect UI stalls.
  useEffect(() => {
    const ids = sessionIdsKey ? sessionIdsKey.split('|') : []
    setWorkspaces((prev) => {
      let changed = false
      const next: Record<string, ServerWorkspaceState> = {}
      for (const serverId of ids) {
        const existing = prev[serverId]
        if (existing?.pathTabs.length) {
          next[serverId] = existing
        } else {
          changed = true
          const target = targets.find((t) => t.id === serverId)
          const paths = collectEnabledPaths(target)
          next[serverId] = emptyServerWorkspace(paths[0]?.id)
        }
      }
      for (const id of Object.keys(prev)) {
        if (!ids.includes(id)) changed = true
      }
      if (!changed && Object.keys(prev).length === ids.length) return prev
      return next
    })
    // targets intentionally omitted — path dropdown uses live `availablePaths` from targets
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionIdsKey])

  // If a session appears before its target paths were known, seed once targets arrive.
  useEffect(() => {
    if (!sessionIdsKey) return
    setWorkspaces((prev) => {
      let changed = false
      const next: Record<string, ServerWorkspaceState> = { ...prev }
      for (const serverId of sessionIdsKey.split('|')) {
        const ws = next[serverId]
        if (ws && ws.pathTabs.length === 0) {
          const target = targets.find((t) => t.id === serverId)
          const paths = collectEnabledPaths(target)
          if (paths[0]?.id) {
            next[serverId] = emptyServerWorkspace(paths[0].id)
            changed = true
          }
        }
      }
      return changed ? next : prev
    })
  }, [targets, sessionIdsKey])

  const preferredTarget = useMemo(() => {
    if (activeSession?.serverId) {
      return targets.find((t) => t.id === activeSession.serverId) ?? targets[0]
    }
    if (reconnectPrefill?.id) {
      return targets.find((t) => t.id === reconnectPrefill.id) ?? targets[0]
    }
    const connected = new Set(sessions.map((s) => s.serverId))
    return targets.find((t) => !connected.has(t.id)) ?? targets[0]
  }, [targets, activeSession?.serverId, reconnectPrefill?.id, sessions])

  const dialogInitial = useMemo(() => {
    if (preferredTarget) {
      const identity = toSshServerIdentity(preferredTarget)
      return {
        server: preferredTarget.serverName || preferredTarget.applicationName,
        host: identity.host,
        username: identity.username,
        port: identity.port,
        id: identity.id,
      }
    }
    return {
      server: reconnectPrefill?.server || activeSession?.server || '',
      host: reconnectPrefill?.host || activeSession?.host || '',
      username: reconnectPrefill?.username || activeSession?.username || '',
      port: reconnectPrefill?.port || activeSession?.port || 22,
      id: reconnectPrefill?.id,
    }
  }, [preferredTarget, reconnectPrefill, activeSession])

  const activeConnected = Boolean(activeSession?.connected)

  // Live tail per active path tab (Follow UI is hidden; keep effect inert unless followSpec set).
  useEffect(() => {
    const serverId = activeServerId
    const followSpec = activePathTab?.followSpec
    const tabId = activePathTab?.tabId
    if (!serverId || !followSpec || !tabId || !activeConnected) return

    let cancelled = false
    let inFlight = false
    const tick = async (): Promise<void> => {
      if (inFlight || cancelled) return
      inFlight = true
      try {
        const target = targets.find((t) => t.id === followSpec.targetId)
        if (!target || !followSpec.fileName) return
        const entry = [...target.logPaths, ...target.configPaths, ...target.searchPaths].find(
          (p) => p.id === followSpec.pathId && p.enabled
        )
        if (!entry) return
        const remotePath = `${entry.path.replace(/\/+$/, '')}/${followSpec.fileName}`
        const result = await window.api.linuxSearchAssistantRemoteSearch({
          operation: 'tail',
          serverId: target.id,
          target,
          path: remotePath,
          lines: followSpec.lines ?? 100,
        })
        if (cancelled) return
        if (result.ok) {
          patchPathTab(serverId, tabId, { output: result.stdout || '(no output)' })
        }
      } catch {
        /* keep following */
      } finally {
        inFlight = false
      }
    }

    void tick()
    const handle = window.setInterval(() => {
      void tick()
    }, 2500)
    return () => {
      cancelled = true
      window.clearInterval(handle)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- narrow deps to avoid multi-session restarts
  }, [activeServerId, activePathTab?.tabId, activePathTab?.followSpec, activeConnected])

  const formatOutcome = (outcome: {
    ok: boolean
    message?: string
    search?: { ok: boolean; stdout?: string; lines?: string[]; stderr?: string }
    download?: { localPath: string }
  }): string => {
    if (outcome.ok) {
      if (outcome.download?.localPath) {
        return `Downloaded to ${outcome.download.localPath}`
      }
      if (outcome.search && outcome.search.ok) {
        const fromStdout = outcome.search.stdout
        const fromLines = (outcome.search.lines ?? []).slice(0, 2000).join('\n')
        const body = (fromStdout && fromStdout.length > 0 ? fromStdout : fromLines) || '(no output)'
        const stderr = outcome.search.stderr?.trim()
        return stderr ? `${body}\n\n[stderr]\n${stderr}` : body
      }
      return 'Action completed.'
    }
    return outcome.message || 'Action failed.'
  }

  const runWithFeedback = async (
    serverId: string,
    tabId: string,
    actions: RecentActionInput[]
  ): Promise<void> => {
    if (!serverId || !tabId || actions.length === 0) return
    patchPathTab(serverId, tabId, {
      busy: true,
      output: null,
      followSpec: null,
      exportFileName: suggestExportName(actions),
    })
    try {
      const batch = await recent.executeBatch(actions)
      const chunks: string[] = []
      batch.results.forEach((outcome, index) => {
        const action = actions[index]
        const body = formatOutcome(outcome)
        if (actions.length > 1) {
          const header = action?.fileName ? `===== ${action.fileName} =====` : `===== result ${index + 1} =====`
          chunks.push(`${header}\n${body}`)
        } else {
          chunks.push(body)
        }
      })
      patchPathTab(serverId, tabId, {
        output: chunks.join('\n\n'),
        exportFileName: suggestExportName(actions),
      })
    } finally {
      patchPathTab(serverId, tabId, { busy: false })
    }
  }

  const disconnectSession = (session: SshSessionHandle): void => {
    void window.api.linuxSearchAssistantSshDisconnect({ id: session.serverId }).finally(() => {
      removeSession(session.serverId)
    })
  }

  const addPathTab = (): void => {
    if (!activeServerId || !addPathId) return
    const tab = createPathTab(addPathId)
    setWorkspaces((prev) => {
      const ws = prev[activeServerId] ?? emptyServerWorkspace(addPathId)
      return {
        ...prev,
        [activeServerId]: {
          pathTabs: [...ws.pathTabs, tab],
          activePathTabId: tab.tabId,
        },
      }
    })
    setAddPathId('')
  }

  const closePathTab = (tabId: string): void => {
    if (!activeServerId) return
    setWorkspaces((prev) => {
      const ws = prev[activeServerId]
      if (!ws) return prev
      const pathTabs = ws.pathTabs.filter((t) => t.tabId !== tabId)
      if (pathTabs.length === 0) {
        const fallback = availablePaths[0]?.id
        if (!fallback) {
          return { ...prev, [activeServerId]: { pathTabs: [], activePathTabId: '' } }
        }
        const tab = createPathTab(fallback)
        return { ...prev, [activeServerId]: { pathTabs: [tab], activePathTabId: tab.tabId } }
      }
      const activePathTabId =
        ws.activePathTabId === tabId ? pathTabs[pathTabs.length - 1].tabId : ws.activePathTabId
      return { ...prev, [activeServerId]: { pathTabs, activePathTabId } }
    })
  }

  const filteredRecentActions = useMemo(() => {
    if (!activeServerId) return recent.actions
    const pathId = activePathTab?.pathId
    return recent.actions.filter(
      (a) => a.targetId === activeServerId && (!pathId || a.pathId === pathId)
    )
  }, [recent.actions, activeServerId, activePathTab?.pathId])

  if (statusLoading) {
    return (
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress size={28} />
      </Box>
    )
  }

  if (!status?.enabled) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="info">
          Linux Search Assistant is disabled. Enable it under Settings → Feature Modules, or set
          LINUX_SEARCH_ASSISTANT=1.
        </Alert>
      </Box>
    )
  }

  return (
    <Box
      sx={{
        p: 2,
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 1.25,
        overflow: 'hidden',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexShrink: 0 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
          Linux Search Assistant
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
          <Tooltip title="Command tutorials (offline reference)">
            <IconButton
              size="small"
              aria-label="Open command tutorials"
              onClick={() => setTutorialsOpen(true)}
            >
              <InfoOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={openConnect}>
            {sessions.length > 0 ? 'Connect another' : 'Connect'}
          </Button>
        </Box>
      </Box>

      {/* Outer tabs: servers */}
      <Box
        sx={{
          flexShrink: 0,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
          bgcolor: 'background.paper',
          display: 'flex',
          alignItems: 'center',
          minHeight: 40,
        }}
      >
        {sessions.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ px: 1.5, py: 1 }}>
            No SSH sessions — connect a server to open a workspace tab.
          </Typography>
        ) : (
          <Tabs
            value={activeServerId ?? false}
            onChange={(_, value: string) => setActiveServerId(value)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              minHeight: 40,
              flex: 1,
              '& .MuiTab-root': { minHeight: 40, py: 0.5, textTransform: 'none' },
            }}
          >
            {sessions.map((session) => (
              <Tab
                key={session.serverId}
                value={session.serverId}
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, maxWidth: 280 }}>
                    <Chip size="small" color="success" label="live" sx={{ height: 18, fontSize: '0.65rem' }} />
                    <Typography variant="body2" noWrap sx={{ fontWeight: 600, fontSize: '0.8rem' }}>
                      {tabLabel(session, targets)}
                    </Typography>
                    <Tooltip title="Disconnect this server">
                      <IconButton
                        size="small"
                        component="span"
                        onClick={(e) => {
                          e.stopPropagation()
                          disconnectSession(session)
                        }}
                        sx={{ p: 0.25 }}
                        aria-label={`Disconnect ${session.host}`}
                      >
                        <CloseIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                }
              />
            ))}
          </Tabs>
        )}
        <Tooltip title="Connect another server">
          <IconButton size="small" onClick={openConnect} sx={{ mx: 0.5 }} aria-label="Connect another server">
            <AddIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Inner tabs: paths on the same SSH connection */}
      {activeSession && (
        <Box
          sx={{
            flexShrink: 0,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            bgcolor: 'action.hover',
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            minHeight: 36,
            px: 0.5,
          }}
        >
          <Typography
            variant="caption"
            sx={{ px: 1, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.06 }}
          >
            Paths
          </Typography>
          {activeWorkspace && activeWorkspace.pathTabs.length > 0 ? (
            <Tabs
              value={activeWorkspace.activePathTabId}
              onChange={(_, value: string) => {
                setWorkspaces((prev) => ({
                  ...prev,
                  [activeSession.serverId]: {
                    ...(prev[activeSession.serverId] ?? emptyServerWorkspace()),
                    activePathTabId: value,
                  },
                }))
              }}
              variant="scrollable"
              scrollButtons="auto"
              sx={{
                minHeight: 36,
                flex: 1,
                '& .MuiTab-root': { minHeight: 36, py: 0.25, textTransform: 'none', fontSize: '0.78rem' },
              }}
            >
              {activeWorkspace.pathTabs.map((tab) => {
                const label =
                  availablePaths.find((p) => p.id === tab.pathId)?.label || tab.pathId || 'Path'
                return (
                  <Tab
                    key={tab.tabId}
                    value={tab.tabId}
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <span>{label}</span>
                        {activeWorkspace.pathTabs.length > 1 && (
                          <IconButton
                            size="small"
                            component="span"
                            onClick={(e) => {
                              e.stopPropagation()
                              closePathTab(tab.tabId)
                            }}
                            sx={{ p: 0.15 }}
                            aria-label={`Close path ${label}`}
                          >
                            <CloseIcon sx={{ fontSize: 12 }} />
                          </IconButton>
                        )}
                      </Box>
                    }
                  />
                )
              })}
            </Tabs>
          ) : (
            <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
              Add a path tab to work in a log directory.
            </Typography>
          )}
          <Select
            size="small"
            displayEmpty
            value={addPathId}
            onChange={(e) => setAddPathId(e.target.value)}
            sx={{ minWidth: 140, height: 28, fontSize: '0.75rem', bgcolor: 'background.paper' }}
          >
            <MenuItem value="">
              <em>Add path…</em>
            </MenuItem>
            {availablePaths.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.label}
              </MenuItem>
            ))}
          </Select>
          <Tooltip title="Open another path on this connection">
            <span>
              <IconButton size="small" disabled={!addPathId} onClick={addPathTab} aria-label="Add path tab">
                <AddIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      )}

      {expiredEvent && (
        <Alert
          severity="warning"
          sx={{ flexShrink: 0, py: 0.5 }}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => {
                clearExpiredEvent()
                openConnect()
              }}
            >
              Reconnect
            </Button>
          }
          onClose={clearExpiredEvent}
        >
          {expiredEvent.reason === 'inactivity_timeout'
            ? `SSH timed out for ${expiredEvent.reconnect.username}@${expiredEvent.reconnect.host}.`
            : `SSH expired for ${expiredEvent.reconnect.username}@${expiredEvent.reconnect.host}.`}{' '}
          Reconnect to continue.
        </Alert>
      )}

      {connectRequired && !expiredEvent && (
        <Alert
          severity="info"
          sx={{ flexShrink: 0, py: 0.5 }}
          action={
            <Button color="inherit" size="small" onClick={openConnect}>
              Connect
            </Button>
          }
          onClose={clearConnectRequired}
        >
          {connectRequired.message}
        </Alert>
      )}

      {configError && (
        <Alert severity="warning" sx={{ flexShrink: 0, py: 0.5 }}>
          {configError}
        </Alert>
      )}

      {targets.length === 0 && (
        <Alert severity="info" sx={{ flexShrink: 0, py: 0.5 }}>
          Add a target under Settings → Feature Modules → Linux Search Assistant, then Connect.
        </Alert>
      )}

      {activeSession && activePathTab ? (
        <>
          <LogicalActionForm
            key={activeSession.serverId}
            targets={targets}
            lockedTargetId={activeSession.serverId}
            lockedPathId={activePathTab.pathId}
            busy={activePathTab.busy || Boolean(activePathTab.followSpec)}
            hasSession={Boolean(activeSession.connected)}
            onNeedConnect={openConnect}
            following={Boolean(activePathTab.followSpec)}
            onFollowChange={(spec) =>
              patchPathTab(activeSession.serverId, activePathTab.tabId, { followSpec: spec })
            }
            onRun={(actions) => {
              void runWithFeedback(
                activeSession.serverId,
                activePathTab.tabId,
                Array.isArray(actions) ? actions : [actions]
              )
            }}
          />

          {recent.error && (
            <Alert severity="error" sx={{ flexShrink: 0, py: 0.5 }}>
              {recent.error}
            </Alert>
          )}

          <Box sx={{ flex: 1, minHeight: 0, display: 'flex', gap: 1.25, overflow: 'hidden' }}>
            <LinuxSearchOutputPanel
              text={activePathTab.output}
              busy={activePathTab.busy}
              following={Boolean(activePathTab.followSpec)}
              exportFileName={activePathTab.exportFileName}
              showViewToggle
              viewMode={activePathTab.viewMode}
              onViewModeChange={(mode) =>
                patchPathTab(activeSession.serverId, activePathTab.tabId, { viewMode: mode })
              }
              askAiEnabled={askAiConfig.enabled}
              askAiMode={askAiMode}
              onAskAiModeChange={setAskAiMode}
              mcpServers={askAiConfig.mcpServers}
              selectedMcpServerId={selectedMcpServerId}
              onSelectedMcpServerIdChange={setSelectedMcpServerId}
              analyzeContext={
                activeTarget
                  ? `app=${activeTarget.applicationName || activeTarget.serverName || activeTarget.id}; pathId=${activePathTab.pathId}`
                  : undefined
              }
            />

            <Box
              sx={{
                width: recentExpanded ? 280 : 40,
                flexShrink: 0,
                minHeight: 0,
                overflow: 'hidden',
                transition: 'width 0.2s ease',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {recentExpanded ? (
                <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 0.5, flexShrink: 0 }}>
                    <Tooltip title="Minimize Recent Actions">
                      <IconButton
                        size="small"
                        aria-label="Minimize Recent Actions"
                        onClick={toggleRecentExpanded}
                      >
                        <ChevronRightIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                  <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                    <RecentActionsPanel
                      actions={filteredRecentActions}
                      filter={recent.filter}
                      onFilterChange={recent.setFilter}
                      loading={recent.loading}
                      historySize={recent.preferences?.historySize}
                      onReplay={(actionId) => {
                        const action = recent.actions.find((a) => a.id === actionId)
                        const serverId = action?.targetId || activeSession.serverId
                        const tabId = activePathTab.tabId
                        void (async () => {
                          patchPathTab(serverId, tabId, {
                            busy: true,
                            output: null,
                            followSpec: null,
                            exportFileName: action?.fileName || null,
                          })
                          try {
                            const outcome = await recent.replay(actionId)
                            patchPathTab(serverId, tabId, {
                              output: formatOutcome(outcome),
                              exportFileName: action?.fileName || null,
                            })
                          } finally {
                            patchPathTab(serverId, tabId, { busy: false })
                          }
                        })()
                      }}
                      onTogglePin={(actionId, pinned) => {
                        void recent.setPinned(actionId, pinned)
                      }}
                      onRemove={(actionId) => {
                        void recent.remove(actionId)
                      }}
                      onClearUnpinned={() => {
                        void recent.clearUnpinned()
                      }}
                    />
                  </Box>
                </Box>
              ) : (
                <Tooltip title="Expand Recent Actions" placement="left">
                  <Box
                    component="button"
                    type="button"
                    onClick={toggleRecentExpanded}
                    aria-label="Expand Recent Actions"
                    sx={{
                      width: '100%',
                      height: '100%',
                      m: 0,
                      p: 0.5,
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1,
                      bgcolor: 'background.paper',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 1,
                      color: 'text.secondary',
                      '&:hover': { bgcolor: 'action.hover', color: 'text.primary' },
                    }}
                  >
                    <ChevronLeftIcon fontSize="small" />
                    <HistoryIcon fontSize="small" />
                    <Typography
                      variant="caption"
                      sx={{
                        writingMode: 'vertical-rl',
                        transform: 'rotate(180deg)',
                        fontWeight: 700,
                        letterSpacing: 0.5,
                      }}
                    >
                      Recent
                    </Typography>
                  </Box>
                </Tooltip>
              )}
            </Box>
          </Box>
        </>
      ) : (
        <Alert severity="info" sx={{ flexShrink: 0 }}>
          Connect to a configured server, then open one or more path tabs. Each path keeps its own
          file list and output while sharing the same SSH connection.
        </Alert>
      )}

      <LinuxSearchConsolePanel
        logs={consolePanel.logs}
        expanded={consolePanel.expanded}
        busy={Boolean(activePathTab?.busy) || connectBusy}
        onToggleExpanded={() => consolePanel.setExpanded(!consolePanel.expanded)}
        onClear={consolePanel.clear}
      />

      <CommandTutorialsDialog open={tutorialsOpen} onClose={() => setTutorialsOpen(false)} />

      <SshConnectionDialog
        open={connectOpen}
        initial={dialogInitial}
        targets={targets}
        onClose={() => {
          setConnectBusy(false)
          setConnectOpen(false)
        }}
        onConnectingChange={setConnectBusy}
        onConnected={(next) => {
          clearExpiredEvent()
          clearConnectRequired()
          setConnectBusy(false)
          upsertSession(next)
          setWorkspaces((prev) => {
            if (prev[next.serverId]?.pathTabs.length) return prev
            const target = targets.find((t) => t.id === next.serverId)
            const paths = collectEnabledPaths(target)
            return {
              ...prev,
              [next.serverId]: emptyServerWorkspace(paths[0]?.id),
            }
          })
        }}
      />
    </Box>
  )
}
