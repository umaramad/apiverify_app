import React, { useEffect, useRef, useState } from 'react'
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Input,
  MenuItem,
  Select,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import type { ManualRequest } from '../../../shared/manualCollection'
import { extractPathVariableNames } from '../../../shared/manualCollection'
import type { VariableExtractor } from '../../../shared/collectionVariables'
import type { ApiAuthConfig, HeaderOrQueryParam, HttpMethod } from '../../../shared/models'
import MaskedSecretField from './MaskedSecretField'
import AppErrorAlert from './AppErrorAlert'
import VariableInserterBar from './VariableInserterBar'
import { insertAtCursor } from '../../../shared/availableVariables'

type InsertTarget =
  | { kind: 'path'; name: string }
  | { kind: 'body' }
  | { kind: 'query'; index: number }
  | { kind: 'header'; index: number }

interface ManualRequestDialogProps {
  open: boolean
  mode: 'add' | 'edit'
  initialRequest?: ManualRequest
  onClose: () => void
  onSave: (request: ManualRequest) => Promise<{ success: boolean; error?: string }>
}

const EMPTY_REQUEST: ManualRequest = {
  name: '',
  method: 'GET',
  path: '/',
  description: '',
  queryParams: [],
  headers: [{ key: 'Accept', value: 'application/json', enabled: true }],
  body: '',
  auth: { type: 'inherit' },
  extractors: [],
}

export default function ManualRequestDialog({
  open,
  mode,
  initialRequest,
  onClose,
  onSave,
}: ManualRequestDialogProps): React.JSX.Element {
  const [request, setRequest] = useState<ManualRequest>(EMPTY_REQUEST)
  const [tabValue, setTabValue] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [newPathVariableName, setNewPathVariableName] = useState('')
  const [insertTarget, setInsertTarget] = useState<InsertTarget>({ kind: 'body' })
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  const handleInsertVariable = (token: string): void => {
    if (insertTarget.kind === 'body') {
      const element = bodyRef.current
      if (element) {
        const { value, cursor } = insertAtCursor(
          request.body,
          token,
          element.selectionStart ?? request.body.length,
          element.selectionEnd ?? request.body.length
        )
        updateField('body', value)
        requestAnimationFrame(() => {
          element.focus()
          element.setSelectionRange(cursor, cursor)
        })
        return
      }
      updateField('body', `${request.body}${token}`)
      return
    }

    if (insertTarget.kind === 'path') {
      updatePathVariable(insertTarget.name, `${request.pathVariables?.[insertTarget.name] ?? ''}${token}`)
      return
    }

    if (insertTarget.kind === 'query') {
      const updated = [...request.queryParams]
      const current = updated[insertTarget.index]
      if (!current) return
      updated[insertTarget.index] = { ...current, value: `${current.value}${token}` }
      updateField('queryParams', updated)
      return
    }

    if (insertTarget.kind === 'header') {
      const updated = [...request.headers]
      const current = updated[insertTarget.index]
      if (!current) return
      updated[insertTarget.index] = { ...current, value: `${current.value}${token}` }
      updateField('headers', updated)
    }
  }

  useEffect(() => {
    if (open) {
      setRequest(initialRequest ? { ...initialRequest, extractors: initialRequest.extractors ?? [] } : { ...EMPTY_REQUEST, queryParams: [], headers: [{ key: 'Accept', value: 'application/json', enabled: true }], extractors: [] })
      setTabValue(0)
      setError(null)
      setNewPathVariableName('')
    }
  }, [open, initialRequest])

  const updateField = <K extends keyof ManualRequest>(key: K, value: ManualRequest[K]): void => {
    setRequest((prev) => ({ ...prev, [key]: value }))
  }

  const updateQueryParam = (index: number, fields: Partial<HeaderOrQueryParam>): void => {
    const updated = [...request.queryParams]
    updated[index] = { ...updated[index], ...fields }
    updateField('queryParams', updated)
  }

  const updateHeader = (index: number, fields: Partial<HeaderOrQueryParam>): void => {
    const updated = [...request.headers]
    updated[index] = { ...updated[index], ...fields }
    updateField('headers', updated)
  }

  const pathVariableNames = extractPathVariableNames(request.path)

  const updatePathVariable = (name: string, value: string): void => {
    updateField('pathVariables', {
      ...(request.pathVariables ?? {}),
      [name]: value,
    })
  }

  const handlePathChange = (path: string): void => {
    const names = extractPathVariableNames(path)
    const nextVariables: Record<string, string> = {}
    for (const name of names) {
      nextVariables[name] = request.pathVariables?.[name] ?? ''
    }
    setRequest((prev) => ({
      ...prev,
      path,
      pathVariables: names.length > 0 ? nextVariables : undefined,
    }))
  }

  const extractors = request.extractors ?? []

  const updateExtractor = (index: number, fields: Partial<VariableExtractor>): void => {
    const updated = [...extractors]
    updated[index] = { ...updated[index], ...fields }
    updateField('extractors', updated)
  }

  const addPathVariablePlaceholder = (): void => {
    const name = newPathVariableName.trim().replace(/[{}]/g, '')
    if (!name) {
      setError('Enter a path variable name (e.g. id, userId).')
      return
    }

    const placeholder = `{${name}}`
    if (pathVariableNames.includes(name)) {
      setError(`Path variable "${name}" already exists in the path.`)
      return
    }

    setError(null)
    const basePath = request.path.trim() || '/'
    const nextPath = basePath.includes('{')
      ? `${basePath.replace(/\/$/, '')}/${placeholder}`
      : `${basePath.replace(/\/$/, '')}/${placeholder}`
    handlePathChange(nextPath)
    setNewPathVariableName('')
  }

  const handleSave = async (): Promise<void> => {
    if (!request.name.trim()) {
      setError('Request name is required.')
      return
    }
    if (!request.path.trim()) {
      setError('Path is required.')
      return
    }

    setSaving(true)
    setError(null)
    const result = await onSave({
      ...request,
      name: request.name.trim(),
      path: request.path.trim(),
      description: request.description?.trim() || '',
    })
    setSaving(false)

    if (result.success) {
      onClose()
    } else {
      setError(result.error || 'Failed to save request.')
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        {mode === 'add' ? 'Add API Request' : 'Edit API Request'}
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {error && (
            <AppErrorAlert error={error} title="Could not save request" onDismiss={() => setError(null)} />
          )}

          <TextField
            label="Request Name"
            value={request.name}
            onChange={(e) => updateField('name', e.target.value)}
            fullWidth
            required
            placeholder="e.g. Get all users"
          />

          <Box sx={{ display: 'flex', gap: 1.5 }}>
            <Select
              value={request.method}
              onChange={(e) => updateField('method', e.target.value as HttpMethod)}
              sx={{ minWidth: 120, height: 56 }}
            >
              {(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as HttpMethod[]).map((method) => (
                <MenuItem key={method} value={method}>
                  {method}
                </MenuItem>
              ))}
            </Select>
            <TextField
              label="Path"
              value={request.path}
              onChange={(e) => handlePathChange(e.target.value)}
              fullWidth
              required
              placeholder="/api/v1/auth/login"
              helperText="Relative path only. Base URL comes from your active environment. Use {'{{variableName}}'} in path placeholders."
              sx={{ '& .MuiInputBase-input': { fontFamily: 'monospace' } }}
            />
          </Box>

          <TextField
            label="Description (optional)"
            value={request.description || ''}
            onChange={(e) => updateField('description', e.target.value)}
            fullWidth
            multiline
            rows={2}
          />

          <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
            <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ minHeight: 40 }} variant="scrollable" scrollButtons="auto">
              <Tab label="Params" sx={{ minHeight: 40, textTransform: 'none' }} />
              <Tab label="Path Variables" sx={{ minHeight: 40, textTransform: 'none' }} />
              <Tab label="Headers" sx={{ minHeight: 40, textTransform: 'none' }} />
              <Tab label="Body" sx={{ minHeight: 40, textTransform: 'none' }} />
              <Tab label="Auth" sx={{ minHeight: 40, textTransform: 'none' }} />
              <Tab label="Post Variables" sx={{ minHeight: 40, textTransform: 'none' }} />
            </Tabs>
          </Box>

          {tabValue === 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <VariableInserterBar onInsert={handleInsertVariable} compact />
              <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: 'action.hover' }}>
                    <TableRow>
                      <TableCell sx={{ width: 50 }} />
                      <TableCell>Key</TableCell>
                      <TableCell>Value</TableCell>
                      <TableCell sx={{ width: 50 }} />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {request.queryParams.map((param, index) => (
                      <TableRow key={index}>
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={param.enabled}
                            onChange={(e) => updateQueryParam(index, { enabled: e.target.checked })}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={param.key}
                            onChange={(e) => updateQueryParam(index, { key: e.target.value })}
                            placeholder="Parameter"
                            fullWidth
                            disableUnderline
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={param.value}
                            onChange={(e) => updateQueryParam(index, { value: e.target.value })}
                            onFocus={() => setInsertTarget({ kind: 'query', index })}
                            placeholder="Value"
                            fullWidth
                            disableUnderline
                          />
                        </TableCell>
                        <TableCell>
                          <IconButton size="small" onClick={() => updateField('queryParams', request.queryParams.filter((_, i) => i !== index))}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <Button
                startIcon={<AddIcon />}
                size="small"
                onClick={() => updateField('queryParams', [...request.queryParams, { key: '', value: '', enabled: true }])}
                sx={{ alignSelf: 'flex-start' }}
              >
                Add Parameter
              </Button>
            </Box>
          )}

          {tabValue === 1 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <VariableInserterBar onInsert={handleInsertVariable} compact />
              <Typography variant="body2" color="text.secondary">
                Path variables come from placeholders in the URL path, such as <code>/users/{'{id}'}</code>. Assign a
                value here or use <code>{'{{variableName}}'}</code> to reference environment or collection variables.
              </Typography>

              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  bgcolor: 'action.hover',
                }}
              >
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  Collection-wide pre-variables (shared by all requests) are configured from{' '}
                  <strong>Collection Variables</strong> on the collection menu — not in this dialog.
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  To capture values from this request&apos;s response for later requests, use the{' '}
                  <strong>Post Variables</strong> tab.
                </Typography>
              </Box>

              {pathVariableNames.length > 0 ? (
                pathVariableNames.map((name) => (
                  <TextField
                    key={name}
                    label={name}
                    value={request.pathVariables?.[name] ?? ''}
                    onChange={(e) => updatePathVariable(name, e.target.value)}
                    onFocus={() => setInsertTarget({ kind: 'path', name })}
                    fullWidth
                    placeholder={`Value or {{${name}}}`}
                    helperText={`Path placeholder {${name}} in ${request.path}`}
                  />
                ))
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                  No path placeholders yet. Add one below or type {'{name}'} directly in the Path field above.
                </Typography>
              )}

              <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <TextField
                  label="New path variable"
                  value={newPathVariableName}
                  onChange={(e) => setNewPathVariableName(e.target.value)}
                  placeholder="e.g. id"
                  size="small"
                  sx={{ flex: 1, minWidth: 180 }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addPathVariablePlaceholder()
                    }
                  }}
                />
                <Button
                  startIcon={<AddIcon />}
                  size="small"
                  variant="outlined"
                  onClick={addPathVariablePlaceholder}
                  sx={{ mt: 0.25, height: 40 }}
                >
                  Add Path Variable
                </Button>
              </Box>
            </Box>
          )}

          {tabValue === 2 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <VariableInserterBar onInsert={handleInsertVariable} compact />
              <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: 'action.hover' }}>
                    <TableRow>
                      <TableCell sx={{ width: 50 }} />
                      <TableCell>Key</TableCell>
                      <TableCell>Value</TableCell>
                      <TableCell sx={{ width: 50 }} />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {request.headers.map((header, index) => (
                      <TableRow key={index}>
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={header.enabled}
                            onChange={(e) => updateHeader(index, { enabled: e.target.checked })}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={header.key}
                            onChange={(e) => updateHeader(index, { key: e.target.value })}
                            placeholder="Header"
                            fullWidth
                            disableUnderline
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={header.value}
                            onChange={(e) => updateHeader(index, { value: e.target.value })}
                            onFocus={() => setInsertTarget({ kind: 'header', index })}
                            fullWidth
                            disableUnderline
                          />
                        </TableCell>
                        <TableCell>
                          <IconButton size="small" onClick={() => updateField('headers', request.headers.filter((_, i) => i !== index))}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <Button
                startIcon={<AddIcon />}
                size="small"
                onClick={() => updateField('headers', [...request.headers, { key: '', value: '', enabled: true }])}
                sx={{ alignSelf: 'flex-start' }}
              >
                Add Header
              </Button>
            </Box>
          )}

          {tabValue === 3 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <VariableInserterBar onInsert={handleInsertVariable} compact />
              <TextField
                label="Request Body (JSON)"
                inputRef={bodyRef}
                value={request.body}
                onChange={(e) => updateField('body', e.target.value)}
                onFocus={() => setInsertTarget({ kind: 'body' })}
                multiline
                rows={8}
                fullWidth
                placeholder={'{\n  "key": "value"\n}'}
                sx={{ '& .MuiInputBase-input': { fontFamily: 'monospace', fontSize: '0.85rem' } }}
              />
            </Box>
          )}

          {tabValue === 4 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 480 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                Authentication
              </Typography>
              <Select
                value={request.auth.type}
                onChange={(e) => updateField('auth', { ...request.auth, type: e.target.value as ApiAuthConfig['type'] })}
                fullWidth
              >
                <MenuItem value="inherit">Inherit from Environment</MenuItem>
                <MenuItem value="none">No Auth</MenuItem>
                <MenuItem value="basic">Basic Auth</MenuItem>
                <MenuItem value="bearer">Bearer Token</MenuItem>
                <MenuItem value="apiKey">API Key</MenuItem>
                <MenuItem value="custom">Custom Header</MenuItem>
              </Select>

              {request.auth.type === 'bearer' && (
                <MaskedSecretField
                  label="Token"
                  value={request.auth.token || ''}
                  onChange={(e) => updateField('auth', { ...request.auth, token: e.target.value })}
                  fullWidth
                />
              )}

              {request.auth.type === 'basic' && (
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <TextField
                    label="Username"
                    value={request.auth.username || ''}
                    onChange={(e) => updateField('auth', { ...request.auth, username: e.target.value })}
                    fullWidth
                  />
                  <MaskedSecretField
                    label="Password"
                    value={request.auth.password || ''}
                    onChange={(e) => updateField('auth', { ...request.auth, password: e.target.value })}
                    fullWidth
                  />
                </Box>
              )}

              {request.auth.type === 'apiKey' && (
                <>
                  <TextField
                    label="Key"
                    value={request.auth.key || ''}
                    onChange={(e) => updateField('auth', { ...request.auth, key: e.target.value })}
                    fullWidth
                  />
                  <MaskedSecretField
                    label="Value"
                    value={request.auth.value || ''}
                    onChange={(e) => updateField('auth', { ...request.auth, value: e.target.value })}
                    fullWidth
                  />
                  <Select
                    value={request.auth.addTo || 'header'}
                    onChange={(e) => updateField('auth', { ...request.auth, addTo: e.target.value as 'header' | 'query' })}
                    fullWidth
                  >
                    <MenuItem value="header">Header</MenuItem>
                    <MenuItem value="query">Query Params</MenuItem>
                  </Select>
                </>
              )}
            </Box>
          )}

          {tabValue === 5 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Typography variant="body2" color="text.secondary">
                Post-variables capture values from this request&apos;s response and make them available to later
                requests during a collection run. Use JSON path for body (e.g. <code>{'$.token'}</code> or{' '}
                <code>data.id</code>) or a header name for header source (e.g. <code>x-request-id</code>).
              </Typography>
              <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: 'action.hover' }}>
                    <TableRow>
                      <TableCell sx={{ width: 50 }} />
                      <TableCell>Variable Name</TableCell>
                      <TableCell>Source</TableCell>
                      <TableCell>Path / Header</TableCell>
                      <TableCell sx={{ width: 50 }} />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {extractors.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5}>
                          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', py: 1 }}>
                            No post-variables yet. Click &quot;Add Post Variable&quot; below to extract a value from
                            this response for use in later requests.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                    extractors.map((extractor, index) => (
                      <TableRow key={index}>
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={extractor.enabled !== false}
                            onChange={(event) => updateExtractor(index, { enabled: event.target.checked })}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={extractor.name}
                            onChange={(event) => updateExtractor(index, { name: event.target.value })}
                            placeholder="accessToken"
                            fullWidth
                            disableUnderline
                          />
                        </TableCell>
                        <TableCell>
                          <Select
                            size="small"
                            value={extractor.source}
                            onChange={(event) =>
                              updateExtractor(index, { source: event.target.value as VariableExtractor['source'] })
                            }
                            fullWidth
                          >
                            <MenuItem value="body">Body</MenuItem>
                            <MenuItem value="header">Header</MenuItem>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            value={extractor.path}
                            onChange={(event) => updateExtractor(index, { path: event.target.value })}
                            placeholder={extractor.source === 'header' ? 'authorization' : '$.token'}
                            fullWidth
                            disableUnderline
                          />
                        </TableCell>
                        <TableCell>
                          <IconButton
                            size="small"
                            onClick={() =>
                              updateField(
                                'extractors',
                                extractors.filter((_, extractorIndex) => extractorIndex !== index)
                              )
                            }
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              <Button
                startIcon={<AddIcon />}
                size="small"
                onClick={() =>
                  updateField('extractors', [
                    ...extractors,
                    { name: '', source: 'body', path: '', enabled: true },
                  ])
                }
                sx={{ alignSelf: 'flex-start' }}
              >
                Add Post Variable
              </Button>
            </Box>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2.5 }}>
        <Button onClick={onClose} disabled={saving} sx={{ color: 'text.secondary' }}>
          Cancel
        </Button>
        <Button onClick={() => void handleSave()} variant="contained" disabled={saving}>
          {saving ? 'Saving…' : mode === 'add' ? 'Add Request' : 'Save Changes'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
