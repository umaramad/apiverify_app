import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Collapse,
  IconButton,
  Paper,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Typography,
  type SxProps,
  type Theme,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import {
  suggestBodyResponseVariables,
  suggestHeaderResponseVariables,
  suggestionsToExtractors,
  suggestionsToVariableEntries,
  type ResponseVariableSuggestion,
} from '../../../shared/responseVariableSuggestions'
import { useAppStore } from '../store/app.store'
import { useShallow } from 'zustand/react/shallow'

type PickerTab = 'body' | 'header'

interface ResponseVariablePickerProps {
  status: number
  headers: Record<string, string>
  data: unknown
  /** Fills the response tab panel and scrolls within parent bounds */
  embedded?: boolean
}

interface SuggestionTableProps {
  suggestions: ResponseVariableSuggestion[]
  selectedIds: Set<string>
  onToggle: (id: string) => void
  onToggleAll: () => void
  pathColumnLabel: string
  embedded?: boolean
}

function SuggestionTable({
  suggestions,
  selectedIds,
  onToggle,
  onToggleAll,
  pathColumnLabel,
  embedded = false,
}: SuggestionTableProps): React.JSX.Element {
  const tabSelectedCount = suggestions.filter((item) => selectedIds.has(item.id)).length
  const allSelected = suggestions.length > 0 && tabSelectedCount === suggestions.length
  const someSelected = tabSelectedCount > 0 && !allSelected

  if (suggestions.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 2, fontStyle: 'italic' }}>
        No suggestions available for this response.
      </Typography>
    )
  }

  return (
    <TableContainer
      sx={
        embedded
          ? { flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }
          : { maxHeight: 200 }
      }
    >
      <Table size="small" stickyHeader sx={{ tableLayout: 'fixed', width: '100%' }}>
        <TableHead>
          <TableRow>
            <TableCell padding="checkbox" sx={{ width: 48 }}>
              <Checkbox
                size="small"
                checked={allSelected}
                indeterminate={someSelected}
                onChange={onToggleAll}
              />
            </TableCell>
            <TableCell sx={{ fontWeight: 700, width: '22%' }}>Variable</TableCell>
            <TableCell sx={{ fontWeight: 700, width: '28%' }}>{pathColumnLabel}</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Preview</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {suggestions.map((suggestion) => (
            <TableRow key={suggestion.id} hover>
              <TableCell padding="checkbox">
                <Checkbox
                  size="small"
                  checked={selectedIds.has(suggestion.id)}
                  onChange={() => onToggle(suggestion.id)}
                />
              </TableCell>
              <TableCell
                sx={{ fontFamily: 'monospace', fontWeight: 600, verticalAlign: 'top', wordBreak: 'break-all' }}
              >
                {suggestion.name}
              </TableCell>
              <TableCell
                sx={{ fontFamily: 'monospace', fontSize: '0.75rem', verticalAlign: 'top', wordBreak: 'break-all' }}
              >
                {suggestion.path}
              </TableCell>
              <TableCell
                sx={{
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  wordBreak: 'break-all',
                  whiteSpace: 'pre-wrap',
                  verticalAlign: 'top',
                }}
              >
                {suggestion.previewValue}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

export default function ResponseVariablePicker({
  status,
  headers,
  data,
  embedded = false,
}: ResponseVariablePickerProps): React.JSX.Element | null {
  const { addPostVariablesFromResponse, activeEnvId } = useAppStore(
    useShallow((s) => ({
      addPostVariablesFromResponse: s.addPostVariablesFromResponse,
      activeEnvId: s.activeEnvId,
    }))
  )

  const bodySuggestions = useMemo(
    () => (status >= 200 && status < 300 ? suggestBodyResponseVariables(data) : []),
    [status, data]
  )
  const headerSuggestions = useMemo(
    () => (status >= 200 && status < 300 ? suggestHeaderResponseVariables(headers) : []),
    [status, headers]
  )
  const allSuggestions = useMemo(
    () => [...bodySuggestions, ...headerSuggestions],
    [bodySuggestions, headerSuggestions]
  )

  const [activeTab, setActiveTab] = useState<PickerTab>('body')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    setSelectedIds(new Set())
    setMessage(null)
    setCollapsed(false)
    setActiveTab(bodySuggestions.length > 0 ? 'body' : 'header')
  }, [status, data, headers, bodySuggestions.length, headerSuggestions.length])

  if (allSuggestions.length === 0) {
    return null
  }

  const activeSuggestions = activeTab === 'body' ? bodySuggestions : headerSuggestions

  const toggleSuggestion = (id: string): void => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAllActiveTab = (): void => {
    const activeIds = activeSuggestions.map((item) => item.id)
    const allActiveSelected = activeIds.every((id) => selectedIds.has(id))

    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allActiveSelected) {
        activeIds.forEach((id) => next.delete(id))
      } else {
        activeIds.forEach((id) => next.add(id))
      }
      return next
    })
  }

  const handleAdd = async (): Promise<void> => {
    const extractors = suggestionsToExtractors(allSuggestions, selectedIds)
    const environmentEntries = suggestionsToVariableEntries(allSuggestions, selectedIds)
    if (extractors.length === 0) return

    setSaving(true)
    setMessage(null)
    const result = await addPostVariablesFromResponse(extractors, environmentEntries)
    setSaving(false)

    if (result.success) {
      setMessage(result.message ?? `Added ${extractors.length} variable(s).`)
      setSelectedIds(new Set())
    } else {
      setMessage(result.error ?? 'Failed to add variables.')
    }
  }

  const embeddedShellSx: SxProps<Theme> = {
    flex: 1,
    minHeight: 0,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    bgcolor: 'background.paper',
  }

  const pickerContent = (
    <>
      {message && (
        <Alert
          severity={message.startsWith('Added') ? 'success' : 'error'}
          sx={{ mx: embedded ? 2 : 2, mt: embedded ? 1.5 : 1.5, py: 0, flexShrink: 0 }}
          onClose={() => setMessage(null)}
        >
          {message}
        </Alert>
      )}

      <Box sx={{ borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
        <Tabs
          value={activeTab}
          onChange={(_, value: PickerTab) => setActiveTab(value)}
          variant="fullWidth"
          sx={{
            minHeight: 36,
            '& .MuiTab-root': {
              minHeight: 36,
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.75rem',
            },
          }}
        >
          <Tab
            value="body"
            label={`Response Body (${bodySuggestions.length})`}
            disabled={bodySuggestions.length === 0}
          />
          <Tab
            value="header"
            label={`Response Headers (${headerSuggestions.length})`}
            disabled={headerSuggestions.length === 0}
          />
        </Tabs>
      </Box>

      <SuggestionTable
        suggestions={activeSuggestions}
        selectedIds={selectedIds}
        onToggle={toggleSuggestion}
        onToggleAll={toggleAllActiveTab}
        pathColumnLabel={activeTab === 'body' ? 'JSON Path' : 'Header'}
        embedded={embedded}
      />

      <Box
        sx={{
          px: 2,
          py: 1.25,
          display: 'flex',
          justifyContent: 'flex-end',
          flexShrink: 0,
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Button
          size="small"
          variant="contained"
          startIcon={<AddIcon />}
          disabled={selectedIds.size === 0 || saving}
          onClick={() => void handleAdd()}
        >
          {saving ? 'Saving…' : `Add ${selectedIds.size || ''} Variable${selectedIds.size === 1 ? '' : 's'}`}
        </Button>
      </Box>
    </>
  )

  if (embedded) {
    return (
      <Box sx={embeddedShellSx}>
        <Box sx={{ px: 2, py: 0.75, flexShrink: 0, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'action.hover' }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              fontWeight: 600,
              fontSize: '0.72rem',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: 'block',
            }}
          >
            Variables from response — select body/header fields to save
            {selectedIds.size > 0 && ` · ${selectedIds.size} selected`}
            {!activeEnvId && ' · no active env'}
          </Typography>
        </Box>
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {pickerContent}
        </Box>
      </Box>
    )
  }

  return (
    <Paper
      variant="outlined"
      square
      sx={{
        flexShrink: 0,
        borderLeft: 'none',
        borderRight: 'none',
        borderBottom: 'none',
        borderRadius: 0,
        bgcolor: 'background.paper',
      }}
    >
      <Box
        sx={{
          px: 2,
          py: 0.75,
          borderBottom: collapsed ? 'none' : '1px solid',
          borderColor: 'divider',
          bgcolor: 'action.hover',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          cursor: 'pointer',
        }}
        onClick={() => setCollapsed((value) => !value)}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.8rem' }}>
            Create Variables from Response
          </Typography>
          {selectedIds.size > 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontSize: '0.7rem' }}>
              {selectedIds.size} selected
              {!activeEnvId && ' — no active environment'}
            </Typography>
          )}
        </Box>
        <IconButton
          size="small"
          aria-label={collapsed ? 'Expand variable picker' : 'Collapse variable picker'}
          onClick={(event) => {
            event.stopPropagation()
            setCollapsed((value) => !value)
          }}
        >
          <ExpandMoreIcon
            sx={{
              transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)',
              transition: '0.2s',
            }}
          />
        </IconButton>
      </Box>

      <Collapse in={!collapsed}>{pickerContent}</Collapse>
    </Paper>
  )
}
