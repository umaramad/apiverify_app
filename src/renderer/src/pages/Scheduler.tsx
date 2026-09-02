import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Divider,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs'
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker'
import dayjs, { type Dayjs } from 'dayjs'
import ScheduleIcon from '@mui/icons-material/Schedule'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorOutlinedIcon from '@mui/icons-material/ErrorOutlined'
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty'
import SearchIcon from '@mui/icons-material/Search'
import { useAppStore } from '../store/app.store'
import { extractEndpointsFromSpec } from '../../../shared/engine'
import type { ApiEndpoint } from '../../../shared/models'
import type { ScheduleRecurrenceType, ValidationScheduleStatus } from '../../../shared/models/scheduler'
import { formatLocalDateTime } from '../../../shared/utils/dateTime'
import {
  formatRecurrenceLabel,
  getScheduleMaxDate,
  isScheduleDateAllowed,
  SCHEDULE_MAX_DAYS_AHEAD,
} from '../../../shared/scheduler/recurrence'

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

function formatScheduleTime(iso: string): string {
  return formatLocalDateTime(iso, { dateStyle: 'medium', timeStyle: 'short' }) || iso
}

function StatusChip({ status }: { status: ValidationScheduleStatus }): React.JSX.Element {
  switch (status) {
    case 'pending':
      return <Chip icon={<ScheduleIcon />} label="Pending" size="small" color="info" variant="outlined" />
    case 'running':
      return <Chip icon={<HourglassEmptyIcon />} label="Running" size="small" color="primary" variant="outlined" />
    case 'completed':
      return <Chip icon={<CheckCircleIcon />} label="Completed" size="small" color="success" variant="outlined" />
    case 'failed':
      return <Chip icon={<ErrorOutlinedIcon />} label="Failed" size="small" color="error" variant="outlined" />
  }
}

export default function Scheduler(): React.JSX.Element {
  const currentUser = useAppStore((s) => s.currentUser)
  const projects = useAppStore((s) => s.projects)
  const environments = useAppStore((s) => s.environments)
  const specs = useAppStore((s) => s.specs)
  const schedules = useAppStore((s) => s.schedules)
  const activeProjectId = useAppStore((s) => s.activeProjectId)
  const selectProject = useAppStore((s) => s.selectProject)
  const selectSpec = useAppStore((s) => s.selectSpec)
  const loadSpecs = useAppStore((s) => s.loadSpecs)
  const loadEnvironments = useAppStore((s) => s.loadEnvironments)
  const parsedSpec = useAppStore((s) => s.parsedSpec)
  const saveSchedule = useAppStore((s) => s.saveSchedule)
  const deleteSchedule = useAppStore((s) => s.deleteSchedule)
  const loadSchedules = useAppStore((s) => s.loadSchedules)
  const setActivePage = useAppStore((s) => s.setActivePage)

  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [selectedEnvId, setSelectedEnvId] = useState('')
  const [selectedSpecId, setSelectedSpecId] = useState('')
  const [scheduleName, setScheduleName] = useState('')
  const [scheduledAt, setScheduledAt] = useState<Dayjs | null>(null)
  const [recurrenceType, setRecurrenceType] = useState<ScheduleRecurrenceType>('once')
  const [endpoints, setEndpoints] = useState<ApiEndpoint[]>([])
  const [selectedEndpointIds, setSelectedEndpointIds] = useState<Set<string>>(new Set())
  const [endpointFilter, setEndpointFilter] = useState('')
  const [formMessage, setFormMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (activeProjectId) setSelectedProjectId(activeProjectId)
  }, [activeProjectId])

  useEffect(() => {
    void loadSchedules()
  }, [loadSchedules, currentUser?.id])

  useEffect(() => {
    const unsubscribe = window.api.onSchedulerUpdated(() => {
      void loadSchedules()
    })
    return unsubscribe
  }, [loadSchedules])

  useEffect(() => {
    if (parsedSpec && selectedProjectId) {
      const extracted = extractEndpointsFromSpec(selectedProjectId, parsedSpec)
      setEndpoints(extracted)
      setSelectedEndpointIds(new Set(extracted.map((endpoint) => endpoint.id)))
      setEndpointFilter('')
    } else {
      setEndpoints([])
      setSelectedEndpointIds(new Set())
      setEndpointFilter('')
    }
  }, [parsedSpec, selectedProjectId])

  const handleProjectChange = useCallback(
    async (projectId: string) => {
      setSelectedProjectId(projectId)
      setSelectedSpecId('')
      setSelectedEnvId('')
      setEndpoints([])
      setSelectedEndpointIds(new Set())
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

  const toggleEndpoint = (id: string): void => {
    setSelectedEndpointIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const filteredEndpoints = useMemo(() => {
    const query = endpointFilter.trim().toLowerCase()
    if (!query) return endpoints

    return endpoints.filter(
      (endpoint) =>
        endpoint.path.toLowerCase().includes(query) ||
        endpoint.method.toLowerCase().includes(query) ||
        endpoint.name.toLowerCase().includes(query)
    )
  }, [endpoints, endpointFilter])

  const filteredSelectedCount = useMemo(
    () => filteredEndpoints.filter((endpoint) => selectedEndpointIds.has(endpoint.id)).length,
    [filteredEndpoints, selectedEndpointIds]
  )

  const allFilteredSelected =
    filteredEndpoints.length > 0 && filteredSelectedCount === filteredEndpoints.length
  const someFilteredSelected = filteredSelectedCount > 0 && !allFilteredSelected

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
  }

  const scheduleMinDateTime = useMemo(() => dayjs(), [])
  const scheduleMaxDateTime = useMemo(() => dayjs(getScheduleMaxDate()), [scheduleMinDateTime])

  const canSave =
    !!currentUser &&
    !!selectedProjectId &&
    !!selectedEnvId &&
    !!selectedSpecId &&
    !!scheduleName.trim() &&
    !!scheduledAt &&
    scheduledAt.isValid() &&
    isScheduleDateAllowed(scheduledAt.toDate()) &&
    selectedEndpointIds.size > 0

  const handleSaveSchedule = async (): Promise<void> => {
    if (!canSave || !scheduledAt) return

    setSaving(true)
    setFormMessage(null)
    try {
      await saveSchedule({
        id: crypto.randomUUID(),
        projectId: selectedProjectId,
        environmentId: selectedEnvId,
        specId: selectedSpecId,
        name: scheduleName.trim(),
        endpointIds: Array.from(selectedEndpointIds),
        scheduledAt: scheduledAt.toDate().toISOString(),
        recurrenceType,
      })
      setScheduleName('')
      setScheduledAt(null)
      setRecurrenceType('once')
      setFormMessage('Schedule saved. It will run automatically while the app is open and in the foreground.')
    } catch (error) {
      const message = error instanceof Error ? error.message : null
      setFormMessage(message || 'Could not save the schedule. Check your selections and try again.')
    } finally {
      setSaving(false)
    }
  }

  const projectNameById = useMemo(
    () => new Map(projects.map((project) => [project.id, project.name])),
    [projects]
  )

  const environmentNameById = useMemo(
    () => new Map(environments.map((environment) => [environment.id, environment.name])),
    [environments]
  )

  const completedCount = schedules.filter((schedule) => schedule.status === 'completed').length
  const pendingCount = schedules.filter((schedule) => schedule.status === 'pending').length

  if (!currentUser) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="info" action={<Button onClick={() => setActivePage('settings')}>Open Settings</Button>}>
          Create your user profile in Settings before configuring validation schedules.
        </Alert>
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <Box
        sx={{
          width: 420,
          minWidth: 420,
          borderRight: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <Box sx={{ p: 3, flexShrink: 0 }}>
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>
            New Schedule
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Choose a workspace, environment, APIs, and the date/time to run validation.
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Schedule Name"
              value={scheduleName}
              onChange={(e) => setScheduleName(e.target.value)}
              fullWidth
              size="small"
              placeholder="Nightly smoke test"
            />

            <FormControl fullWidth size="small">
              <InputLabel>Project</InputLabel>
              <Select
                label="Project"
                value={selectedProjectId}
                onChange={(e) => void handleProjectChange(e.target.value)}
              >
                {projects.map((project) => (
                  <MenuItem key={project.id} value={project.id}>
                    {project.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth size="small" disabled={!selectedProjectId}>
              <InputLabel>Environment</InputLabel>
              <Select label="Environment" value={selectedEnvId} onChange={(e) => setSelectedEnvId(e.target.value)}>
                {environments.map((environment) => (
                  <MenuItem key={environment.id} value={environment.id}>
                    {environment.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth size="small" disabled={!selectedProjectId}>
              <InputLabel>API Specification</InputLabel>
              <Select
                label="API Specification"
                value={selectedSpecId}
                onChange={(e) => void handleSpecChange(e.target.value)}
              >
                {specs.map((spec) => (
                  <MenuItem key={spec.id} value={spec.id}>
                    {spec.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <DateTimePicker
                label="Run Date & Time"
                value={scheduledAt}
                onChange={(value) => setScheduledAt(value)}
                minDateTime={scheduleMinDateTime}
                maxDateTime={scheduleMaxDateTime}
                shouldDisableDate={(date) => {
                  const today = dayjs().startOf('day')
                  const maxDay = dayjs(getScheduleMaxDate()).startOf('day')
                  return date.isBefore(today, 'day') || date.isAfter(maxDay, 'day')
                }}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    size: 'small',
                    helperText: `Future dates only, up to ${SCHEDULE_MAX_DAYS_AHEAD} days ahead`,
                  },
                }}
              />
            </LocalizationProvider>

            <FormControl fullWidth size="small">
              <InputLabel>Recurrence</InputLabel>
              <Select
                label="Recurrence"
                value={recurrenceType}
                onChange={(e) => setRecurrenceType(e.target.value as ScheduleRecurrenceType)}
              >
                <MenuItem value="once">Once</MenuItem>
                <MenuItem value="daily">Daily (for 1 week)</MenuItem>
                <MenuItem value="weekly">Weekly (for 1 week)</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {formMessage && (
            <Alert severity={formMessage.includes('Could not') ? 'error' : 'success'} sx={{ mt: 2 }}>
              {formMessage}
            </Alert>
          )}

          <Button
            variant="contained"
            fullWidth
            sx={{ mt: 2 }}
            disabled={!canSave || saving}
            onClick={() => void handleSaveSchedule()}
          >
            Save Schedule
          </Button>
        </Box>

        <Divider />

        <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ px: 3, py: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Checkbox
              size="small"
              checked={allFilteredSelected}
              indeterminate={someFilteredSelected}
              onChange={toggleSelectAll}
              disabled={filteredEndpoints.length === 0}
            />
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              APIs ({selectedEndpointIds.size}/{endpoints.length}
              {endpointFilter.trim() ? ` · ${filteredEndpoints.length} shown` : ''})
            </Typography>
          </Box>

          <Box sx={{ px: 3, pb: 1.5 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Filter by method, path, or name…"
              value={endpointFilter}
              onChange={(e) => setEndpointFilter(e.target.value)}
              disabled={endpoints.length === 0}
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

          <Box sx={{ flex: 1, overflowY: 'auto', px: 1, pb: 2 }}>
            {endpoints.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                Select a project and API specification to choose endpoints.
              </Typography>
            ) : filteredEndpoints.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                No endpoints match your filter.
              </Typography>
            ) : (
              filteredEndpoints.map((endpoint) => (
                <Box
                  key={endpoint.id}
                  onClick={() => toggleEndpoint(endpoint.id)}
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 1,
                    px: 2,
                    py: 1.25,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  <Checkbox
                    size="small"
                    checked={selectedEndpointIds.has(endpoint.id)}
                    onChange={() => toggleEndpoint(endpoint.id)}
                    sx={{ p: 0, mt: 0.25 }}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
                      <Chip
                        label={endpoint.method}
                        size="small"
                        sx={{
                          height: 20,
                          fontSize: '0.65rem',
                          fontWeight: 800,
                          border: `1px solid ${getMethodColor(endpoint.method)}`,
                          color: getMethodColor(endpoint.method),
                          bgcolor: 'transparent',
                        }}
                      />
                      <Typography variant="caption" noWrap sx={{ fontWeight: 600, color: 'text.secondary' }}>
                        {endpoint.path}
                      </Typography>
                    </Box>
                    <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                      {endpoint.name}
                    </Typography>
                  </Box>
                </Box>
              ))
            )}
          </Box>
        </Box>
      </Box>

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Box sx={{ p: 3, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>
            Scheduled Runs
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Schedules run only while APIVerify is open and visible in the foreground.
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
            <Chip label={`${pendingCount} pending`} size="small" color="info" variant="outlined" />
            <Chip
              icon={<CheckCircleIcon />}
              label={`${completedCount} completed`}
              size="small"
              color="success"
              variant="outlined"
            />
          </Box>
        </Box>

        <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
          {schedules.length === 0 ? (
            <Alert severity="info">
              No schedules yet. Configure a run on the left and save it with a date and time.
            </Alert>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Project</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Environment</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Scheduled For</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Recurrence</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>APIs</TableCell>
                    <TableCell sx={{ fontWeight: 700 }} align="right">
                      Actions
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {schedules.map((schedule) => (
                    <TableRow
                      key={schedule.id}
                      hover
                      sx={{
                        bgcolor:
                          schedule.status === 'completed'
                            ? 'rgba(16, 185, 129, 0.06)'
                            : schedule.status === 'failed'
                              ? 'rgba(239, 68, 68, 0.06)'
                              : undefined,
                      }}
                    >
                      <TableCell>
                        <StatusChip status={schedule.status} />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 700 }}>
                          {schedule.name}
                        </Typography>
                        {schedule.lastError && (
                          <Typography variant="caption" color="error.main" sx={{ display: 'block' }}>
                            {schedule.lastError}
                          </Typography>
                        )}
                        {schedule.executedAt && schedule.status === 'completed' && (
                          <Typography variant="caption" color="success.main" sx={{ display: 'block' }}>
                            Completed {formatScheduleTime(schedule.executedAt)}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>{projectNameById.get(schedule.projectId) ?? '—'}</TableCell>
                      <TableCell>{environmentNameById.get(schedule.environmentId) ?? '—'}</TableCell>
                      <TableCell>{formatScheduleTime(schedule.scheduledAt)}</TableCell>
                      <TableCell>{formatRecurrenceLabel(schedule.recurrenceType ?? 'once')}</TableCell>
                      <TableCell>{schedule.endpointIds.length}</TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          title="Run now"
                          disabled={schedule.status === 'running'}
                          onClick={() => void window.api.runScheduleNow(schedule.id)}
                        >
                          <PlayArrowIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          title="Delete schedule"
                          onClick={() => void deleteSchedule(schedule.id)}
                        >
                          <DeleteOutlinedIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      </Box>
    </Box>
  )
}
