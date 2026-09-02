import React, { useEffect, useState } from 'react'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  TextField,
  Typography,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'
import FileUploadIcon from '@mui/icons-material/FileUpload'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import EditIcon from '@mui/icons-material/Edit'
import FolderOpenOutlinedIcon from '@mui/icons-material/FolderOpenOutlined'
import { useAppStore } from '../store/app.store'
import { useShallow } from 'zustand/react/shallow'
import AppErrorAlert from './AppErrorAlert'
import type { AppErrorPayload } from '../../../shared/errors'
import { toAppError } from '../../../shared/errors'
import {
  extractManualRequests,
  isManualCollection,
  isManualSpecContent,
  type ManualRequest,
} from '../../../shared/manualCollection'
import { extractCollectionVariables } from '../../../shared/collectionVariables'
import type { CollectionVariable } from '../../../shared/collectionVariables'
import type { HttpMethod } from '../../../shared/models'
import { endpointOrderKey } from '../../../shared/manualCollectionOrder'

type ManualCollectionRequestListComponent = React.ComponentType<{
  parsedSpec: Record<string, unknown>
  savingOrder: boolean
  onSelect: (path: string, method: string, pathObj: Record<string, unknown>) => void
  onEdit: (request: ManualRequest) => void
  onDelete: (path: string, method: HttpMethod) => void
  onReorder: (order: string[]) => Promise<{ success: boolean; error?: string }>
}>

type ManualRequestDialogComponent = React.ComponentType<{
  open: boolean
  mode: 'add' | 'edit'
  initialRequest?: ManualRequest
  onClose: () => void
  onSave: (request: ManualRequest) => Promise<{ success: boolean; error?: string }>
}>

type CollectionVariablesDialogComponent = React.ComponentType<{
  open: boolean
  variables: CollectionVariable[]
  onClose: () => void
  onSave: (variables: CollectionVariable[]) => Promise<{ success: boolean; error?: string }>
}>

type ImportedSpecExplorerPanelComponent = React.ComponentType<{
  parsedSpec: Record<string, unknown>
  projectId: string
  onSelect: (path: string, method: string, pathObj: Record<string, unknown>) => void
}>

// Helper to generate a mock request body from a JSON Schema
function generateMockFromSchema(schema: any): string {
  if (!schema) return ''
  try {
    const mock = generateMockObj(schema)
    return JSON.stringify(mock, null, 2)
  } catch (_) {
    return ''
  }
}

function generateMockObj(schema: any): any {
  if (schema.example !== undefined) return schema.example
  if (schema.default !== undefined) return schema.default

  switch (schema.type) {
    case 'string':
      return schema.format === 'date-time' ? new Date().toISOString() : 'string'
    case 'number':
    case 'integer':
      return 0
    case 'boolean':
      return true
    case 'array':
      return [generateMockObj(schema.items || {})]
    case 'object': {
      const obj: Record<string, any> = {}
      const props = schema.properties || {}
      Object.keys(props).forEach((key) => {
        obj[key] = generateMockObj(props[key])
      })
      return obj
    }
    default:
      if (schema.properties) {
        return generateMockObj({ type: 'object', properties: schema.properties })
      }
      return null
  }
}

export default function SpecExplorer(): React.JSX.Element {
  const {
    specs,
    activeSpecId,
    activeProjectId,
    parsedSpec,
    importSpec,
    createManualCollection,
    saveManualRequest,
    deleteManualRequest,
    saveManualCollectionOrder,
    saveCollectionVariables,
    deleteSpec,
    selectSpec,
    updateRequest,
    selectManualCollectionRequest,
    exportConfiguration,
  } = useAppStore(
    useShallow((s) => ({
      specs: s.specs,
      activeSpecId: s.activeSpecId,
      activeProjectId: s.activeProjectId,
      parsedSpec: s.parsedSpec,
      importSpec: s.importSpec,
      createManualCollection: s.createManualCollection,
      saveManualRequest: s.saveManualRequest,
      deleteManualRequest: s.deleteManualRequest,
      saveManualCollectionOrder: s.saveManualCollectionOrder,
      saveCollectionVariables: s.saveCollectionVariables,
      deleteSpec: s.deleteSpec,
      selectSpec: s.selectSpec,
      updateRequest: s.updateRequest,
      selectManualCollectionRequest: s.selectManualCollectionRequest,
      exportConfiguration: s.exportConfiguration,
    }))
  )

  const [open, setOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [collectionName, setCollectionName] = useState('')
  const [collectionBaseUrl, setCollectionBaseUrl] = useState('')
  const [requestDialogOpen, setRequestDialogOpen] = useState(false)
  const [requestDialogMode, setRequestDialogMode] = useState<'add' | 'edit'>('add')
  const [editingRequest, setEditingRequest] = useState<ManualRequest | undefined>(undefined)
  const [editingRequestKey, setEditingRequestKey] = useState<{ path: string; method: HttpMethod } | undefined>(
    undefined
  )
  const [deleteRequestKey, setDeleteRequestKey] = useState<{ path: string; method: HttpMethod } | null>(null)
  const [name, setName] = useState('')
  const [content, setContent] = useState('')
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [browsing, setBrowsing] = useState(false)
  const [error, setError] = useState<AppErrorPayload | string | null>(null)
  const [exportNotice, setExportNotice] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [deleteConfirmSpecId, setDeleteConfirmSpecId] = useState<string | null>(null)
  const [savingOrder, setSavingOrder] = useState(false)
  const [CollectionRequestList, setCollectionRequestList] =
    useState<ManualCollectionRequestListComponent | null>(null)
  const [RequestDialog, setRequestDialog] = useState<ManualRequestDialogComponent | null>(null)
  const [variablesDialogOpen, setVariablesDialogOpen] = useState(false)
  const [VariablesDialog, setVariablesDialog] = useState<CollectionVariablesDialogComponent | null>(null)
  const [ImportedSpecPanel, setImportedSpecPanel] = useState<ImportedSpecExplorerPanelComponent | null>(null)

  const showManualRequestList =
    activeSpecId !== null && parsedSpec !== null && isManualCollection(parsedSpec)

  const showImportedEndpointList =
    activeSpecId !== null && parsedSpec !== null && !isManualCollection(parsedSpec)

  useEffect(() => {
    if (!showManualRequestList) {
      setCollectionRequestList(null)
      return
    }

    let cancelled = false
    void import('./ManualCollectionRequestList').then((module) => {
      if (!cancelled) {
        setCollectionRequestList(() => module.default)
      }
    })

    return () => {
      cancelled = true
    }
  }, [showManualRequestList, activeSpecId])

  useEffect(() => {
    if (!requestDialogOpen) {
      setRequestDialog(null)
      return
    }

    let cancelled = false
    void import('./ManualRequestDialog').then((module) => {
      if (!cancelled) {
        setRequestDialog(() => module.default)
      }
    })

    return () => {
      cancelled = true
    }
  }, [requestDialogOpen])

  useEffect(() => {
    if (!variablesDialogOpen) {
      setVariablesDialog(null)
      return
    }

    let cancelled = false
    void import('./CollectionVariablesDialog').then((module) => {
      if (!cancelled) {
        setVariablesDialog(() => module.default)
      }
    })

    return () => {
      cancelled = true
    }
  }, [variablesDialogOpen])

  useEffect(() => {
    if (!showImportedEndpointList) {
      setImportedSpecPanel(null)
      return
    }

    let cancelled = false
    void import('./ImportedSpecExplorerPanel').then((module) => {
      if (!cancelled) {
        setImportedSpecPanel(() => module.default)
      }
    })

    return () => {
      cancelled = true
    }
  }, [showImportedEndpointList, activeSpecId])

  const handleOpen = (): void => {
    setName('')
    setContent('')
    setSelectedFile(null)
    setError(null)
    setOpen(true)
  }

  const handleClose = (): void => setOpen(false)

  const handleBrowseFile = async (): Promise<void> => {
    setBrowsing(true)
    setError(null)
    try {
      const result = await window.api.pickSpecFile()
      if (result.canceled) return

      setContent(result.content)
      setName(result.fileName)
      setSelectedFile(result.fileName)
    } catch (err) {
      const appError = toAppError(err)
      setError(appError.toPayload())
    } finally {
      setBrowsing(false)
    }
  }

  const handleImport = async (): Promise<void> => {
    if (!name.trim() || !content.trim()) {
      setError('Please fill in both fields')
      return
    }

    const result = await importSpec(name, content)
    if (result.success) {
      setOpen(false)
    } else {
      setError(result.errorPayload ?? result.error ?? 'Invalid specification.')
    }
  }

  const handleConfirmDeleteSpec = async (): Promise<void> => {
    if (!deleteConfirmSpecId) return
    await deleteSpec(deleteConfirmSpecId)
    setDeleteConfirmSpecId(null)
  }

  const handleExportAll = async (): Promise<void> => {
    if (!activeProjectId || exporting) return
    setExporting(true)
    setExportNotice(null)
    try {
      const result = await exportConfiguration({ scope: 'specs', projectId: activeProjectId })
      if (result.saved && result.filePath) {
        setExportNotice(`API specifications exported to ${result.filePath}`)
      }
    } finally {
      setExporting(false)
    }
  }

  const handleExportSpec = async (specId: string): Promise<void> => {
    if (exporting) return
    setExporting(true)
    setExportNotice(null)
    try {
      const result = await exportConfiguration({ scope: 'spec', specId })
      if (result.saved && result.filePath) {
        setExportNotice(`API specification exported to ${result.filePath}`)
      }
    } finally {
      setExporting(false)
    }
  }

  const handleOpenCreate = (): void => {
    setCollectionName('')
    setCollectionBaseUrl('')
    setError(null)
    setCreateOpen(true)
  }

  const handleCreateCollection = async (): Promise<void> => {
    if (!collectionName.trim()) {
      setError('Collection name is required.')
      return
    }

    const result = await createManualCollection(
      collectionName.trim(),
      collectionBaseUrl.trim() || undefined
    )
    if (result.success) {
      setCreateOpen(false)
      setError(null)
    } else {
      setError(result.errorPayload ?? result.error ?? 'Failed to create collection.')
    }
  }

  const handleOpenAddRequest = (): void => {
    setRequestDialogMode('add')
    setEditingRequest(undefined)
    setEditingRequestKey(undefined)
    setRequestDialogOpen(true)
  }

  const handleOpenEditRequest = (request: ManualRequest): void => {
    setRequestDialogMode('edit')
    setEditingRequest(request)
    setEditingRequestKey({ path: request.path, method: request.method })
    setRequestDialogOpen(true)
  }

  const handleSaveRequest = async (request: ManualRequest): Promise<{ success: boolean; error?: string }> => {
    if (!activeSpecId) return { success: false, error: 'No active collection.' }
    const result = await saveManualRequest(
      activeSpecId,
      request,
      requestDialogMode === 'edit' ? editingRequestKey : undefined
    )
    return { success: result.success, error: result.error }
  }

  const handleConfirmDeleteRequest = async (): Promise<void> => {
    if (!activeSpecId || !deleteRequestKey) return
    await deleteManualRequest(activeSpecId, deleteRequestKey.path, deleteRequestKey.method)
    setDeleteRequestKey(null)
  }

  const handleReorderRequests = async (order: string[]): Promise<{ success: boolean; error?: string }> => {
    if (!activeSpecId) return { success: false, error: 'No active collection.' }
    setSavingOrder(true)
    const result = await saveManualCollectionOrder(activeSpecId, order)
    setSavingOrder(false)
    return { success: result.success, error: result.error }
  }

  const handleSaveCollectionVariables = async (
    variables: CollectionVariable[]
  ): Promise<{ success: boolean; error?: string }> => {
    if (!activeSpecId) return { success: false, error: 'No active collection.' }
    const result = await saveCollectionVariables(activeSpecId, variables)
    return { success: result.success, error: result.error }
  }

  const isActiveManual = activeSpecId !== null && parsedSpec ? isManualCollection(parsedSpec) : false
  const manualRequests = parsedSpec && isActiveManual ? extractManualRequests(parsedSpec) : []

  const handleEndpointClick = (path: string, method: string, pathObj: any): void => {
    const endpointObj = pathObj[method]
    if (!endpointObj || typeof endpointObj !== 'object') return

    const manualRequest = isActiveManual
      ? manualRequests.find((r) => r.path === path && r.method.toLowerCase() === method.toLowerCase())
      : undefined

    let requestUrl = path
    if (!isActiveManual) {
      let baseUrl = ''
      if (parsedSpec && parsedSpec.servers && parsedSpec.servers.length > 0) {
        baseUrl = parsedSpec.servers[0].url
      }
      requestUrl = `${baseUrl}${path}`
    }

    updateRequest({
      url: requestUrl,
      method: method.toUpperCase(),
      queryParams: manualRequest?.queryParams ?? [],
      headers: manualRequest?.headers?.length
        ? manualRequest.headers
        : [{ key: 'Accept', value: 'application/json', enabled: true }],
      auth: manualRequest?.auth ?? { type: 'inherit' },
    })

    if (manualRequest?.body) {
      updateRequest({ body: manualRequest.body })
    } else if (isActiveManual) {
      updateRequest({ body: '' })
    } else {
      let requestBodySchema: any = null
      if (
        endpointObj &&
        typeof endpointObj === 'object' &&
        'requestBody' in endpointObj &&
        endpointObj.requestBody &&
        typeof endpointObj.requestBody === 'object' &&
        'content' in endpointObj.requestBody &&
        endpointObj.requestBody.content &&
        typeof endpointObj.requestBody.content === 'object' &&
        'application/json' in endpointObj.requestBody.content
      ) {
        const jsonContent = (endpointObj.requestBody as { content: Record<string, { schema?: unknown; example?: unknown }> })
          .content['application/json']
        requestBodySchema = jsonContent?.schema
      }

      if (requestBodySchema) {
        updateRequest({ body: generateMockFromSchema(requestBodySchema) })
      } else if (
        endpointObj &&
        typeof endpointObj === 'object' &&
        'requestBody' in endpointObj &&
        endpointObj.requestBody &&
        typeof endpointObj.requestBody === 'object' &&
        'content' in endpointObj.requestBody &&
        endpointObj.requestBody.content &&
        typeof endpointObj.requestBody.content === 'object'
      ) {
        const jsonContent = (endpointObj.requestBody as { content: Record<string, { example?: unknown }> }).content[
          'application/json'
        ]
        if (jsonContent?.example !== undefined) {
          const example = jsonContent.example
          updateRequest({
            body: typeof example === 'string' ? example : JSON.stringify(example, null, 2),
          })
        } else {
          updateRequest({ body: '' })
        }
      } else {
        updateRequest({ body: '' })
      }
    }

    if (isActiveManual && manualRequest) {
      selectManualCollectionRequest(endpointOrderKey(manualRequest.method, manualRequest.path))
    }

    const elId = `endpoint-${method}-${path.replace(/[/\\?%*:|"<>]/g, '-')}`
    const el = document.getElementById(elId)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, flexShrink: 0 }}>
        <Typography variant="subtitle2" sx={{ color: 'text.primary', fontWeight: 700 }}>
          API Specifications
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            startIcon={<FileDownloadOutlinedIcon />}
            size="small"
            onClick={handleExportAll}
            disabled={!activeProjectId || specs.length === 0 || exporting}
            sx={{ color: 'text.secondary' }}
          >
            Export All
          </Button>
          <Button
            startIcon={<FolderOpenOutlinedIcon />}
            size="small"
            onClick={handleOpenCreate}
            sx={{ color: 'secondary.main' }}
          >
            Create
          </Button>
          <Button
            startIcon={<AddIcon />}
            size="small"
            onClick={handleOpen}
            sx={{
              color: 'primary.main',
              '&:hover': {
                backgroundColor: 'action.hover',
              },
            }}
          >
            Import
          </Button>
        </Box>
      </Box>

      {exportNotice && (
        <Alert severity="success" onClose={() => setExportNotice(null)} sx={{ mx: 2, mb: 1, flexShrink: 0 }}>
          {exportNotice}
        </Alert>
      )}

      <Divider sx={{ flexShrink: 0 }} />

      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: 2 }}>
        {(specs ?? []).length === 0 ? (
          <Typography variant="body2" sx={{ color: 'text.secondary', py: 4, textAlign: 'center' }}>
            No specifications yet. Click "Create" to build requests manually, or "Import" to load OpenAPI/Swagger.
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {(specs ?? []).map((spec) => {
              const isManual =
                activeSpecId === spec.id && parsedSpec
                  ? isManualCollection(parsedSpec)
                  : isManualSpecContent(spec.content)

              return (
              <Accordion
                key={spec.id}
                expanded={activeSpecId === spec.id}
                onChange={(_, expanded) => selectSpec(expanded ? spec.id : null)}
                sx={{
                  boxShadow: 'none',
                  border: '1px solid',
                  borderColor: 'divider',
                  '&:before': { display: 'none' },
                  borderRadius: '8px !important',
                  overflow: 'hidden',
                }}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: 'text.secondary' }} />}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', pr: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                      <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 600 }}>
                        {spec.name}
                      </Typography>
                      {isManual && (
                        <Chip label="Manual" size="small" color="secondary" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
                      )}
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <IconButton
                        size="small"
                        disabled={exporting}
                        onClick={(e) => {
                          e.stopPropagation()
                          void handleExportSpec(spec.id)
                        }}
                        sx={{
                          color: 'text.secondary',
                          opacity: 0.7,
                          '&:hover': {
                            color: 'primary.main',
                            opacity: 1,
                            backgroundColor: 'action.hover',
                          },
                        }}
                      >
                        <FileDownloadOutlinedIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeleteConfirmSpecId(spec.id)
                        }}
                      sx={{
                        color: 'text.secondary',
                        opacity: 0.7,
                        '&:hover': {
                          color: 'error.main',
                          opacity: 1,
                          backgroundColor: 'action.hover',
                        },
                      }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>
                </AccordionSummary>
                <AccordionDetails sx={{ px: 1, py: 0, borderTop: '1px solid', borderColor: 'divider' }}>
                  {activeSpecId === spec.id && isManual && (
                    <Box sx={{ px: 1.5, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        <Button
                          size="small"
                          startIcon={<AddIcon />}
                          onClick={handleOpenAddRequest}
                          sx={{ color: 'primary.main', fontWeight: 600 }}
                        >
                          Add Request
                        </Button>
                        <Button
                          size="small"
                          startIcon={<EditIcon />}
                          onClick={() => setVariablesDialogOpen(true)}
                          sx={{ color: 'secondary.main', fontWeight: 600 }}
                        >
                          Collection Variables
                        </Button>
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                        Drag requests using the handle to change execution order. Use {'{{variableName}}'} in requests
                        and configure post-variables per request to chain values across the collection.
                      </Typography>
                    </Box>
                  )}
                  {activeSpecId === spec.id && parsedSpec ? (
                    isManual ? (
                      CollectionRequestList ? (
                        <CollectionRequestList
                          parsedSpec={parsedSpec}
                          savingOrder={savingOrder}
                          onSelect={handleEndpointClick}
                          onEdit={handleOpenEditRequest}
                          onDelete={(path, method) => setDeleteRequestKey({ path, method })}
                          onReorder={handleReorderRequests}
                        />
                      ) : (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                          <CircularProgress size={24} />
                        </Box>
                      )
                    ) : (
                      ImportedSpecPanel ? (
                        <ImportedSpecPanel
                          parsedSpec={parsedSpec}
                          projectId={activeProjectId ?? ''}
                          onSelect={handleEndpointClick}
                        />
                      ) : (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                          <CircularProgress size={24} />
                        </Box>
                      )
                    )
                  ) : activeSpecId === spec.id ? (
                    <Typography variant="body2" sx={{ color: 'text.secondary', py: 2, px: 2, fontStyle: 'italic' }}>
                      Parsing specification...
                    </Typography>
                  ) : null}
                </AccordionDetails>
              </Accordion>
              )
            })}
          </Box>
        )}
      </Box>

      {/* Create Manual Collection Dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ color: 'text.primary', fontWeight: 700 }}>Create API Collection</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            {error && createOpen && (
              <AppErrorAlert error={error} title="Could not create collection" onDismiss={() => setError(null)} />
            )}
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Build APIs manually when you do not have a Swagger or OpenAPI file. Requests are saved to your workspace.
            </Typography>
            <TextField
              label="Collection Name"
              value={collectionName}
              onChange={(e) => setCollectionName(e.target.value)}
              fullWidth
              required
              placeholder="e.g. User Service APIs"
            />
            <TextField
              label="Base URL (optional)"
              value={collectionBaseUrl}
              onChange={(e) => setCollectionBaseUrl(e.target.value)}
              fullWidth
              placeholder="Leave empty to use environment base URL"
              helperText="Optional. If empty, requests use the base URL from your selected environment only."
              sx={{ '& .MuiInputBase-input': { fontFamily: 'monospace' } }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setCreateOpen(false)} sx={{ color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button onClick={() => void handleCreateCollection()} variant="contained">
            Create Collection
          </Button>
        </DialogActions>
      </Dialog>

      {RequestDialog && requestDialogOpen && (
        <RequestDialog
          open
          mode={requestDialogMode}
          initialRequest={editingRequest}
          onClose={() => setRequestDialogOpen(false)}
          onSave={handleSaveRequest}
        />
      )}

      {VariablesDialog && variablesDialogOpen && parsedSpec && isActiveManual && (
        <VariablesDialog
          open
          variables={extractCollectionVariables(parsedSpec)}
          onClose={() => setVariablesDialogOpen(false)}
          onSave={handleSaveCollectionVariables}
        />
      )}

      {/* Import Spec Dialog */}
      <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
        <DialogTitle sx={{ color: 'text.primary', fontWeight: 700 }}>Import OpenAPI Specification</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            {error && (
              <AppErrorAlert
                error={error}
                title="Invalid API specification"
                onRetry={handleImport}
                onDismiss={() => setError(null)}
              />
            )}
            <TextField
              label="Specification Friendly Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              fullWidth
              required
              placeholder="e.g. Petstore API"
            />

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Button
                  variant="outlined"
                  startIcon={<FolderOpenIcon />}
                  onClick={handleBrowseFile}
                  disabled={browsing}
                >
                  {browsing ? 'Opening…' : 'Browse file…'}
                </Button>
                {selectedFile && (
                  <Chip
                    label={selectedFile}
                    size="small"
                    onDelete={() => {
                      setSelectedFile(null)
                      setContent('')
                    }}
                  />
                )}
              </Box>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Select a local Swagger/OpenAPI file (.json, .yaml, .yml), or paste content below.
              </Typography>
            </Box>

            <TextField
              label="Swagger/OpenAPI Content (JSON or YAML)"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              multiline
              rows={14}
              fullWidth
              required
              placeholder="Paste spec content here..."
              sx={{
                '& .MuiInputBase-input': {
                  fontFamily: 'monospace',
                  fontSize: '0.8rem',
                },
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={handleClose} sx={{ color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            variant="contained"
            startIcon={<FileUploadIcon />}
            sx={{ bgcolor: 'primary.main' }}
          >
            Import Spec
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={deleteRequestKey !== null}
        onClose={() => setDeleteRequestKey(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700, color: 'error.main' }}>Delete Request?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Remove this request from the collection? This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setDeleteRequestKey(null)} sx={{ color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button onClick={() => void handleConfirmDeleteRequest()} variant="contained" color="error">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={deleteConfirmSpecId !== null}
        onClose={() => setDeleteConfirmSpecId(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700, color: 'error.main' }}>Delete API Specification?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Are you sure you want to delete this specification? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setDeleteConfirmSpecId(null)} sx={{ color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button onClick={() => void handleConfirmDeleteSpec()} variant="contained" color="error">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
