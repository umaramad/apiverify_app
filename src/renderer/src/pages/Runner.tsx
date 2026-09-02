import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormHelperText,
  IconButton,
  InputAdornment,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography
} from '@mui/material'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import StopIcon from '@mui/icons-material/Stop'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CancelIcon from '@mui/icons-material/Cancel'
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty'
import SearchIcon from '@mui/icons-material/Search'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import AddIcon from '@mui/icons-material/Add'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import { useAppStore } from '../store/app.store'
import { useShallow } from 'zustand/react/shallow'
import AppErrorAlert from '../components/AppErrorAlert'
import RunnerDebugConsole from '../components/RunnerDebugConsole'
import { AppError, toAppError } from '../../../shared/errors'
import { extractEndpointsFromSpec } from '../../../shared/engine/endpointExtractor'
import {
  getSpecServerBaseUrl,
  resolveEnvironmentBaseUrl
} from '../../../shared/engine/environmentBaseUrl'
import {
  endpointToManualRequest,
  manualRequestToEndpoint,
  isManualSpecContent,
  type ManualRequest
} from '../../../shared/manualCollection'
import type { ApiEndpoint } from '../../../shared/models'
import { buildCurlCommands } from '../utils/curl'
import type {
  ValidationRunProgressResult,
  ValidationRunProgressEvent,
  ValidationConsoleLogEntry
} from '../../../shared/models/validationRunner'

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

type RunStatus = 'idle' | 'running' | 'complete' | 'cancelled' | 'error'

type ManualRequestDialogComponent = React.ComponentType<{
  open: boolean
  mode: 'add' | 'edit'
  initialRequest?: ManualRequest
  onClose: () => void
  onSave: (request: ManualRequest) => Promise<{ success: boolean; error?: string }>
}>

export default function Runner(): React.JSX.Element {
  const {
    projects,
    activeProjectId,
    selectProject,
    environments,
    activeEnvId,
    setActiveEnvironment,
    specs,
    activeSpecId,
    selectSpec,
    parsedSpec,
    loadSpecs,
    loadEnvironments,
    reloadHistory,
    saveEndpointsAsCollection,
    addEndpointsToManualCollection
  } = useAppStore(
    useShallow((s) => ({
      projects: s.projects,
      activeProjectId: s.activeProjectId,
      selectProject: s.selectProject,
      environments: s.environments,
      activeEnvId: s.activeEnvId,
      setActiveEnvironment: s.setActiveEnvironment,
      specs: s.specs,
      activeSpecId: s.activeSpecId,
      selectSpec: s.selectSpec,
      parsedSpec: s.parsedSpec,
      loadSpecs: s.loadSpecs,
      loadEnvironments: s.loadEnvironments,
      reloadHistory: s.reloadHistory,
      saveEndpointsAsCollection: s.saveEndpointsAsCollection,
      addEndpointsToManualCollection: s.addEndpointsToManualCollection
    }))
  )

  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [selectedEnvId, setSelectedEnvId] = useState<string>('')
  const [selectedSpecId, setSelectedSpecId] = useState<string>('')
  const [endpoints, setEndpoints] = useState<ApiEndpoint[]>([])
  const [selectedEndpointIds, setSelectedEndpointIds] = useState<Set<string>>(new Set())
  const [selectionOrder, setSelectionOrder] = useState<string[]>([])
  const [endpointOverrides, setEndpointOverrides] = useState<Record<string, ApiEndpoint>>({})
  const [endpointFilter, setEndpointFilter] = useState('')
  const [saveCollectionOpen, setSaveCollectionOpen] = useState(false)
  const [addToCollectionOpen, setAddToCollectionOpen] = useState(false)
  const [targetCollectionId, setTargetCollectionId] = useState('')
  const [collectionName, setCollectionName] = useState('')
  const [collectionBaseUrl, setCollectionBaseUrl] = useState('{{baseUrl}}')
  const [savingCollection, setSavingCollection] = useState(false)
  const [collectionMessage, setCollectionMessage] = useState<string | null>(null)
  const [curlOpen, setCurlOpen] = useState(false)
  const [curlCommand, setCurlCommand] = useState('')
  const [curlMessage, setCurlMessage] = useState<string | null>(null)
  const [customizeEndpointId, setCustomizeEndpointId] = useState<string | null>(null)
  const [CustomizeDialog, setCustomizeDialog] = useState<ManualRequestDialogComponent | null>(null)
  const [draggingEndpointId, setDraggingEndpointId] = useState<string | null>(null)
  const [dragOverEndpointId, setDragOverEndpointId] = useState<string | null>(null)
  const [runStatus, setRunStatus] = useState<RunStatus>('idle')
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [results, setResults] = useState<ValidationRunProgressResult[]>([])
  const [summary, setSummary] = useState<ValidationRunProgressEvent['summary'] | null>(null)
  const [runError, setRunError] = useState<AppError | null>(null)
  const [consoleLogs, setConsoleLogs] = useState<ValidationConsoleLogEntry[]>([])
  const [consoleExpanded, setConsoleExpanded] = useState(true)

  useEffect(() => {
    if (activeProjectId) setSelectedProjectId(activeProjectId)
  }, [activeProjectId])

  useEffect(() => {
    if (activeEnvId) setSelectedEnvId(activeEnvId)
  }, [activeEnvId])

  useEffect(() => {
    if (activeSpecId) setSelectedSpecId(activeSpecId)
  }, [activeSpecId])

  useEffect(() => {
    if (parsedSpec && selectedProjectId) {
      const extracted = extractEndpointsFromSpec(selectedProjectId, parsedSpec)
      setEndpoints(extracted)
      setSelectedEndpointIds(new Set(extracted.map((e) => e.id)))
      setSelectionOrder(extracted.map((e) => e.id))
      setEndpointOverrides({})
      setEndpointFilter('')
    } else {
      setEndpoints([])
      setSelectedEndpointIds(new Set())
      setSelectionOrder([])
      setEndpointOverrides({})
      setEndpointFilter('')
    }
  }, [parsedSpec, selectedProjectId])

  useEffect(() => {
    const unsubscribe = window.api.onValidationProgress((event) => {
      if (event.type === 'started') {
        setProgress({ current: 0, total: event.total ?? 0 })
        setResults([])
        setSummary(null)
        setRunError(null)
        setConsoleLogs([])
        setConsoleExpanded(true)
      } else if (event.type === 'log' && event.log) {
        setConsoleLogs((prev) => [...prev, event.log!])
      } else if (event.type === 'progress' && event.result) {
        setProgress({ current: event.current ?? 0, total: event.total ?? 0 })
        setResults((prev) => [...prev, event.result!])
      } else if (event.type === 'complete' || event.type === 'cancelled') {
        setRunStatus(event.type === 'cancelled' ? 'cancelled' : 'complete')
        setSummary(event.summary ?? null)
        setProgress({
          current: event.current ?? 0,
          total: event.total ?? 0
        })
        reloadHistory()
      } else if (event.type === 'error') {
        setRunStatus('error')
        setRunError(
          toAppError({
            code: 'VALIDATION',
            message: event.error ?? 'Validation run failed',
            retryable: true
          })
        )
      }
    })
    return unsubscribe
  }, [reloadHistory])

  useEffect(() => {
    if (customizeEndpointId === null) {
      setCustomizeDialog(null)
      return
    }

    let cancelled = false
    void import('../components/ManualRequestDialog').then((module) => {
      if (!cancelled) {
        setCustomizeDialog(() => module.default)
      }
    })

    return () => {
      cancelled = true
    }
  }, [customizeEndpointId])

  const handleProjectChange = useCallback(
    async (projectId: string) => {
      setSelectedProjectId(projectId)
      setSelectedSpecId('')
      setSelectedEnvId('')
      setEndpoints([])
      setSelectedEndpointIds(new Set())
      setSelectionOrder([])
      setEndpointOverrides({})
      setEndpointFilter('')
      await selectProject(projectId)
      await loadSpecs()
      await loadEnvironments()
    },
    [selectProject, loadSpecs, loadEnvironments]
  )

  const handleSpecChange = useCallback(
    async (specId: string) => {
      setSelectedSpecId(specId)
      await selectSpec(specId || null)
    },
    [selectSpec]
  )

  const handleEnvChange = useCallback(
    async (envId: string) => {
      setSelectedEnvId(envId)
      await setActiveEnvironment(envId || null)
    },
    [setActiveEnvironment]
  )

  const orderedEndpoints = useMemo(() => {
    const orderIndex = new Map(selectionOrder.map((id, index) => [id, index]))
    return [...endpoints].sort((left, right) => {
      const leftIndex = orderIndex.get(left.id) ?? Number.MAX_SAFE_INTEGER
      const rightIndex = orderIndex.get(right.id) ?? Number.MAX_SAFE_INTEGER
      return leftIndex - rightIndex
    })
  }, [endpoints, selectionOrder])

  const filteredEndpoints = useMemo(() => {
    const query = endpointFilter.trim().toLowerCase()
    if (!query) return orderedEndpoints

    return orderedEndpoints.filter(
      (endpoint) =>
        endpoint.path.toLowerCase().includes(query) ||
        endpoint.method.toLowerCase().includes(query) ||
        endpoint.name.toLowerCase().includes(query)
    )
  }, [orderedEndpoints, endpointFilter])

  const filteredSelectedCount = useMemo(
    () => filteredEndpoints.filter((endpoint) => selectedEndpointIds.has(endpoint.id)).length,
    [filteredEndpoints, selectedEndpointIds]
  )

  const allFilteredSelected =
    filteredEndpoints.length > 0 && filteredSelectedCount === filteredEndpoints.length
  const someFilteredSelected = filteredSelectedCount > 0 && !allFilteredSelected

  const endpointMap = useMemo(
    () => new Map(endpoints.map((endpoint) => [endpoint.id, endpoint])),
    [endpoints]
  )

  const getEffectiveEndpoint = useCallback(
    (endpointId: string): ApiEndpoint | undefined => {
      const base = endpointMap.get(endpointId)
      if (!base) return undefined
      const override = endpointOverrides[endpointId]
      return override ? { ...base, ...override, id: base.id, projectId: base.projectId } : base
    },
    [endpointMap, endpointOverrides]
  )

  const toggleSelectAll = (): void => {
    if (allFilteredSelected) {
      setSelectedEndpointIds((prev) => {
        const next = new Set(prev)
        filteredEndpoints.forEach((endpoint) => next.delete(endpoint.id))
        return next
      })
      return
    }

    setSelectedEndpointIds((prev) => {
      const next = new Set(prev)
      filteredEndpoints.forEach((endpoint) => next.add(endpoint.id))
      return next
    })
    setSelectionOrder((prev) => {
      const existing = new Set(prev)
      const next = [...prev]
      for (const endpoint of filteredEndpoints) {
        if (!existing.has(endpoint.id)) {
          next.push(endpoint.id)
        }
      }
      return next
    })
  }

  const toggleEndpoint = (id: string): void => {
    setSelectedEndpointIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
        setSelectionOrder((order) => (order.includes(id) ? order : [...order, id]))
      }
      return next
    })
  }

  const moveEndpointInOrder = useCallback(
    (fromId: string, toId: string): void => {
      if (fromId === toId) return

      setSelectionOrder((prev) => {
        const normalized = [...prev]
        for (const endpoint of endpoints) {
          if (!normalized.includes(endpoint.id)) {
            normalized.push(endpoint.id)
          }
        }

        const fromIndex = normalized.indexOf(fromId)
        const toIndex = normalized.indexOf(toId)
        if (fromIndex < 0 || toIndex < 0) return prev

        const next = [...normalized]
        const [moved] = next.splice(fromIndex, 1)
        next.splice(toIndex, 0, moved)
        return next
      })
    },
    [endpoints]
  )

  const selectedEndpoints = useMemo(
    () =>
      selectionOrder
        .filter((id) => selectedEndpointIds.has(id))
        .map((id) => getEffectiveEndpoint(id))
        .filter((endpoint): endpoint is ApiEndpoint => endpoint !== undefined),
    [selectionOrder, selectedEndpointIds, getEffectiveEndpoint]
  )

  const customizingEndpoint = customizeEndpointId
    ? getEffectiveEndpoint(customizeEndpointId)
    : undefined

  const manualCollections = useMemo(
    () => specs.filter((spec) => isManualSpecContent(spec.content)),
    [specs]
  )

  const handleSaveCollection = async (): Promise<void> => {
    if (!collectionName.trim() || selectedEndpoints.length === 0) return

    setSavingCollection(true)
    setCollectionMessage(null)
    const result = await saveEndpointsAsCollection(
      collectionName.trim(),
      selectedEndpoints,
      collectionBaseUrl.trim() || '{{baseUrl}}'
    )
    setSavingCollection(false)

    if (result.success) {
      setCollectionMessage(`Collection "${collectionName.trim()}" saved successfully.`)
      setSaveCollectionOpen(false)
      setCollectionName('')
      setCollectionBaseUrl('{{baseUrl}}')
      await loadSpecs()
    } else {
      setCollectionMessage(result.error ?? 'Failed to save collection.')
    }
  }

  const handleAddToExistingCollection = async (): Promise<void> => {
    if (!targetCollectionId || selectedEndpoints.length === 0) return

    setSavingCollection(true)
    setCollectionMessage(null)
    const target = manualCollections.find((collection) => collection.id === targetCollectionId)
    const result = await addEndpointsToManualCollection(targetCollectionId, selectedEndpoints)
    setSavingCollection(false)

    if (result.success) {
      const skipped = result.skippedCount ?? 0
      const added = result.addedCount ?? selectedEndpoints.length
      setCollectionMessage(
        `${added} API${added === 1 ? '' : 's'} added to "${target?.name ?? 'collection'}"${skipped > 0 ? `; ${skipped} already existed.` : '.'}`
      )
      setAddToCollectionOpen(false)
      setTargetCollectionId('')
      await loadSpecs()
    } else {
      setCollectionMessage(result.error ?? 'Failed to add APIs to collection.')
    }
  }

  const handleShowCurl = (): void => {
    if (!selectedEnvironment || selectedEndpoints.length === 0) return
    setCurlCommand(buildCurlCommands(selectedEnvironment, selectedEndpoints, parsedSpec))
    setCurlMessage(null)
    setCurlOpen(true)
  }

  const handleCopyCurl = async (): Promise<void> => {
    await navigator.clipboard.writeText(curlCommand)
    setCurlMessage('cURL command copied.')
  }

  const handleCustomizeSave = async (
    request: ManualRequest
  ): Promise<{ success: boolean; error?: string }> => {
    if (!customizeEndpointId || !selectedProjectId) {
      return { success: false, error: 'Endpoint not found.' }
    }

    const customized = manualRequestToEndpoint(selectedProjectId, customizeEndpointId, request)
    setEndpointOverrides((prev) => ({
      ...prev,
      [customizeEndpointId]: customized
    }))
    setCustomizeEndpointId(null)
    return { success: true }
  }

  const selectedEnvironment = environments.find((e) => e.id === selectedEnvId)
  const selectedProject = projects.find((p) => p.id === selectedProjectId)
  const resolvedBaseUrl = useMemo(() => {
    if (!selectedEnvironment) return ''
    const specBaseUrl = parsedSpec ? getSpecServerBaseUrl(parsedSpec) : undefined
    return resolveEnvironmentBaseUrl(selectedEnvironment, specBaseUrl)
  }, [selectedEnvironment, parsedSpec])

  const canStart =
    runStatus !== 'running' &&
    selectedProjectId &&
    selectedEnvId &&
    selectedSpecId &&
    parsedSpec &&
    selectedEndpoints.length > 0

  const handleStart = async (): Promise<void> => {
    if (!canStart || !selectedProject || !selectedEnvironment) return

    setRunStatus('running')
    setResults([])
    setSummary(null)
    setRunError(null)
    setConsoleLogs([])
    setConsoleExpanded(true)
    setProgress({ current: 0, total: selectedEndpoints.length })

    try {
      await window.api.startValidationRun({
        project: { id: selectedProject.id, name: selectedProject.name },
        environment: {
          id: selectedEnvironment.id,
          projectId: selectedEnvironment.projectId,
          name: selectedEnvironment.name,
          variables: selectedEnvironment.variables,
          type: selectedEnvironment.type,
          baseUrl: selectedEnvironment.baseUrl,
          defaultHeaders: selectedEnvironment.defaultHeaders,
          authConfig: selectedEnvironment.authConfig,
          isActive: selectedEnvironment.isActive
        },
        endpoints: selectedEndpoints,
        parsedSpec
      })
    } catch (err) {
      setRunStatus('error')
      setRunError(toAppError(err, 'Failed to start validation run'))
    }
  }

  const handleCancel = async (): Promise<void> => {
    await window.api.cancelValidationRun()
  }

  const progressPercent =
    progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0

  return (
    <>
      <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
        {/* Configuration panel */}
        <Box
          sx={{
            width: 380,
            minWidth: 380,
            borderRight: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          <Box sx={{ p: 3, flexShrink: 0 }}>
            <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>
              Run Configuration
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Select workspace, API specification, and environment to validate.
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Project</InputLabel>
                <Select
                  label="Project"
                  value={selectedProjectId}
                  onChange={(e) => handleProjectChange(e.target.value)}
                  disabled={runStatus === 'running'}
                >
                  {projects.map((p) => (
                    <MenuItem key={p.id} value={p.id}>
                      {p.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl
                fullWidth
                size="small"
                disabled={!selectedProjectId || runStatus === 'running'}
              >
                <InputLabel>API Specification</InputLabel>
                <Select
                  label="API Specification"
                  value={selectedSpecId}
                  onChange={(e) => handleSpecChange(e.target.value)}
                >
                  {specs.map((spec) => (
                    <MenuItem key={spec.id} value={spec.id}>
                      {spec.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl
                fullWidth
                size="small"
                disabled={!selectedProjectId || runStatus === 'running'}
              >
                <InputLabel>Environment</InputLabel>
                <Select
                  label="Environment"
                  value={selectedEnvId}
                  onChange={(e) => handleEnvChange(e.target.value)}
                >
                  {environments.map((env) => (
                    <MenuItem key={env.id} value={env.id}>
                      {env.name}
                      {env.isActive ? ' (active)' : ''}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {selectedEnvironment && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: -1 }}>
                  {resolvedBaseUrl
                    ? `Resolved base URL: ${resolvedBaseUrl}`
                    : 'No base URL resolved. Set Base URL on the environment or add a baseUrl variable.'}
                </Typography>
              )}
            </Box>

            <Box sx={{ display: 'flex', gap: 1.5, mt: 3 }}>
              <Button
                variant="contained"
                fullWidth
                startIcon={
                  runStatus === 'running' ? (
                    <CircularProgress size={16} color="inherit" />
                  ) : (
                    <PlayArrowIcon />
                  )
                }
                onClick={handleStart}
                disabled={!canStart}
              >
                {runStatus === 'running' ? 'Running…' : 'Start Validation'}
              </Button>
              <Button
                variant="outlined"
                color="error"
                startIcon={<StopIcon />}
                onClick={handleCancel}
                disabled={runStatus !== 'running'}
                sx={{ minWidth: 110 }}
              >
                Cancel
              </Button>
            </Box>
          </Box>

          <Divider />

          {/* Endpoint selection */}
          <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <Box
              sx={{
                px: 3,
                py: 1.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderBottom: '1px solid',
                borderColor: 'divider'
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Checkbox
                  size="small"
                  checked={allFilteredSelected}
                  indeterminate={someFilteredSelected}
                  onChange={toggleSelectAll}
                  disabled={filteredEndpoints.length === 0 || runStatus === 'running'}
                />
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  APIs ({selectedEndpointIds.size}/{endpoints.length}
                  {endpointFilter.trim() ? ` · ${filteredEndpoints.length} shown` : ''})
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<ContentCopyIcon />}
                  onClick={handleShowCurl}
                  disabled={
                    selectedEndpoints.length === 0 ||
                    runStatus === 'running' ||
                    !selectedEnvironment
                  }
                >
                  cURL
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<AddIcon />}
                  onClick={() => {
                    setCollectionMessage(null)
                    setTargetCollectionId(manualCollections[0]?.id ?? '')
                    setAddToCollectionOpen(true)
                  }}
                  disabled={
                    selectedEndpoints.length === 0 ||
                    runStatus === 'running' ||
                    manualCollections.length === 0
                  }
                >
                  Add to Existing
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<SaveOutlinedIcon />}
                  onClick={() => {
                    setCollectionMessage(null)
                    setSaveCollectionOpen(true)
                  }}
                  disabled={selectedEndpoints.length === 0 || runStatus === 'running'}
                >
                  Save Collection
                </Button>
              </Box>
            </Box>

            {collectionMessage && (
              <Box sx={{ px: 3, pb: 1 }}>
                <Alert
                  severity={collectionMessage.includes('successfully') ? 'success' : 'error'}
                  onClose={() => setCollectionMessage(null)}
                >
                  {collectionMessage}
                </Alert>
              </Box>
            )}

            <Box sx={{ px: 3, pb: 1.5 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Filter by method, path, or name…"
                value={endpointFilter}
                onChange={(e) => setEndpointFilter(e.target.value)}
                disabled={endpoints.length === 0 || runStatus === 'running'}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" color="action" />
                      </InputAdornment>
                    )
                  }
                }}
              />
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mt: 0.75 }}
              >
                Drag APIs using the handle to change execution order for validation and saved
                collections.
              </Typography>
            </Box>

            <Box sx={{ flex: 1, overflowY: 'auto', px: 1, py: 1 }}>
              {endpoints.length === 0 ? (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ p: 2, textAlign: 'center' }}
                >
                  {selectedSpecId
                    ? 'No endpoints found in this specification.'
                    : 'Select an API specification to list endpoints.'}
                </Typography>
              ) : filteredEndpoints.length === 0 ? (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ p: 2, textAlign: 'center' }}
                >
                  No endpoints match your filter.
                </Typography>
              ) : (
                filteredEndpoints.map((ep) => {
                  const effectiveEndpoint = getEffectiveEndpoint(ep.id) ?? ep
                  const isCustomized = Boolean(endpointOverrides[ep.id])
                  const isDragging = draggingEndpointId === ep.id
                  const isDragOver = dragOverEndpointId === ep.id && draggingEndpointId !== ep.id

                  return (
                    <Box
                      key={ep.id}
                      onDragOver={(event) => {
                        if (runStatus === 'running') return
                        event.preventDefault()
                        setDragOverEndpointId(ep.id)
                      }}
                      onDragLeave={() => {
                        if (dragOverEndpointId === ep.id) setDragOverEndpointId(null)
                      }}
                      onDrop={(event) => {
                        event.preventDefault()
                        const sourceId =
                          draggingEndpointId ?? event.dataTransfer.getData('text/plain')
                        setDraggingEndpointId(null)
                        setDragOverEndpointId(null)
                        if (sourceId) {
                          moveEndpointInOrder(sourceId, ep.id)
                        }
                      }}
                      onClick={() => runStatus !== 'running' && toggleEndpoint(ep.id)}
                      sx={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 0.75,
                        px: 1.5,
                        py: 1.25,
                        borderRadius: '8px',
                        cursor: runStatus === 'running' ? 'default' : 'pointer',
                        opacity:
                          runStatus === 'running' && !selectedEndpointIds.has(ep.id)
                            ? 0.5
                            : isDragging
                              ? 0.45
                              : 1,
                        bgcolor: isDragOver ? 'action.selected' : 'transparent',
                        border: isDragOver ? '1px dashed' : '1px solid transparent',
                        borderColor: isDragOver ? 'primary.main' : 'transparent',
                        '&:hover':
                          runStatus !== 'running'
                            ? { bgcolor: isDragOver ? 'action.selected' : 'action.hover' }
                            : {}
                      }}
                    >
                      <IconButton
                        size="small"
                        draggable={runStatus !== 'running'}
                        aria-label={`Reorder ${effectiveEndpoint.name}`}
                        onDragStart={(event) => {
                          setDraggingEndpointId(ep.id)
                          event.dataTransfer.effectAllowed = 'move'
                          event.dataTransfer.setData('text/plain', ep.id)
                        }}
                        onDragEnd={() => {
                          setDraggingEndpointId(null)
                          setDragOverEndpointId(null)
                        }}
                        disabled={runStatus === 'running'}
                        sx={{
                          cursor: runStatus === 'running' ? 'default' : 'grab',
                          color: 'text.secondary',
                          flexShrink: 0,
                          mt: 0.1,
                          p: 0.5,
                          '&:active': { cursor: 'grabbing' }
                        }}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <DragIndicatorIcon fontSize="small" />
                      </IconButton>
                      <Checkbox
                        size="small"
                        checked={selectedEndpointIds.has(ep.id)}
                        onChange={() => toggleEndpoint(ep.id)}
                        disabled={runStatus === 'running'}
                        sx={{ p: 0, mt: 0.25 }}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
                          <Chip
                            label={effectiveEndpoint.method}
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: '0.65rem',
                              fontWeight: 800,
                              border: `1px solid ${getMethodColor(effectiveEndpoint.method)}`,
                              color: getMethodColor(effectiveEndpoint.method),
                              bgcolor: 'transparent'
                            }}
                          />
                          {isCustomized && (
                            <Chip
                              label="Customized"
                              size="small"
                              color="info"
                              variant="outlined"
                              sx={{ height: 20, fontSize: '0.6rem' }}
                            />
                          )}
                          <Typography
                            variant="caption"
                            noWrap
                            sx={{ fontWeight: 600, color: 'text.secondary', flex: 1 }}
                          >
                            {effectiveEndpoint.path}
                          </Typography>
                        </Box>
                        <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                          {effectiveEndpoint.name}
                        </Typography>
                      </Box>
                      <IconButton
                        size="small"
                        aria-label={`Customize ${effectiveEndpoint.name}`}
                        disabled={runStatus === 'running'}
                        onClick={(event) => {
                          event.stopPropagation()
                          setCustomizeEndpointId(ep.id)
                        }}
                        sx={{ mt: 0.25 }}
                      >
                        <EditOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  )
                })
              )}
            </Box>
          </Box>
        </Box>

        {/* Results panel */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            minWidth: 0
          }}
        >
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              minHeight: 0
            }}
          >
            <Box sx={{ p: 3, flexShrink: 0 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  mb: 2
                }}
              >
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>
                    Validation Results
                  </Typography>
                  {runStatus === 'running' && (
                    <Typography variant="body2" color="text.secondary">
                      Validating {progress.current} of {progress.total} endpoints…
                    </Typography>
                  )}
                  {summary && runStatus !== 'running' && (
                    <Typography variant="body2" color="text.secondary">
                      {summary.passed} passed · {summary.failed} failed · avg{' '}
                      {summary.avgResponseTimeMs}ms
                    </Typography>
                  )}
                </Box>
                {runStatus === 'running' && (
                  <Chip
                    icon={<HourglassEmptyIcon />}
                    label="In Progress"
                    color="primary"
                    variant="outlined"
                    size="small"
                  />
                )}
                {runStatus === 'complete' && (
                  <Chip
                    icon={<CheckCircleIcon />}
                    label="Complete"
                    color="success"
                    variant="outlined"
                    size="small"
                  />
                )}
                {runStatus === 'cancelled' && (
                  <Chip
                    icon={<StopIcon />}
                    label="Cancelled"
                    color="warning"
                    variant="outlined"
                    size="small"
                  />
                )}
              </Box>

              {(runStatus === 'running' || progress.total > 0) && (
                <Box sx={{ mb: 2 }}>
                  <LinearProgress
                    variant={runStatus === 'running' ? 'determinate' : 'determinate'}
                    value={progressPercent}
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ mt: 0.5, display: 'block' }}
                  >
                    {progressPercent}% complete
                  </Typography>
                </Box>
              )}

              {runError && (
                <AppErrorAlert
                  error={runError}
                  onRetry={runError.retryable ? handleStart : undefined}
                  onDismiss={() => setRunError(null)}
                  sx={{ mb: 2 }}
                />
              )}

              {runStatus === 'idle' && results.length === 0 && (
                <Alert severity="info">
                  Configure your run and click Start Validation. Results will appear here in real
                  time and be saved to history.
                </Alert>
              )}
            </Box>

            <Box sx={{ flex: 1, overflow: 'auto', px: 3, pb: 3 }}>
              {results.length > 0 && (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Method</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Endpoint</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>HTTP</TableCell>
                        <TableCell sx={{ fontWeight: 700 }} align="right">
                          Response Time
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {results.map((row) => (
                        <TableRow key={row.endpointId} hover>
                          <TableCell>
                            {row.passed ? (
                              <Chip
                                icon={<CheckCircleIcon />}
                                label="Pass"
                                size="small"
                                color="success"
                                variant="outlined"
                              />
                            ) : (
                              <Chip
                                icon={<CancelIcon />}
                                label="Fail"
                                size="small"
                                color="error"
                                variant="outlined"
                              />
                            )}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={row.method}
                              size="small"
                              sx={{
                                fontWeight: 700,
                                fontSize: '0.7rem',
                                color: getMethodColor(row.method),
                                border: `1px solid ${getMethodColor(row.method)}`,
                                bgcolor: 'transparent'
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {row.endpointName}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {row.endpointPath}
                            </Typography>
                            {row.requestError && (
                              <Typography
                                variant="caption"
                                color="error.main"
                                sx={{ display: 'block' }}
                              >
                                {row.requestError}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Typography
                              variant="body2"
                              sx={{
                                fontWeight: 700,
                                color:
                                  row.responseStatus >= 200 && row.responseStatus < 300
                                    ? 'success.main'
                                    : row.responseStatus >= 400
                                      ? 'error.main'
                                      : 'text.primary'
                              }}
                            >
                              {row.responseStatus || '—'}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography
                              variant="body2"
                              sx={{ fontWeight: 600, fontFamily: 'monospace' }}
                            >
                              {row.responseTimeMs}ms
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}

                      {runStatus === 'running' &&
                        selectedEndpoints
                          .filter((ep) => !results.some((r) => r.endpointId === ep.id))
                          .slice(0, 1)
                          .map((ep) => (
                            <TableRow key={`pending-${ep.id}`}>
                              <TableCell>
                                <Chip
                                  icon={<CircularProgress size={12} />}
                                  label="Running"
                                  size="small"
                                  color="primary"
                                  variant="outlined"
                                />
                              </TableCell>
                              <TableCell>
                                <Chip label={ep.method} size="small" />
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                  {ep.name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {ep.path}
                                </Typography>
                              </TableCell>
                              <TableCell>—</TableCell>
                              <TableCell align="right">—</TableCell>
                            </TableRow>
                          ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          </Box>

          <RunnerDebugConsole
            logs={consoleLogs}
            expanded={consoleExpanded}
            isRunning={runStatus === 'running'}
            onToggleExpanded={() => setConsoleExpanded((v) => !v)}
            onClear={() => setConsoleLogs([])}
          />
        </Box>
      </Box>

      <Dialog
        open={saveCollectionOpen}
        onClose={() => !savingCollection && setSaveCollectionOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Save as Collection</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Save {selectedEndpoints.length} selected API{selectedEndpoints.length === 1 ? '' : 's'}{' '}
            in selection order as a manual collection.
          </Typography>
          <TextField
            autoFocus
            label="Collection Name"
            value={collectionName}
            onChange={(e) => setCollectionName(e.target.value)}
            fullWidth
            required
            sx={{ mb: 2 }}
          />
          <TextField
            label="Base URL"
            value={collectionBaseUrl}
            onChange={(e) => setCollectionBaseUrl(e.target.value)}
            fullWidth
            helperText="Use {{baseUrl}} to inherit from the active environment."
          />
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setSaveCollectionOpen(false)} disabled={savingCollection}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleSaveCollection()}
            disabled={!collectionName.trim() || selectedEndpoints.length === 0 || savingCollection}
          >
            {savingCollection ? 'Saving…' : 'Save Collection'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={addToCollectionOpen}
        onClose={() => !savingCollection && setAddToCollectionOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Add to Existing Collection</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Add {selectedEndpoints.length} selected API{selectedEndpoints.length === 1 ? '' : 's'}{' '}
            to a manual collection in selection order.
          </Typography>
          <FormControl fullWidth size="small" disabled={manualCollections.length === 0}>
            <InputLabel>Collection</InputLabel>
            <Select
              label="Collection"
              value={targetCollectionId}
              onChange={(event) => setTargetCollectionId(event.target.value)}
            >
              {manualCollections.map((collection) => (
                <MenuItem key={collection.id} value={collection.id}>
                  {collection.name}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>Requests with the same method and path are skipped.</FormHelperText>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setAddToCollectionOpen(false)} disabled={savingCollection}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleAddToExistingCollection()}
            disabled={!targetCollectionId || selectedEndpoints.length === 0 || savingCollection}
          >
            {savingCollection ? 'Adding…' : 'Add APIs'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={curlOpen} onClose={() => setCurlOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>cURL Command</DialogTitle>
        <DialogContent dividers>
          <TextField
            value={curlCommand}
            fullWidth
            multiline
            minRows={8}
            slotProps={{ input: { readOnly: true } }}
            sx={{ '& textarea': { fontFamily: 'monospace', fontSize: '0.8rem' } }}
          />
          {curlMessage && (
            <Alert severity="success" sx={{ mt: 2 }} onClose={() => setCurlMessage(null)}>
              {curlMessage}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setCurlOpen(false)}>Close</Button>
          <Button
            variant="contained"
            startIcon={<ContentCopyIcon />}
            onClick={() => void handleCopyCurl()}
          >
            Copy
          </Button>
        </DialogActions>
      </Dialog>

      {CustomizeDialog && customizeEndpointId !== null && customizingEndpoint && (
        <CustomizeDialog
          open
          mode="edit"
          initialRequest={endpointToManualRequest(customizingEndpoint)}
          onClose={() => setCustomizeEndpointId(null)}
          onSave={handleCustomizeSave}
        />
      )}
    </>
  )
}
