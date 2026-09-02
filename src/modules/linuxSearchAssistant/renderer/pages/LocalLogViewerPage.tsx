/**
 * Local Log Viewer — Notepad++-thin multi-tab reader.
 * Reuses LinuxSearchOutputPanel (find / filter / color / font) per tab.
 *
 * Opened file bodies stay cached in memory — tab switches do not re-read disk.
 * One Output panel instance; sessionKey swaps restore per-tab find/highlight state.
 */
import React, { startTransition, useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  FormControl,
  IconButton,
  MenuItem,
  Select,
  Tab,
  Tabs,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import CloseIcon from '@mui/icons-material/Close'
import RefreshIcon from '@mui/icons-material/Refresh'
import type { AskAiMode, LocalLogReadMode } from '../../models'
import {
  DEFAULT_LOCAL_LOG_WINDOW_BYTES,
  LOCAL_LOG_WINDOW_PRESETS_MB,
  MAX_LOCAL_LOG_OPEN_FILES,
} from '../../models'
import type { LocalLogFileContent } from '../../models/localLogViewer'
import LinuxSearchOutputPanel, { type OutputViewMode } from '../components/LinuxSearchOutputPanel'
import { useAskAiConfig } from '../hooks/useAskAiConfig'
import { formatDiskSize } from '../../../../shared/utils/format'

interface OpenTab extends LocalLogFileContent {
  tabId: string
}

function toOpenTab(file: LocalLogFileContent, tabId?: string): OpenTab {
  return {
    ...file,
    tabId: tabId ?? file.id,
  }
}

export default function LocalLogViewerPage(): React.JSX.Element {
  const [tabs, setTabs] = useState<OpenTab[]>([])
  const [activeTabId, setActiveTabId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [opening, setOpening] = useState(false)
  const [readMode, setReadMode] = useState<LocalLogReadMode>('tail')
  const [windowBytes, setWindowBytes] = useState(DEFAULT_LOCAL_LOG_WINDOW_BYTES)
  const [viewMode, setViewMode] = useState<OutputViewMode>('raw')
  const { config: askAiConfig } = useAskAiConfig()
  const [askAiMode, setAskAiMode] = useState<AskAiMode>('llm')
  const [selectedMcpServerId, setSelectedMcpServerId] = useState('')

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- seed Ask AI prefs once the async config arrives
    setAskAiMode(askAiConfig.mode || 'llm')
    const enabled = askAiConfig.mcpServers.filter((s) => s.enabled)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- seed the preferred MCP server from config
    setSelectedMcpServerId(enabled[0]?.id ?? askAiConfig.mcpServers[0]?.id ?? '')
  }, [askAiConfig])

  const activeTab = tabs.find((t) => t.tabId === activeTabId) ?? tabs[0] ?? null
  const readOpts = useMemo(() => ({ mode: readMode, windowBytes }), [readMode, windowBytes])

  const selectTab = useCallback((tabId: string): void => {
    startTransition(() => setActiveTabId(tabId))
  }, [])

  const handleOpen = useCallback(async (): Promise<void> => {
    setOpening(true)
    setError(null)
    try {
      const result = await window.api.linuxSearchAssistantOpenLocalLogFiles(tabs.length, readOpts)
      if (result.canceled) return
      if (result.files.length === 0 && result.skipped.length > 0) {
        setError(result.skipped.map((s) => s.reason || s.filePath).join(' · '))
        return
      }

      let focusId: string | null = null
      setTabs((prev) => {
        const merged = [...prev]
        for (const file of result.files) {
          const existing = merged.findIndex((t) => t.filePath === file.filePath)
          if (existing >= 0) {
            const tabId = merged[existing].tabId
            merged[existing] = toOpenTab(file, tabId)
            focusId = tabId
          } else if (merged.length < MAX_LOCAL_LOG_OPEN_FILES) {
            const tab = toOpenTab(file)
            merged.push(tab)
            focusId = tab.tabId
          }
        }
        return merged
      })
      if (focusId) {
        startTransition(() => setActiveTabId(focusId))
      }

      if (result.skipped.length > 0) {
        setError(
          result.skipped
            .map((s) => (s.filePath ? `${s.filePath}: ${s.reason}` : s.reason))
            .join(' · ')
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open files.')
    } finally {
      setOpening(false)
    }
  }, [tabs.length, readOpts])

  const handleCloseTab = useCallback(
    (tabId: string): void => {
      setTabs((prev) => {
        const next = prev.filter((t) => t.tabId !== tabId)
        if (next.length === 0) setViewMode('raw')
        if (activeTabId === tabId) {
          setActiveTabId(next[next.length - 1]?.tabId ?? null)
        }
        return next
      })
    },
    [activeTabId]
  )

  const handleReload = useCallback(async (): Promise<void> => {
    if (!activeTab) return
    setError(null)
    setOpening(true)
    try {
      const fresh = await window.api.linuxSearchAssistantReloadLocalLogFile(
        activeTab.filePath,
        readOpts
      )
      setTabs((prev) =>
        prev.map((t) => (t.tabId === activeTab.tabId ? toOpenTab(fresh, t.tabId) : t))
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reload file.')
    } finally {
      setOpening(false)
    }
  }, [activeTab, readOpts])

  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        p: 1.5,
        gap: 1,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          flexWrap: 'wrap',
          flexShrink: 0,
        }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mr: 0.5 }}>
          Local Log Viewer
        </Typography>
        <Button
          size="small"
          variant="contained"
          startIcon={<FolderOpenIcon />}
          onClick={() => void handleOpen()}
          disabled={opening || tabs.length >= MAX_LOCAL_LOG_OPEN_FILES}
        >
          Open files…
        </Button>

        <ToggleButtonGroup
          size="small"
          exclusive
          value={readMode}
          onChange={(_, v: LocalLogReadMode | null) => {
            if (v) setReadMode(v)
          }}
          aria-label="Read from head or tail"
        >
          <ToggleButton value="tail" sx={{ px: 1, py: 0.25, textTransform: 'none' }}>
            Tail
          </ToggleButton>
          <ToggleButton value="head" sx={{ px: 1, py: 0.25, textTransform: 'none' }}>
            Head
          </ToggleButton>
        </ToggleButtonGroup>


        <FormControl size="small" sx={{ minWidth: 88 }}>
          <Select
            value={windowBytes}
            onChange={(e) => setWindowBytes(Number(e.target.value))}
            displayEmpty
            inputProps={{ 'aria-label': 'Window size' }}
            sx={{ height: 30, fontSize: '0.8rem' }}
          >
            {LOCAL_LOG_WINDOW_PRESETS_MB.map((mb) => (
              <MenuItem key={mb} value={mb * 1024 * 1024}>
                {mb} MB
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Tooltip title="Reload active file with current Head/Tail + window size">
          <span>
            <IconButton size="small" disabled={!activeTab || opening} onClick={() => void handleReload()}>
              <RefreshIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
          {activeTab
            ? `${activeTab.readMode === 'tail' ? 'Tail' : 'Head'} ${(activeTab.windowBytes / (1024 * 1024)).toFixed(0)} MB · disk ${formatDiskSize(activeTab.byteSize)}${activeTab.truncated ? ' (windowed)' : ''} · cached`
            : `Default: Tail ${windowBytes / (1024 * 1024)} MB · max ${MAX_LOCAL_LOG_OPEN_FILES} tabs`}
        </Typography>
      </Box>

      {error && (
        <Alert severity="warning" onClose={() => setError(null)} sx={{ flexShrink: 0, py: 0.25 }}>
          {error}
        </Alert>
      )}

      {tabs.length > 0 && (
        <Tabs
          value={activeTab?.tabId ?? false}
          onChange={(_, v: string) => selectTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            flexShrink: 0,
            minHeight: 36,
            borderBottom: '1px solid',
            borderColor: 'divider',
            '& .MuiTab-root': { minHeight: 36, py: 0.5, textTransform: 'none' },
          }}
        >
          {tabs.map((tab) => (
            <Tab
              key={tab.tabId}
              value={tab.tabId}
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, maxWidth: 220 }}>
                  <Typography
                    variant="caption"
                    noWrap
                    title={tab.filePath}
                    sx={{ fontWeight: 600 }}
                  >
                    {tab.fileName}
                    {tab.truncated ? ' *' : ''}
                  </Typography>
                  <IconButton
                    size="small"
                    component="span"
                    aria-label={`Close ${tab.fileName}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleCloseTab(tab.tabId)
                    }}
                    sx={{ p: 0.15 }}
                  >
                    <CloseIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Box>
              }
            />
          ))}
        </Tabs>
      )}

      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {tabs.length === 0 || !activeTab ? (
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1.5,
              color: 'text.secondary',
              border: '1px dashed',
              borderColor: 'divider',
              borderRadius: 1,
            }}
          >
            <FolderOpenIcon sx={{ fontSize: 40, opacity: 0.45 }} />
            <Typography variant="body2">
              Open a local log — default loads the last {windowBytes / (1024 * 1024)} MB (Tail)
            </Typography>
            <Button
              size="small"
              variant="outlined"
              startIcon={<FolderOpenIcon />}
              onClick={() => void handleOpen()}
              disabled={opening}
            >
              Open files…
            </Button>
          </Box>
        ) : (
          <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <LinuxSearchOutputPanel
              key={activeTab.tabId}
              text={activeTab.content}
              exportFileName={activeTab.fileName}
              decodeEscapes={false}
              sessionKey={activeTab.tabId}
              showViewToggle
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              askAiEnabled={askAiConfig.enabled}
              askAiMode={askAiMode}
              onAskAiModeChange={setAskAiMode}
              mcpServers={askAiConfig.mcpServers}
              selectedMcpServerId={selectedMcpServerId}
              onSelectedMcpServerIdChange={setSelectedMcpServerId}
              analyzeContext={`localFile=${activeTab.fileName}`}
            />
          </Box>
        )}
      </Box>
    </Box>
  )
}
