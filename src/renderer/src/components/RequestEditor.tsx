import React, { useEffect, useRef, useState } from 'react'
import {
  Box,
  Button,
  Chip,
  IconButton,
  MenuItem,
  Select,
  Tab,
  Tabs,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  Typography,
  Input,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import { useAppStore } from '../store/app.store'
import { useShallow } from 'zustand/react/shallow'
import MaskedSecretField from './MaskedSecretField'
import VariableInserterBar from './VariableInserterBar'
import ResolvedRequestPreview from './ResolvedRequestPreview'
import { insertAtCursor } from '../../../shared/availableVariables'
import { extractManualRequests, isManualCollection } from '../../../shared/manualCollection'
import { endpointOrderKey } from '../../../shared/manualCollectionOrder'

type InsertTarget =
  | { kind: 'url' }
  | { kind: 'body' }
  | { kind: 'query'; index: number }
  | { kind: 'header'; index: number }

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
  disablePadding?: boolean
  scrollable?: boolean
}

function TabPanel({
  children,
  value,
  index,
  disablePadding = false,
  scrollable = true,
}: TabPanelProps): React.JSX.Element | null {
  if (value !== index) return null

  return (
    <Box
      role="tabpanel"
      id={`request-tabpanel-${index}`}
      aria-labelledby={`request-tab-${index}`}
      sx={{
        flex: 1,
        minHeight: 0,
        overflow: scrollable ? 'auto' : 'hidden',
        p: disablePadding ? 0 : 2,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {children}
    </Box>
  )
}

const REQUEST_TAB = {
  params: 0,
  headers: 1,
  body: 2,
  auth: 3,
  preview: 4,
} as const

export default function RequestEditor(): React.JSX.Element {
  const { request, response, updateRequest, sendRequest, parsedSpec, activeManualRequestKey, collectionWorkspaceFocus } = useAppStore(
    useShallow((s) => ({
      request: s.request,
      response: s.response,
      updateRequest: s.updateRequest,
      sendRequest: s.sendRequest,
      parsedSpec: s.parsedSpec,
      activeManualRequestKey: s.activeManualRequestKey,
      collectionWorkspaceFocus: s.collectionWorkspaceFocus,
    }))
  )
  const [tabValue, setTabValue] = useState(0)
  const [insertTarget, setInsertTarget] = useState<InsertTarget>({ kind: 'body' })
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  const isManual = parsedSpec ? isManualCollection(parsedSpec) : false
  const selectedManualRequest =
    isManual && activeManualRequestKey && parsedSpec
      ? extractManualRequests(parsedSpec).find(
          (entry) => endpointOrderKey(entry.method, entry.path) === activeManualRequestKey
        )
      : undefined

  useEffect(() => {
    if (isManual) {
      setTabValue(REQUEST_TAB.preview)
    }
  }, [collectionWorkspaceFocus, isManual])

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
        updateRequest({ body: value })
        requestAnimationFrame(() => {
          element.focus()
          element.setSelectionRange(cursor, cursor)
        })
        return
      }
      updateRequest({ body: `${request.body}${token}` })
      return
    }

    if (insertTarget.kind === 'url') {
      updateRequest({ url: `${request.url}${token}` })
      return
    }

    if (insertTarget.kind === 'query') {
      const updated = [...request.queryParams]
      const current = updated[insertTarget.index]
      if (!current) return
      updated[insertTarget.index] = { ...current, value: `${current.value}${token}` }
      updateRequest({ queryParams: updated })
      return
    }

    if (insertTarget.kind === 'header') {
      const updated = [...request.headers]
      const current = updated[insertTarget.index]
      if (!current) return
      updated[insertTarget.index] = { ...current, value: `${current.value}${token}` }
      updateRequest({ headers: updated })
    }
  }

  const handleTabChange = (_: React.SyntheticEvent, newValue: number): void => {
    setTabValue(newValue)
  }

  // Query Params handlers
  const handleQueryParamChange = (index: number, fields: any): void => {
    const updated = [...request.queryParams]
    updated[index] = { ...updated[index], ...fields }
    updateRequest({ queryParams: updated })
  }

  const addQueryParam = (): void => {
    updateRequest({
      queryParams: [...request.queryParams, { key: '', value: '', enabled: true }],
    })
  }

  const deleteQueryParam = (index: number): void => {
    const updated = request.queryParams.filter((_, i) => i !== index)
    updateRequest({ queryParams: updated })
  }

  // Headers handlers
  const handleHeaderChange = (index: number, fields: any): void => {
    const updated = [...request.headers]
    updated[index] = { ...updated[index], ...fields }
    updateRequest({ headers: updated })
  }

  const addHeader = (): void => {
    updateRequest({
      headers: [...request.headers, { key: '', value: '', enabled: true }],
    })
  }

  const deleteHeader = (index: number): void => {
    const updated = request.headers.filter((_, i) => i !== index)
    updateRequest({ headers: updated })
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflow: 'hidden', bgcolor: 'background.paper' }}>
      {isManual && selectedManualRequest && (
        <Box sx={{ px: 2, pt: 1.5, pb: 0, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
            Editing
          </Typography>
          <Chip
            label={`${selectedManualRequest.method} ${selectedManualRequest.name}`}
            size="small"
            color="primary"
            variant="outlined"
            sx={{ fontWeight: 700, maxWidth: '100%' }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
            {selectedManualRequest.path}
          </Typography>
        </Box>
      )}

      {/* Top Request Bar */}
      <Box sx={{ display: 'flex', gap: 1, p: 2, borderBottom: '1px solid', borderColor: 'divider', flexShrink: 0 }}>
        <Select
          value={request.method}
          onChange={(e) => updateRequest({ method: e.target.value })}
          sx={{
            minWidth: 100,
            height: 40,
            bgcolor: 'action.hover',
            fontWeight: 700,
            color: 'text.primary',
            '.MuiOutlinedInput-notchedOutline': {
              borderColor: 'divider',
            },
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: 'primary.main',
            },
          }}
        >
          <MenuItem value="GET" sx={{ color: '#10B981', fontWeight: 700 }}>GET</MenuItem>
          <MenuItem value="POST" sx={{ color: '#3B82F6', fontWeight: 700 }}>POST</MenuItem>
          <MenuItem value="PUT" sx={{ color: '#F59E0B', fontWeight: 700 }}>PUT</MenuItem>
          <MenuItem value="DELETE" sx={{ color: '#EF4444', fontWeight: 700 }}>DELETE</MenuItem>
          <MenuItem value="PATCH" sx={{ color: '#8B5CF6', fontWeight: 700 }}>PATCH</MenuItem>
        </Select>

        <TextField
          value={request.url}
          onChange={(e) => updateRequest({ url: e.target.value })}
          onFocus={() => setInsertTarget({ kind: 'url' })}
          placeholder="Enter path (e.g. /api/v1/users) — base URL from environment"
          fullWidth
          size="medium"
          sx={{
            '& .MuiInputBase-root': {
              height: 40,
              fontSize: '0.9rem',
              fontFamily: 'monospace',
            },
          }}
        />

        <Button
          variant="contained"
          onClick={sendRequest}
          disabled={response.loading || !request.url}
          startIcon={response.loading ? null : <PlayArrowIcon />}
          sx={{
            height: 40,
            bgcolor: 'primary.main',
            fontWeight: 700,
            px: 3,
            '&:hover': {
              bgcolor: 'primary.dark',
            },
          }}
        >
          {response.loading ? 'Sending...' : 'Send'}
        </Button>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            minHeight: 40,
            '& .MuiTab-root': {
              minHeight: 40,
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.85rem',
              color: 'text.secondary',
            },
            '& .Mui-selected': {
              color: 'primary.main !important',
            },
            '& .MuiTabs-indicator': {
              bgcolor: 'primary.main',
            },
          }}
        >
          <Tab label="Params" />
          <Tab label="Headers" />
          <Tab label="Body" />
          <Tab label="Auth" />
          {isManual && <Tab label="Resolved Preview" />}
        </Tabs>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Params Panel */}
      <TabPanel value={tabValue} index={REQUEST_TAB.params}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <VariableInserterBar onInsert={handleInsertVariable} compact />
          <TableContainer component={Box} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
            <Table size="small">
              <TableHead sx={{ bgcolor: 'action.hover' }}>
                <TableRow>
                  <TableCell sx={{ width: 50 }}></TableCell>
                  <TableCell sx={{ color: 'text.primary', fontWeight: 600 }}>Key</TableCell>
                  <TableCell sx={{ color: 'text.primary', fontWeight: 600 }}>Value</TableCell>
                  <TableCell sx={{ width: 50 }}></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {request.queryParams.map((param, index) => (
                  <TableRow key={index}>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={param.enabled}
                        onChange={(e) => handleQueryParamChange(index, { enabled: e.target.checked })}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={param.key}
                        onChange={(e) => handleQueryParamChange(index, { key: e.target.value })}
                        placeholder="Parameter Name"
                        fullWidth
                        disableUnderline
                        sx={{ fontFamily: 'monospace', fontSize: '0.85rem', color: 'text.primary' }}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={param.value}
                        onChange={(e) => handleQueryParamChange(index, { value: e.target.value })}
                        onFocus={() => setInsertTarget({ kind: 'query', index })}
                        placeholder="Parameter Value"
                        fullWidth
                        disableUnderline
                        sx={{ fontFamily: 'monospace', fontSize: '0.85rem', color: 'text.primary' }}
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton size="small" onClick={() => deleteQueryParam(index)} sx={{ color: 'text.secondary' }}>
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
            onClick={addQueryParam}
            size="small"
            sx={{ alignSelf: 'flex-start', color: 'primary.main', fontWeight: 600 }}
          >
            Add Parameter
          </Button>
        </Box>
      </TabPanel>

      {/* Headers Panel */}
      <TabPanel value={tabValue} index={REQUEST_TAB.headers}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <VariableInserterBar onInsert={handleInsertVariable} compact />
          <TableContainer component={Box} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
            <Table size="small">
              <TableHead sx={{ bgcolor: 'action.hover' }}>
                <TableRow>
                  <TableCell sx={{ width: 50 }}></TableCell>
                  <TableCell sx={{ color: 'text.primary', fontWeight: 600 }}>Key</TableCell>
                  <TableCell sx={{ color: 'text.primary', fontWeight: 600 }}>Value</TableCell>
                  <TableCell sx={{ width: 50 }}></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {request.headers.map((header, index) => (
                  <TableRow key={index}>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={header.enabled}
                        onChange={(e) => handleHeaderChange(index, { enabled: e.target.checked })}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={header.key}
                        onChange={(e) => handleHeaderChange(index, { key: e.target.value })}
                        placeholder="Header Name"
                        fullWidth
                        disableUnderline
                        sx={{ fontFamily: 'monospace', fontSize: '0.85rem', color: 'text.primary' }}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={header.value}
                        onChange={(e) => handleHeaderChange(index, { value: e.target.value })}
                        onFocus={() => setInsertTarget({ kind: 'header', index })}
                        placeholder="Header Value"
                        fullWidth
                        disableUnderline
                        sx={{ fontFamily: 'monospace', fontSize: '0.85rem', color: 'text.primary' }}
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton size="small" onClick={() => deleteHeader(index)} sx={{ color: 'text.secondary' }}>
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
            onClick={addHeader}
            size="small"
            sx={{ alignSelf: 'flex-start', color: 'primary.main', fontWeight: 600 }}
          >
            Add Header
          </Button>
        </Box>
      </TabPanel>

      {/* Body Panel */}
      <TabPanel value={tabValue} index={REQUEST_TAB.body}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <VariableInserterBar onInsert={handleInsertVariable} compact />
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
            Raw JSON request body:
          </Typography>
          <TextField
            inputRef={bodyRef}
            value={request.body}
            onChange={(e) => updateRequest({ body: e.target.value })}
            onFocus={() => setInsertTarget({ kind: 'body' })}
            placeholder={`{\n  "key": "value"\n}`}
            multiline
            minRows={12}
            fullWidth
            sx={{
              '& .MuiInputBase-root': {
                fontFamily: 'monospace',
                fontSize: '0.85rem',
                alignItems: 'flex-start',
              },
            }}
          />
        </Box>
      </TabPanel>

      {/* Auth Panel */}
      <TabPanel value={tabValue} index={REQUEST_TAB.auth}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 1, maxWidth: 500 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 600 }}>
              Authentication Type
            </Typography>
            <Select
              value={request.auth.type}
              onChange={(e) => updateRequest({ auth: { ...request.auth, type: e.target.value as any } })}
              fullWidth
            >
              <MenuItem value="inherit">Inherit from Environment</MenuItem>
              <MenuItem value="none">No Auth</MenuItem>
              <MenuItem value="basic">Basic Auth</MenuItem>
              <MenuItem value="bearer">Bearer Token</MenuItem>
              <MenuItem value="apiKey">API Key</MenuItem>
              <MenuItem value="custom">Custom Header</MenuItem>
              <MenuItem value="oauth2" disabled>OAuth 2.0 (Coming Soon)</MenuItem>
              <MenuItem value="aws" disabled>AWS Signature V4 (Coming Soon)</MenuItem>
            </Select>
          </Box>

          {request.auth.type === 'inherit' && (
            <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
              This request will inherit the authentication configuration defined in the active environment.
            </Typography>
          )}

          {request.auth.type === 'bearer' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 600 }}>Token</Typography>
              <MaskedSecretField
                value={request.auth.token || ''}
                onChange={(e) => updateRequest({ auth: { ...request.auth, token: e.target.value } })}
                placeholder="Bearer token value"
                fullWidth
                sx={{ '& .MuiInputBase-input': { fontFamily: 'monospace' } }}
              />
            </Box>
          )}

          {request.auth.type === 'basic' && (
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1 }}>
                <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 600 }}>Username</Typography>
                <TextField
                  value={request.auth.username || ''}
                  onChange={(e) => updateRequest({ auth: { ...request.auth, username: e.target.value } })}
                  fullWidth
                  sx={{ '& .MuiInputBase-input': { fontFamily: 'monospace' } }}
                />
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1 }}>
                <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 600 }}>Password</Typography>
                <MaskedSecretField
                  value={request.auth.password || ''}
                  onChange={(e) => updateRequest({ auth: { ...request.auth, password: e.target.value } })}
                  fullWidth
                  sx={{ '& .MuiInputBase-input': { fontFamily: 'monospace' } }}
                />
              </Box>
            </Box>
          )}

          {request.auth.type === 'apiKey' && (
            <>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1 }}>
                  <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 600 }}>Key</Typography>
                  <TextField
                    value={request.auth.key || ''}
                    onChange={(e) => updateRequest({ auth: { ...request.auth, key: e.target.value } })}
                    placeholder="e.g. X-API-Key"
                    fullWidth
                    sx={{ '& .MuiInputBase-input': { fontFamily: 'monospace' } }}
                  />
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1 }}>
                  <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 600 }}>Value</Typography>
                  <MaskedSecretField
                    value={request.auth.value || ''}
                    onChange={(e) => updateRequest({ auth: { ...request.auth, value: e.target.value } })}
                    placeholder="Value"
                    fullWidth
                    sx={{ '& .MuiInputBase-input': { fontFamily: 'monospace' } }}
                  />
                </Box>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 600 }}>Add to</Typography>
                <Select
                  value={request.auth.addTo || 'header'}
                  onChange={(e) => updateRequest({ auth: { ...request.auth, addTo: e.target.value as any } })}
                  fullWidth
                >
                  <MenuItem value="header">Header</MenuItem>
                  <MenuItem value="query">Query Params</MenuItem>
                </Select>
              </Box>
            </>
          )}

          {request.auth.type === 'custom' && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Use the "Headers" tab to configure custom headers manually.
              </Typography>
            </Box>
          )}
        </Box>
      </TabPanel>

      {isManual && (
        <TabPanel
          value={tabValue}
          index={REQUEST_TAB.preview}
          disablePadding
          scrollable={false}
        >
          <ResolvedRequestPreview embedded />
        </TabPanel>
      )}
      </Box>
    </Box>
  )
}
