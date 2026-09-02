import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  ButtonGroup,
  Checkbox,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CancelIcon from '@mui/icons-material/Cancel'
import SkipNextIcon from '@mui/icons-material/SkipNext'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import ScheduleIcon from '@mui/icons-material/Schedule'
import HtmlIcon from '@mui/icons-material/Html'
import DataObjectIcon from '@mui/icons-material/DataObject'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import TableChartIcon from '@mui/icons-material/TableChart'
import { useAppStore } from '../store/app.store'
import {
  groupHistoryIntoSessions,
  groupSessionsByDate,
  parseEndpointResult,
  matchesSearch,
  formatResponseBodyPreview,
  formatRequestBodyPreview,
  parseRequestHeaders,
  parseQueryParamsFromUrl,
  formatKeyValuePreview,
  parseResponseHeaders,
  type EndpointStatus,
  type ParsedEndpointResult,
  type ValidationRunSession,
} from '../utils/validationResults'
import { buildValidationReport, downloadReport, REPORT_MIME_TYPES } from '../utils/reportExport'
import { generateReport, buildReportFilename } from '../../../shared/reports'
import { formatLocalDateTimeFull, formatLocalTime } from '../../../shared/utils/dateTime'
import type { ReportFormat } from '../../../shared/reports'
import type { ValidationResult } from '../../../shared/models'

type StatusFilter = 'all' | EndpointStatus

function getMethodColor(method: string): string {
  switch (method.toLowerCase()) {
    case 'get':
      return '#10B981'
    case 'post':
      return '#3B82F6'
    case 'put':
      return '#F59E0B'
    case 'patch':
      return '#8B5CF6'
    case 'delete':
      return '#EF4444'
    default:
      return '#6B7280'
  }
}

function StatusChip({ status }: { status: EndpointStatus }): React.JSX.Element {
  switch (status) {
    case 'passed':
      return <Chip icon={<CheckCircleIcon />} label="Passed" size="small" color="success" variant="outlined" />
    case 'failed':
      return <Chip icon={<CancelIcon />} label="Failed" size="small" color="error" variant="outlined" />
    case 'skipped':
      return <Chip icon={<SkipNextIcon />} label="Skipped" size="small" color="warning" variant="outlined" />
  }
}

function SessionSummaryBar({ session }: { session: ValidationRunSession }): React.JSX.Element {
  const { summary } = session
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
      {session.runSource === 'scheduler' && (
        <Chip
          icon={<ScheduleIcon />}
          label="Scheduled"
          size="small"
          color="info"
          variant="outlined"
          sx={{ fontWeight: 700 }}
        />
      )}
      <Chip label={`${summary.total} endpoints`} size="small" variant="outlined" />
      <Chip icon={<CheckCircleIcon />} label={`${summary.passed} passed`} size="small" color="success" variant="outlined" />
      <Chip icon={<CancelIcon />} label={`${summary.failed} failed`} size="small" color="error" variant="outlined" />
      <Chip icon={<SkipNextIcon />} label={`${summary.skipped} skipped`} size="small" color="warning" variant="outlined" />
      <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto', fontWeight: 600 }}>
        Avg {summary.avgResponseTimeMs}ms
      </Typography>
    </Box>
  )
}

function CodePreview({ content, loading }: { content: string; loading?: boolean }): React.JSX.Element {
  return (
    <Box
      component="pre"
      sx={{
        p: 2,
        m: 0,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        overflow: 'auto',
        fontSize: '0.78rem',
        fontFamily: 'monospace',
        maxHeight: 280,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
    >
      {loading ? 'Loading…' : content}
    </Box>
  )
}

function CollapsibleSection({
  title,
  badge,
  defaultExpanded = false,
  headerAction,
  children,
}: {
  title: string
  badge?: string
  defaultExpanded?: boolean
  headerAction?: React.ReactNode
  children: React.ReactNode
}): React.JSX.Element {
  const [expanded, setExpanded] = useState(defaultExpanded)

  return (
    <Paper variant="outlined" sx={{ mb: 1.5, overflow: 'hidden' }}>
      <Box
        onClick={() => setExpanded((prev) => !prev)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1.25,
          cursor: 'pointer',
          bgcolor: 'background.paper',
          '&:hover': { bgcolor: 'action.hover' },
        }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {badge && <Chip label={badge} size="small" variant="outlined" sx={{ height: 22, fontSize: '0.7rem' }} />}
          {headerAction}
          <IconButton size="small" aria-label={expanded ? 'Collapse section' : 'Expand section'}>
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>
      </Box>
      <Collapse in={expanded}>
        <Box sx={{ px: 2, pb: 2 }}>{children}</Box>
      </Collapse>
    </Paper>
  )
}

function EndpointDetailPanel({
  parsed,
  validationResult,
  loadingDetail,
}: {
  parsed: ParsedEndpointResult
  validationResult?: ValidationResult | null
  loadingDetail?: boolean
}): React.JSX.Element {
  const result = validationResult ?? parsed.entry.validationResult
  const { entry } = parsed
  const [responseCopied, setResponseCopied] = useState(false)

  const schemaErrors = parsed.errors.filter((e) => e.keyword)
  const generalErrors = parsed.errors.filter((e) => !e.keyword)
  const requestHeaders = parseRequestHeaders(entry.headers)
  const responseHeaders = parseResponseHeaders(result?.responseHeaders)
  const queryParams = parseQueryParamsFromUrl(entry.url)
  const headerCount = Object.keys(requestHeaders).length
  const responseHeaderCount = Object.keys(responseHeaders).length
  const queryCount = queryParams.length
  const responseBodyPreview = formatResponseBodyPreview(result?.responseBody)

  const handleCopyResponseBody = async (event: React.MouseEvent): Promise<void> => {
    event.stopPropagation()
    try {
      await navigator.clipboard.writeText(responseBodyPreview)
      setResponseCopied(true)
      window.setTimeout(() => setResponseCopied(false), 2000)
    } catch {
      setResponseCopied(false)
    }
  }

  return (
    <Box sx={{ bgcolor: 'action.hover', borderRadius: 2, p: 2.5, mt: 1 }}>
      {(parsed.expectedStatusCodes.length > 0 || parsed.actualStatus > 0) && (
        <Box sx={{ mb: 2.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
            Status Code
          </Typography>
          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Actual
              </Typography>
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 800,
                  color:
                    parsed.actualStatus >= 200 && parsed.actualStatus < 300
                      ? 'success.main'
                      : parsed.actualStatus >= 400
                        ? 'error.main'
                        : 'text.primary',
                }}
              >
                {parsed.actualStatus || '—'}
              </Typography>
            </Box>
            {parsed.expectedStatusCodes.length > 0 && (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Expected (per spec)
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
                  {parsed.expectedStatusCodes.map((code) => (
                    <Chip key={code} label={code} size="small" variant="outlined" />
                  ))}
                </Box>
              </Box>
            )}
          </Box>
        </Box>
      )}

      {parsed.skipReason && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {parsed.skipReason}
        </Alert>
      )}

      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, color: 'text.secondary' }}>
        Request
      </Typography>

      <CollapsibleSection title="Request Headers" badge={headerCount > 0 ? String(headerCount) : undefined}>
        <CodePreview content={formatKeyValuePreview(requestHeaders)} />
      </CollapsibleSection>

      <CollapsibleSection title="Query Parameters" badge={queryCount > 0 ? String(queryCount) : undefined}>
        <CodePreview content={formatKeyValuePreview(queryParams)} />
      </CollapsibleSection>

      <CollapsibleSection title="Request Body" badge={entry.body ? 'JSON' : undefined}>
        <CodePreview content={formatRequestBodyPreview(entry.body)} />
      </CollapsibleSection>

      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, mt: 1, color: 'text.secondary' }}>
        Response & Validation
      </Typography>

      {generalErrors.length > 0 && (
        <CollapsibleSection title="Error Messages" badge={String(generalErrors.length)} defaultExpanded>
          {generalErrors.map((err) => (
            <Alert key={err.id} severity="error" sx={{ mb: 1 }}>
              {err.message}
            </Alert>
          ))}
        </CollapsibleSection>
      )}

      {schemaErrors.length > 0 && (
        <CollapsibleSection title="Schema Validation Errors" badge={String(schemaErrors.length)} defaultExpanded>
          <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
            {schemaErrors.map((err, idx) => (
              <Box
                key={err.id}
                sx={{
                  px: 2,
                  py: 1.5,
                  borderBottom: idx < schemaErrors.length - 1 ? '1px solid' : 'none',
                  borderColor: 'divider',
                }}
              >
                <Box sx={{ display: 'flex', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                  {err.path && (
                    <Chip label={err.path} size="small" sx={{ fontFamily: 'monospace', fontSize: '0.7rem' }} />
                  )}
                  {err.keyword && (
                    <Chip
                      label={err.keyword}
                      size="small"
                      color="error"
                      variant="outlined"
                      sx={{ fontSize: '0.7rem' }}
                    />
                  )}
                  <Chip label={err.severity} size="small" variant="outlined" sx={{ fontSize: '0.7rem' }} />
                </Box>
                <Typography variant="body2" color="error.main" sx={{ fontWeight: 500 }}>
                  {err.message}
                </Typography>
                {err.receivedValue !== undefined && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, fontFamily: 'monospace' }}>
                    Received: {JSON.stringify(err.receivedValue)}
                  </Typography>
                )}
              </Box>
            ))}
          </Paper>
        </CollapsibleSection>
      )}

      {parsed.status === 'passed' && parsed.errors.length === 0 && (
        <Alert severity="success" sx={{ mb: 2 }}>
          Response matched the OpenAPI specification for status {parsed.actualStatus}.
        </Alert>
      )}

      {parsed.status === 'passed' && schemaErrors.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          HTTP status {parsed.actualStatus} is valid. The response body has {schemaErrors.length} schema validation
          issue{schemaErrors.length === 1 ? '' : 's'} (shown below).
        </Alert>
      )}

      <CollapsibleSection
        title="Response Headers"
        badge={responseHeaderCount > 0 ? String(responseHeaderCount) : undefined}
      >
        <CodePreview content={formatKeyValuePreview(responseHeaders)} loading={loadingDetail} />
      </CollapsibleSection>

      <CollapsibleSection
        title="Response Body"
        badge={result?.responseBody ? 'JSON' : undefined}
        headerAction={
          <Tooltip title={responseCopied ? 'Copied!' : 'Copy response body'}>
            <IconButton
              size="small"
              aria-label="Copy response body"
              onClick={(event) => void handleCopyResponseBody(event)}
              disabled={loadingDetail || !result?.responseBody}
            >
              <ContentCopyIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        }
      >
        <CodePreview content={responseBodyPreview} loading={loadingDetail} />
      </CollapsibleSection>
    </Box>
  )
}

function EndpointResultRow({
  parsed,
  expanded,
  onToggle,
  validationResult,
  loadingDetail,
}: {
  parsed: ParsedEndpointResult
  expanded: boolean
  onToggle: () => void
  validationResult?: ValidationResult | null
  loadingDetail?: boolean
}): React.JSX.Element {
  const { entry } = parsed

  return (
    <Paper variant="outlined" sx={{ mb: 1, overflow: 'hidden' }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          px: 2,
          py: 1.5,
          cursor: 'pointer',
          '&:hover': { bgcolor: 'action.hover' },
        }}
        onClick={onToggle}
      >
        <StatusChip status={parsed.status} />
        <Chip
          label={entry.method}
          size="small"
          sx={{
            fontWeight: 800,
            fontSize: '0.65rem',
            color: getMethodColor(entry.method),
            border: `1px solid ${getMethodColor(entry.method)}`,
            bgcolor: 'transparent',
          }}
        />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
            {parsed.endpointLabel}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
            {entry.url}
          </Typography>
        </Box>
        <Chip label={`HTTP ${parsed.actualStatus || '—'}`} size="small" variant="outlined" />
        <Typography variant="body2" sx={{ fontWeight: 600, fontFamily: 'monospace', minWidth: 56, textAlign: 'right' }}>
          {parsed.responseTimeMs}ms
        </Typography>
        <IconButton size="small" onClick={(e) => { e.stopPropagation(); onToggle() }}>
          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Box>
      <Collapse in={expanded}>
        <Box sx={{ px: 2, pb: 2 }}>
          <EndpointDetailPanel
            parsed={parsed}
            validationResult={validationResult}
            loadingDetail={loadingDetail}
          />
        </Box>
      </Collapse>
    </Paper>
  )
}

export default function Results(): React.JSX.Element {
  const history = useAppStore((s) => s.history)
  const activeProjectId = useAppStore((s) => s.activeProjectId)
  const reloadHistory = useAppStore((s) => s.reloadHistory)
  const projects = useAppStore((s) => s.projects)
  const environments = useAppStore((s) => s.environments)
  const activeEnvId = useAppStore((s) => s.activeEnvId)
  const deleteValidationSession = useAppStore((s) => s.deleteValidationSession)
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [deleteConfirmSession, setDeleteConfirmSession] = useState<ValidationRunSession | null>(null)
  const [selectedForDeletion, setSelectedForDeletion] = useState<string[]>([])
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [detailCache, setDetailCache] = useState<Record<string, ValidationResult>>({})
  const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null)
  const detailCacheRef = useRef(detailCache)
  detailCacheRef.current = detailCache

  useEffect(() => {
    void reloadHistory()
  }, [activeProjectId, reloadHistory])

  useEffect(() => {
    if (!expandedId || detailCacheRef.current[expandedId]) return

    let cancelled = false
    setDetailLoadingId(expandedId)

    window.api.getValidationResult(expandedId).then((result) => {
      if (cancelled || !result) return
      setDetailCache((prev) => {
        if (prev[expandedId]) return prev
        return { ...prev, [expandedId]: result }
      })
    }).finally(() => {
      if (!cancelled) setDetailLoadingId(null)
    })

    return () => {
      cancelled = true
    }
  }, [expandedId])

  useEffect(() => {
    setDetailCache({})
    setExpandedId(null)
  }, [activeProjectId])

  const sessions = useMemo(() => groupHistoryIntoSessions(history), [history])
  const sessionGroups = useMemo(() => groupSessionsByDate(sessions), [sessions])

  useEffect(() => {
    if (sessions.length === 0) {
      setSelectedSessionId(null)
      return
    }
    const stillExists = sessions.some((s) => s.id === selectedSessionId)
    if (!stillExists) {
      setSelectedSessionId(sessions[0].id)
    }
  }, [sessions, selectedSessionId])

  const selectedSession = sessions.find((s) => s.id === selectedSessionId) ?? sessions[0]

  const activeProject = projects.find((p) => p.id === activeProjectId)
  const activeEnvironment = environments.find((e) => e.id === activeEnvId)

  const handleExport = (format: ReportFormat): void => {
    if (!selectedSession) return
    const report = buildValidationReport(
      selectedSession,
      activeProject?.name ?? 'Unknown Project',
      activeEnvironment?.name ?? 'Unknown Environment'
    )
    const content = generateReport(report, format)
    const filename = buildReportFilename(report, format)
    downloadReport(content, filename, REPORT_MIME_TYPES[format])
  }

  const filteredEndpoints = useMemo(() => {
    if (!selectedSession) return []
    return selectedSession.entries
      .map(parseEndpointResult)
      .filter((parsed) => {
        if (statusFilter !== 'all' && parsed.status !== statusFilter) return false
        return matchesSearch(parsed, searchQuery)
      })
  }, [selectedSession, statusFilter, searchQuery])

  const handleSessionSelect = (sessionId: string): void => {
    setSelectedSessionId(sessionId)
    setExpandedId(null)
  }

  const handleDeleteSession = async (): Promise<void> => {
    if (!deleteConfirmSession) return
    const runIds = deleteConfirmSession.entries.map((entry) => entry.id)
    await deleteValidationSession(runIds)
    setDetailCache({})
    setExpandedId(null)
    if (selectedSessionId === deleteConfirmSession.id) {
      setSelectedSessionId(null)
    }
    setDeleteConfirmSession(null)
  }

  const handleSelectAll = (): void => {
    const allSessionIds = sessions.map((s) => s.id)
    if (selectedForDeletion.length === allSessionIds.length && allSessionIds.length > 0) {
      setSelectedForDeletion([])
    } else {
      setSelectedForDeletion(allSessionIds)
    }
  }

  const handleDeleteSelected = async (): Promise<void> => {
    if (selectedForDeletion.length === 0) return
    const runIdsToDelete = selectedForDeletion.flatMap(sessionId => {
      const session = sessions.find(s => s.id === sessionId)
      return session ? session.entries.map(e => e.id) : []
    })
    await deleteValidationSession(runIdsToDelete)
    setSelectedForDeletion([])
    setDetailCache({})
    setExpandedId(null)
    if (selectedSessionId && selectedForDeletion.includes(selectedSessionId)) {
      setSelectedSessionId(null)
    }
  }

  const toggleGroupCollapse = (dateKey: string): void => {
    setCollapsedGroups(prev => ({ ...prev, [dateKey]: !prev[dateKey] }))
  }

  const toggleSessionSelection = (sessionId: string): void => {
    setSelectedForDeletion(prev => 
      prev.includes(sessionId) ? prev.filter(id => id !== sessionId) : [...prev, sessionId]
    )
  }

  return (
    <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Run sessions list */}
      <Box
        sx={{
          width: 320,
          minWidth: 320,
          borderRight: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <Box sx={{ p: 2.5, flexShrink: 0 }}>
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>
            Validation Runs
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {sessions.length} run{sessions.length !== 1 ? 's' : ''} in history
          </Typography>
        </Box>
        <Divider />
        {sessions.length > 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Checkbox 
                size="small" 
                checked={selectedForDeletion.length === sessions.length && sessions.length > 0}
                indeterminate={selectedForDeletion.length > 0 && selectedForDeletion.length < sessions.length}
                onChange={handleSelectAll}
                sx={{ p: 0.5, mr: 1 }}
              />
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {selectedForDeletion.length > 0 ? `${selectedForDeletion.length} selected` : 'Select All'}
              </Typography>
            </Box>
            {selectedForDeletion.length > 0 && (
              <Button 
                size="small" 
                color="error" 
                variant="text" 
                onClick={handleDeleteSelected}
                sx={{ textTransform: 'none', fontWeight: 700 }}
              >
                Delete Selected
              </Button>
            )}
          </Box>
        )}
        <List sx={{ flex: 1, overflowY: 'auto', py: 1 }}>
          {sessions.length === 0 ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <InfoOutlinedIcon sx={{ fontSize: 40, color: 'text.secondary', mb: 1 }} />
              <Typography variant="body2" color="text.secondary">
                No validation runs yet. Use the Validation Runner to execute tests.
              </Typography>
            </Box>
          ) : (
            sessionGroups.map((group) => (
              <Box key={group.dateKey} sx={{ mb: 1.5 }}>
                <Box
                  onClick={() => toggleGroupCollapse(group.dateKey)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    px: 2,
                    py: 1,
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'action.hover' }
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 800,
                      color: 'text.secondary',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {group.dateLabel}
                  </Typography>
                  <IconButton size="small" sx={{ p: 0.25 }}>
                    {collapsedGroups[group.dateKey] ? <ExpandMoreIcon fontSize="small" /> : <ExpandLessIcon fontSize="small" />}
                  </IconButton>
                </Box>
                <Collapse in={!collapsedGroups[group.dateKey]}>
                  {group.sessions.map((session) => {
                    const isSelected = session.id === selectedSession?.id
                    const timeLabel = session.startedAt
                      ? formatLocalTime(session.startedAt) || formatLocalDateTimeFull(session.startedAt)
                      : 'Unknown time'
                    return (
                      <ListItemButton
                        key={session.id}
                        selected={isSelected}
                        onClick={() => handleSessionSelect(session.id)}
                        sx={{
                          mx: 1,
                          mb: 0.5,
                          borderRadius: '10px',
                          border: '1px solid',
                          borderColor: isSelected ? 'primary.main' : 'transparent',
                          pr: 1,
                          pl: 0.5,
                        }}
                      >
                        <Checkbox 
                          size="small"
                          checked={selectedForDeletion.includes(session.id)}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleSessionSelection(session.id);
                          }}
                          sx={{ p: 0.5, mr: 0.5 }}
                        />
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                {timeLabel}
                              </Typography>
                              {session.runSource === 'scheduler' && (
                                <Chip
                                  icon={<ScheduleIcon sx={{ '&&': { fontSize: 14 } }} />}
                                  label="Scheduled"
                                  size="small"
                                  color="info"
                                  variant="outlined"
                                  sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700 }}
                                />
                              )}
                            </Box>
                          }
                          secondary={
                            <Box sx={{ display: 'flex', gap: 0.5, mt: 0.75, flexWrap: 'wrap' }}>
                              <Chip label={`${session.summary.total} APIs`} size="small" sx={{ height: 20, fontSize: '0.65rem' }} />
                              {session.summary.passed > 0 && (
                                <Chip label={`${session.summary.passed} ✓`} size="small" color="success" sx={{ height: 20, fontSize: '0.65rem' }} />
                              )}
                              {session.summary.failed > 0 && (
                                <Chip label={`${session.summary.failed} ✗`} size="small" color="error" sx={{ height: 20, fontSize: '0.65rem' }} />
                              )}
                              {session.summary.skipped > 0 && (
                                <Chip label={`${session.summary.skipped} ⊘`} size="small" color="warning" sx={{ height: 20, fontSize: '0.65rem' }} />
                              )}
                            </Box>
                          }
                        />
                        <Tooltip title="Delete run">
                          <IconButton
                            size="small"
                            aria-label="Delete validation run"
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeleteConfirmSession(session)
                            }}
                            sx={{
                              color: 'text.secondary',
                              '&:hover': { color: 'error.main', bgcolor: 'action.hover' },
                            }}
                          >
                            <DeleteOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </ListItemButton>
                    )
                  })}
                </Collapse>
              </Box>
            ))
          )}
        </List>
      </Box>

      {/* Main content */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {!selectedSession ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <InfoOutlinedIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
              No Results to Display
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Run validations from the Validation Runner page to see endpoint-level results here.
            </Typography>
          </Box>
        ) : (
          <>
            {/* Run summary */}
            <Box sx={{ p: 3, flexShrink: 0, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, mb: 2 }}>
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                    <Typography variant="h6" sx={{ fontWeight: 800 }}>
                      Run Summary
                    </Typography>
                    {selectedSession.runSource === 'scheduler' && (
                      <Chip
                        icon={<ScheduleIcon />}
                        label="Scheduled run"
                        size="small"
                        color="info"
                        variant="outlined"
                        sx={{ fontWeight: 700 }}
                      />
                    )}
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {selectedSession.startedAt ? formatLocalDateTimeFull(selectedSession.startedAt) : ''}
                  </Typography>
                </Box>
                <ButtonGroup variant="outlined" size="small">
                  <Tooltip title="Export HTML report">
                    <Button startIcon={<HtmlIcon />} onClick={() => handleExport('html')}>
                      HTML
                    </Button>
                  </Tooltip>
                  <Tooltip title="Export JSON report">
                    <Button startIcon={<DataObjectIcon />} onClick={() => handleExport('json')}>
                      JSON
                    </Button>
                  </Tooltip>
                  <Tooltip title="Export CSV summary">
                    <Button startIcon={<TableChartIcon />} onClick={() => handleExport('csv')}>
                      CSV
                    </Button>
                  </Tooltip>
                </ButtonGroup>
              </Box>
              <SessionSummaryBar session={selectedSession} />
            </Box>

            {/* Filters */}
            <Box
              sx={{
                px: 3,
                py: 2,
                flexShrink: 0,
                display: 'flex',
                flexWrap: 'wrap',
                gap: 2,
                alignItems: 'center',
                borderBottom: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Tabs
                value={statusFilter}
                onChange={(_, v) => setStatusFilter(v)}
                sx={{ minHeight: 36, '& .MuiTab-root': { minHeight: 36, py: 0 } }}
              >
                <Tab label={`All (${selectedSession.summary.total})`} value="all" />
                <Tab label={`Passed (${selectedSession.summary.passed})`} value="passed" />
                <Tab label={`Failed (${selectedSession.summary.failed})`} value="failed" />
                <Tab label={`Skipped (${selectedSession.summary.skipped})`} value="skipped" />
              </Tabs>
              <TextField
                size="small"
                placeholder="Search endpoints, URLs, errors…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                sx={{ ml: 'auto', minWidth: 260 }}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" color="action" />
                      </InputAdornment>
                    ),
                  },
                }}
              />
            </Box>

            {/* Endpoint results */}
            <Box sx={{ flex: 1, overflowY: 'auto', p: 3 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2, color: 'text.secondary' }}>
                Endpoint Results ({filteredEndpoints.length})
              </Typography>

              {filteredEndpoints.length === 0 ? (
                <Alert severity="info">
                  No endpoints match the current filter{searchQuery ? ` or search "${searchQuery}"` : ''}.
                </Alert>
              ) : (
                filteredEndpoints.map((parsed) => (
                  <EndpointResultRow
                    key={parsed.entry.id}
                    parsed={parsed}
                    expanded={expandedId === parsed.entry.id}
                    validationResult={detailCache[parsed.entry.id]}
                    loadingDetail={detailLoadingId === parsed.entry.id}
                    onToggle={() =>
                      setExpandedId(expandedId === parsed.entry.id ? null : parsed.entry.id)
                    }
                  />
                ))
              )}
            </Box>
          </>
        )}
      </Box>

      <Dialog
        open={deleteConfirmSession !== null}
        onClose={() => setDeleteConfirmSession(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700, color: 'error.main' }}>Delete Validation Run?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            This will permanently delete this validation run and all {deleteConfirmSession?.summary.total ?? 0}{' '}
            endpoint results in the group. This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setDeleteConfirmSession(null)} sx={{ color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button onClick={() => void handleDeleteSession()} variant="contained" color="error">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
