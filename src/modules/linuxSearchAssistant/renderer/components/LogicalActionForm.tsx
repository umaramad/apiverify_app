/**
 * Compact remote-action toolbar.
 * View Files loads remote filenames; Grep/Search Text supports multi-file selection.
 * Uses pathId + current config — never sends passwords or stores absolute paths in history.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Autocomplete,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import type {
  LinuxSearchPathEntry,
  LinuxSearchTargetConfig,
  RecentActionInput,
  RecentActionOperation,
} from '../../models'
import { RECENT_ACTION_OPERATIONS } from '../../models'

const OPERATION_LABEL: Record<RecentActionOperation, string> = {
  SEARCH_TEXT: 'Search Text',
  FIND_FILE: 'Find File',
  VIEW_FILE: 'View Files',
  TAIL_LOG: 'Tail Log',
  DOWNLOAD_FILE: 'Download File',
}

/** When Action is View Files — what to run after picking a file (or on the folder for Find). */
type ViewFilesMode = 'view' | 'grep' | 'tail' | 'find'

const VIEW_MODE_LABEL: Record<ViewFilesMode, string> = {
  view: 'View (cat)',
  grep: 'Grep',
  tail: 'Tail',
  find: 'Find',
}

function collectPaths(target: LinuxSearchTargetConfig): LinuxSearchPathEntry[] {
  return [...target.logPaths, ...target.configPaths, ...target.searchPaths].filter((p) => p.enabled)
}

/** Survives form remounts when switching path tabs — avoid re-listing remote dirs. */
const remoteFilesCache = new Map<string, string[]>()

function filesCacheKey(targetId: string, pathId: string): string {
  return `${targetId}::${pathId}`
}

interface LogicalActionFormProps {
  targets: LinuxSearchTargetConfig[]
  busy?: boolean
  onRun: (action: RecentActionInput | RecentActionInput[]) => void
  onNeedConnect: () => void
  hasSession: boolean
  /** When set (multi-server tab), App is locked to this connected target. */
  lockedTargetId?: string
  /** When set (inner path tab), Path is locked to this pathId. */
  lockedPathId?: string
  /** Live tail: parent runs periodic TAIL without recording every poll. */
  following?: boolean
  onFollowChange?: (spec: RecentActionInput | null) => void
}

export default function LogicalActionForm({
  targets,
  busy,
  onRun,
  onNeedConnect,
  hasSession,
  lockedTargetId,
  lockedPathId,
  following = false,
  onFollowChange,
}: LogicalActionFormProps): React.JSX.Element {
  const initialTargetId = lockedTargetId || targets[0]?.id || ''
  const [targetId, setTargetId] = useState(initialTargetId)
  const [pathId, setPathId] = useState(lockedPathId || '')
  const [operation, setOperation] = useState<RecentActionOperation>('SEARCH_TEXT')
  const [viewMode, setViewMode] = useState<ViewFilesMode>('view')
  const [keyword, setKeyword] = useState('')
  const [fileName, setFileName] = useState('')
  /** Multi-file selection for Search Text / Grep (same server path). */
  const [fileNames, setFileNames] = useState<string[]>([])
  const [lines, setLines] = useState('100')
  const [contextMode, setContextMode] = useState<'none' | 'C' | 'A' | 'B'>('C')
  const [contextLines, setContextLines] = useState('3')
  const [remoteFiles, setRemoteFiles] = useState<string[]>([])
  const [filesLoading, setFilesLoading] = useState(false)
  const [filesError, setFilesError] = useState<string | null>(null)

  const target = useMemo(() => {
    const id = lockedTargetId || targetId
    return targets.find((t) => t.id === id) ?? targets[0] ?? null
  }, [targets, targetId, lockedTargetId])

  const paths = target ? collectPaths(target) : []

  useEffect(() => {
    if (!target) return
    setTargetId(target.id)
    if (lockedPathId && paths.some((p) => p.id === lockedPathId)) {
      setPathId(lockedPathId)
      return
    }
    if (!paths.some((p) => p.id === pathId)) {
      setPathId(paths[0]?.id ?? '')
    }
  }, [target, paths, pathId, lockedPathId])

  const multiFileMode =
    operation === 'SEARCH_TEXT' || (operation === 'VIEW_FILE' && viewMode === 'grep')

  const needsFileList =
    operation === 'VIEW_FILE' ||
    operation === 'TAIL_LOG' ||
    operation === 'DOWNLOAD_FILE' ||
    operation === 'SEARCH_TEXT'

  const loadFiles = useCallback(
    async (opts?: { force?: boolean }): Promise<void> => {
      if (!target || !pathId) return
      if (!hasSession) {
        onNeedConnect()
        return
      }
      const key = filesCacheKey(target.id, pathId)
      if (!opts?.force) {
        const cached = remoteFilesCache.get(key)
        if (cached) {
          setRemoteFiles(cached)
          setFilesError(null)
          setFileName((prev) => {
            if (prev && cached.includes(prev)) return prev
            return cached[0] || ''
          })
          setFileNames((prev) => prev.filter((f) => cached.includes(f)))
          return
        }
      }
      setFilesLoading(true)
      setFilesError(null)
      try {
        const result = await window.api.linuxSearchAssistantListRemoteFiles({
          targetId: target.id,
          pathId,
        })
        if (!result.ok) {
          setRemoteFiles([])
          setFilesError(result.message || 'Could not list files.')
          if (result.connectRequired) onNeedConnect()
          return
        }
        const files = result.files || []
        remoteFilesCache.set(key, files)
        setRemoteFiles(files)
        setFileName((prev) => {
          if (prev && files.includes(prev)) return prev
          return files[0] || ''
        })
        setFileNames((prev) => prev.filter((f) => files.includes(f)))
      } catch (err) {
        setRemoteFiles([])
        setFilesError(err instanceof Error ? err.message : 'Could not list files.')
      } finally {
        setFilesLoading(false)
      }
    },
    [target, pathId, hasSession, onNeedConnect]
  )

  // Auto-list when file-oriented ops are selected — uses cache if this path was listed already.
  useEffect(() => {
    if (!hasSession || !target || !pathId) return
    if (
      operation !== 'VIEW_FILE' &&
      operation !== 'TAIL_LOG' &&
      operation !== 'DOWNLOAD_FILE' &&
      operation !== 'SEARCH_TEXT'
    ) {
      return
    }
    void loadFiles({ force: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when path/op/session change
  }, [operation, pathId, target?.id, hasSession])

  const grepContext =
    contextMode === 'none'
      ? {}
      : {
          contextMode: contextMode as 'C' | 'A' | 'B',
          contextLines: Math.min(Math.max(Number(contextLines) || 3, 1), 20),
        }

  const buildSearchActions = (selectedFiles: string[]): RecentActionInput[] => {
    if (!target || !pathId || !keyword.trim()) return []
    if (selectedFiles.length === 0) {
      // Entire path (directory) grep — same as before.
      return [
        {
          operation: 'SEARCH_TEXT',
          keyword: keyword.trim(),
          application: target.applicationName,
          targetId: target.id,
          pathId,
          ...grepContext,
        },
      ]
    }
    return selectedFiles.map((name) => ({
      operation: 'SEARCH_TEXT' as const,
      keyword: keyword.trim(),
      application: target.applicationName,
      targetId: target.id,
      pathId,
      fileName: name,
      ...grepContext,
    }))
  }

  const handleRun = (): void => {
    if (!hasSession) {
      onNeedConnect()
      return
    }
    if (!target || !pathId) return

    if (operation === 'VIEW_FILE') {
      if (viewMode === 'find') {
        if (!keyword.trim()) return
        onRun({
          operation: 'FIND_FILE',
          keyword: keyword.trim(),
          application: target.applicationName,
          targetId: target.id,
          pathId,
        })
        return
      }
      if (viewMode === 'grep') {
        if (!keyword.trim()) return
        const actions = buildSearchActions(fileNames)
        if (actions.length === 0) return
        onRun(actions.length === 1 ? actions[0] : actions)
        return
      }
      if (!fileName.trim()) return
      if (viewMode === 'tail') {
        onRun({
          operation: 'TAIL_LOG',
          application: target.applicationName,
          targetId: target.id,
          pathId,
          fileName: fileName.trim(),
          lines: Number(lines) || 100,
        })
        return
      }
      onRun({
        operation: 'VIEW_FILE',
        application: target.applicationName,
        targetId: target.id,
        pathId,
        fileName: fileName.trim(),
      })
      return
    }

    if (operation === 'SEARCH_TEXT') {
      if (!keyword.trim()) return
      const actions = buildSearchActions(fileNames)
      onRun(actions.length === 1 ? actions[0] : actions)
      return
    }

    const needsKeyword = operation === 'FIND_FILE'
    const needsFile = operation === 'TAIL_LOG' || operation === 'DOWNLOAD_FILE'

    onRun({
      operation,
      keyword: needsKeyword ? keyword : undefined,
      application: target.applicationName,
      targetId: target.id,
      pathId,
      fileName: needsFile ? fileName || undefined : undefined,
      lines: operation === 'TAIL_LOG' ? Number(lines) || 100 : undefined,
    })
  }

  const runDisabled = ((): boolean => {
    if (busy || !pathId) return true
    if (operation === 'VIEW_FILE') {
      if (viewMode === 'find' || viewMode === 'grep') return !keyword.trim()
      if (viewMode === 'view' || viewMode === 'tail') return !fileName.trim()
      return false
    }
    if (operation === 'SEARCH_TEXT' || operation === 'FIND_FILE') return !keyword.trim()
    if (operation === 'TAIL_LOG' || operation === 'DOWNLOAD_FILE') return !fileName.trim()
    return false
  })()

  if (targets.length === 0) {
    return (
      <Box sx={{ p: 1.5, border: '1px dashed', borderColor: 'divider', borderRadius: 1 }}>
        <Typography variant="body2" color="text.secondary">
          Add an application target under Settings → Feature Modules → Linux Search Assistant to run
          remote actions.
        </Typography>
      </Box>
    )
  }

  const showFileSelect =
    operation === 'VIEW_FILE' ||
    operation === 'TAIL_LOG' ||
    operation === 'DOWNLOAD_FILE' ||
    operation === 'SEARCH_TEXT'
  const showKeyword =
    operation === 'SEARCH_TEXT' ||
    operation === 'FIND_FILE' ||
    (operation === 'VIEW_FILE' && (viewMode === 'grep' || viewMode === 'find'))
  const showLines =
    operation === 'TAIL_LOG' || (operation === 'VIEW_FILE' && viewMode === 'tail')
  const showGrepContext =
    operation === 'SEARCH_TEXT' || (operation === 'VIEW_FILE' && viewMode === 'grep')

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        flexShrink: 0,
        p: 1,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        bgcolor: 'background.paper',
      }}
    >
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
        <FormControl size="small" sx={{ minWidth: 130, flex: '1 1 130px' }} disabled={Boolean(lockedTargetId)}>
          <InputLabel id="lsa-target-label">App</InputLabel>
          <Select
            labelId="lsa-target-label"
            label="App"
            value={target?.id ?? ''}
            onChange={(e) => {
              setTargetId(e.target.value)
              setRemoteFiles([])
              setFileName('')
              setFileNames([])
              onFollowChange?.(null)
            }}
          >
            {targets.map((t) => (
              <MenuItem key={t.id} value={t.id}>
                {t.applicationName || t.serverName || t.id}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 120, flex: '1 1 120px' }} disabled={Boolean(lockedPathId)}>
          <InputLabel id="lsa-path-label">Path</InputLabel>
          <Select
            labelId="lsa-path-label"
            label="Path"
            value={pathId}
            onChange={(e) => {
              setPathId(e.target.value)
              setRemoteFiles([])
              setFileName('')
              setFileNames([])
              onFollowChange?.(null)
            }}
          >
            {paths.map((p) => (
              <MenuItem key={p.id || p.path} value={p.id}>
                {p.label || p.path || p.id}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel id="lsa-op-label">Action</InputLabel>
          <Select
            labelId="lsa-op-label"
            label="Action"
            value={operation}
            onChange={(e) => {
              const next = e.target.value as RecentActionOperation
              setOperation(next)
              if (next === 'VIEW_FILE') setViewMode('view')
              onFollowChange?.(null)
            }}
          >
            {RECENT_ACTION_OPERATIONS.map((op) => (
              <MenuItem key={op} value={op}>
                {OPERATION_LABEL[op]}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {operation === 'VIEW_FILE' && (
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel id="lsa-view-mode-label">Then</InputLabel>
            <Select
              labelId="lsa-view-mode-label"
              label="Then"
              value={viewMode}
              onChange={(e) => {
                setViewMode(e.target.value as ViewFilesMode)
                onFollowChange?.(null)
              }}
            >
              {(Object.keys(VIEW_MODE_LABEL) as ViewFilesMode[]).map((m) => (
                <MenuItem key={m} value={m}>
                  {VIEW_MODE_LABEL[m]}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        {showFileSelect && !(operation === 'VIEW_FILE' && viewMode === 'find') && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: '1 1 220px', minWidth: 200 }}>
            {multiFileMode ? (
              <Autocomplete
                multiple
                size="small"
                options={remoteFiles}
                value={fileNames}
                loading={filesLoading}
                disabled={filesLoading}
                onChange={(_, value) => {
                  setFileNames(value)
                  onFollowChange?.(null)
                }}
                disableCloseOnSelect
                limitTags={2}
                sx={{ flex: 1, minWidth: 0 }}
                renderOption={(props, option, { selected }) => {
                  const { key, ...rest } = props as React.HTMLAttributes<HTMLLIElement> & {
                    key?: React.Key
                  }
                  return (
                    <li key={key} {...rest}>
                      <Checkbox size="small" checked={selected} sx={{ mr: 1 }} />
                      {option}
                    </li>
                  )
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Files"
                    placeholder={fileNames.length === 0 ? 'All files in path' : ''}
                  />
                )}
              />
            ) : (
              <FormControl size="small" sx={{ flex: 1, minWidth: 0 }} disabled={filesLoading}>
                <InputLabel id="lsa-file-label">File</InputLabel>
                <Select
                  labelId="lsa-file-label"
                  label="File"
                  value={fileName}
                  displayEmpty
                  onChange={(e) => {
                    setFileName(e.target.value)
                    onFollowChange?.(null)
                  }}
                >
                  {remoteFiles.length === 0 && fileName === '' && (
                    <MenuItem value="" disabled>
                      {filesLoading ? 'Loading…' : 'Load files…'}
                    </MenuItem>
                  )}
                  {remoteFiles.map((f) => (
                    <MenuItem key={f} value={f}>
                      {f}
                    </MenuItem>
                  ))}
                  {fileName && !remoteFiles.includes(fileName) && (
                    <MenuItem value={fileName}>{fileName}</MenuItem>
                  )}
                </Select>
              </FormControl>
            )}
            <Tooltip title="Refresh file list from server">
              <span>
                <IconButton
                  size="small"
                  onClick={() => void loadFiles({ force: true })}
                  disabled={busy || filesLoading || !pathId}
                  aria-label="Refresh files"
                >
                  {filesLoading ? <CircularProgress size={16} /> : <RefreshIcon fontSize="small" />}
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        )}

        {showKeyword && (
          <TextField
            size="small"
            label={
              operation === 'FIND_FILE' || (operation === 'VIEW_FILE' && viewMode === 'find')
                ? 'Name pattern'
                : 'Keyword'
            }
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            sx={{ flex: '1 1 140px', minWidth: 140 }}
          />
        )}

        {showGrepContext && (
          <>
            <FormControl size="small" sx={{ minWidth: 110 }}>
              <InputLabel id="lsa-ctx-label">Context</InputLabel>
              <Select
                labelId="lsa-ctx-label"
                label="Context"
                value={contextMode}
                onChange={(e) => setContextMode(e.target.value as 'none' | 'C' | 'A' | 'B')}
              >
                <MenuItem value="none">None</MenuItem>
                <MenuItem value="C">-C both</MenuItem>
                <MenuItem value="A">-A after</MenuItem>
                <MenuItem value="B">-B before</MenuItem>
              </Select>
            </FormControl>
            {contextMode !== 'none' && (
              <TextField
                size="small"
                label="Ctx lines"
                value={contextLines}
                onChange={(e) => setContextLines(e.target.value)}
                sx={{ width: 88 }}
              />
            )}
          </>
        )}

        {showLines && (
          <TextField
            size="small"
            label="Lines"
            value={lines}
            onChange={(e) => setLines(e.target.value)}
            sx={{ width: 88 }}
          />
        )}

        <Button variant="contained" size="small" onClick={handleRun} disabled={runDisabled} sx={{ px: 2 }}>
          {busy && !following ? 'Running…' : multiFileMode && fileNames.length > 1 ? `Run (${fileNames.length})` : 'Run'}
        </Button>

        {/* Follow / live-tail UI hidden for now — backend wiring kept for a later release. */}
      </Box>

      {multiFileMode && (
        <Typography variant="caption" color="text.secondary">
          Multi-file: leave empty to search the whole path, or pick several files on this server. Each
          file runs as an allowlisted grep; results are merged in Output.
        </Typography>
      )}

      {filesError && (
        <Typography variant="caption" color="error">
          {filesError}
        </Typography>
      )}
      {needsFileList && operation === 'VIEW_FILE' && !filesLoading && remoteFiles.length === 0 && !filesError && (
        <Typography variant="caption" color="text.secondary">
          Connect and refresh to load files from this path, then choose View / Grep / Tail / Find.
        </Typography>
      )}
    </Box>
  )
}
