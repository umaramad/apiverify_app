import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import { useAppStore } from '../store/app.store'
import { useShallow } from 'zustand/react/shallow'
import ImportedSpecEndpointList from './ImportedSpecEndpointList'
import { extractEndpointsFromSpec } from '../../../shared/engine/endpointExtractor'
import { endpointOrderKey } from '../../../shared/manualCollectionOrder'
import { isManualSpecContent } from '../../../shared/manualCollection'
import { buildCurlCommands } from '../utils/curl'

export interface ImportedSpecExplorerPanelProps {
  parsedSpec: Record<string, unknown>
  projectId: string
  onSelect: (path: string, method: string, pathObj: Record<string, unknown>) => void
}

export default function ImportedSpecExplorerPanel({
  parsedSpec,
  projectId,
  onSelect
}: ImportedSpecExplorerPanelProps): React.JSX.Element {
  const {
    specs,
    environments,
    activeEnvId,
    saveImportedSelectionAsCollection,
    addEndpointsToManualCollection,
    loadSpecs
  } = useAppStore(
    useShallow((s) => ({
      specs: s.specs,
      environments: s.environments,
      activeEnvId: s.activeEnvId,
      saveImportedSelectionAsCollection: s.saveImportedSelectionAsCollection,
      addEndpointsToManualCollection: s.addEndpointsToManualCollection,
      loadSpecs: s.loadSpecs
    }))
  )

  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [selectionOrder, setSelectionOrder] = useState<string[]>([])
  const [saveOpen, setSaveOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [targetCollectionId, setTargetCollectionId] = useState('')
  const [saveName, setSaveName] = useState('')
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [curlOpen, setCurlOpen] = useState(false)
  const [curlCommand, setCurlCommand] = useState('')
  const [curlMessage, setCurlMessage] = useState<string | null>(null)

  const endpoints = useMemo(
    () =>
      extractEndpointsFromSpec(projectId, parsedSpec, {
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
      }),
    [parsedSpec, projectId]
  )
  const endpointMap = useMemo(
    () =>
      new Map(
        endpoints.map((endpoint) => [endpointOrderKey(endpoint.method, endpoint.path), endpoint])
      ),
    [endpoints]
  )
  const selectedEndpoints = useMemo(
    () =>
      selectionOrder
        .filter((key) => selectedKeys.has(key))
        .map((key) => endpointMap.get(key))
        .filter((endpoint): endpoint is NonNullable<typeof endpoint> => endpoint !== undefined),
    [endpointMap, selectedKeys, selectionOrder]
  )
  const manualCollections = useMemo(
    () => specs.filter((spec) => isManualSpecContent(spec.content)),
    [specs]
  )
  const selectedEnvironment = environments.find((env) => env.id === activeEnvId)

  useEffect(() => {
    setSelectedKeys(new Set())
    setSelectionOrder([])
    setNotice(null)
  }, [parsedSpec])

  const toggleEndpoint = (key: string): void => {
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
        setSelectionOrder((order) => (order.includes(key) ? order : [...order, key]))
      }
      return next
    })
  }

  const toggleAllEndpoints = (keys: string[], selected: boolean): void => {
    if (!selected) {
      setSelectedKeys((prev) => {
        const next = new Set(prev)
        keys.forEach((key) => next.delete(key))
        return next
      })
      return
    }

    setSelectedKeys((prev) => {
      const next = new Set(prev)
      keys.forEach((key) => next.add(key))
      return next
    })
    setSelectionOrder((order) => {
      const existing = new Set(order)
      const next = [...order]
      keys.forEach((key) => {
        if (!existing.has(key)) next.push(key)
      })
      return next
    })
  }

  const handleOpenSave = (): void => {
    if (selectedKeys.size === 0) return
    const info = parsedSpec.info as { title?: string } | undefined
    setSaveName(info?.title ? `${info.title} Collection` : 'Imported APIs Collection')
    setSaveError(null)
    setSaveOpen(true)
  }

  const handleSave = async (): Promise<void> => {
    if (!saveName.trim() || selectedKeys.size === 0) return

    setSaving(true)
    setNotice(null)
    setSaveError(null)

    const result = await saveImportedSelectionAsCollection(
      saveName.trim(),
      parsedSpec,
      selectionOrder,
      [...selectedKeys]
    )
    setSaving(false)

    if (result.success) {
      setSaveOpen(false)
      setNotice(`Collection "${saveName.trim()}" saved with ${selectedKeys.size} API(s).`)
      setSelectedKeys(new Set())
      setSelectionOrder([])
      await loadSpecs()
    } else {
      setSaveError(result.error ?? 'Failed to save collection.')
    }
  }

  const handleAddToExisting = async (): Promise<void> => {
    if (!targetCollectionId || selectedEndpoints.length === 0) return

    setSaving(true)
    setNotice(null)
    setSaveError(null)

    const target = manualCollections.find((collection) => collection.id === targetCollectionId)
    const result = await addEndpointsToManualCollection(targetCollectionId, selectedEndpoints)
    setSaving(false)

    if (result.success) {
      const added = result.addedCount ?? selectedEndpoints.length
      const skipped = result.skippedCount ?? 0
      setAddOpen(false)
      setNotice(
        `${added} API${added === 1 ? '' : 's'} added to "${target?.name ?? 'collection'}"${skipped > 0 ? `; ${skipped} already existed.` : '.'}`
      )
      setSelectedKeys(new Set())
      setSelectionOrder([])
      setTargetCollectionId('')
      await loadSpecs()
    } else {
      setSaveError(result.error ?? 'Failed to add APIs to collection.')
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

  return (
    <>
      <Box
        sx={{
          px: 1.5,
          py: 1.5,
          borderBottom: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          gap: 1,
          flexWrap: 'wrap',
          alignItems: 'center'
        }}
      >
        <Button
          size="small"
          variant="contained"
          disabled={selectedKeys.size === 0}
          onClick={handleOpenSave}
        >
          Save Selected as Collection ({selectedKeys.size})
        </Button>
        <Button
          size="small"
          variant="outlined"
          startIcon={<AddIcon />}
          disabled={selectedKeys.size === 0 || manualCollections.length === 0}
          onClick={() => {
            setTargetCollectionId(manualCollections[0]?.id ?? '')
            setSaveError(null)
            setAddOpen(true)
          }}
        >
          Add to Existing
        </Button>
        <Button
          size="small"
          variant="outlined"
          startIcon={<ContentCopyIcon />}
          disabled={selectedKeys.size === 0 || !selectedEnvironment}
          onClick={handleShowCurl}
        >
          cURL
        </Button>
        <Typography variant="caption" color="text.secondary">
          Select APIs in the order you want to save, add, or copy.
        </Typography>
      </Box>
      {notice && (
        <Alert severity="success" onClose={() => setNotice(null)} sx={{ mx: 1.5, mt: 1 }}>
          {notice}
        </Alert>
      )}
      <ImportedSpecEndpointList
        parsedSpec={parsedSpec}
        projectId={projectId}
        selectedKeys={selectedKeys}
        selectionOrder={selectionOrder}
        onToggle={toggleEndpoint}
        onToggleAll={toggleAllEndpoints}
        onSelect={onSelect}
      />

      <Dialog open={saveOpen} onClose={() => setSaveOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Save Selected APIs as Collection</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {selectedKeys.size} API(s) will be saved as a manual collection in the order you
              selected them. Request names are taken from the imported specification.
            </Typography>
            <TextField
              label="Collection Name"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              fullWidth
              required
              autoFocus
            />
            {saveError && <Alert severity="error">{saveError}</Alert>}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setSaveOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleSave()}
            disabled={!saveName.trim() || saving}
          >
            {saving ? 'Saving…' : 'Save Collection'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Add Selected APIs to Collection</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {selectedKeys.size} API(s) will be appended to the selected manual collection in
              selection order.
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
            {saveError && <Alert severity="error">{saveError}</Alert>}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setAddOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleAddToExisting()}
            disabled={!targetCollectionId || saving}
          >
            {saving ? 'Adding…' : 'Add APIs'}
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
    </>
  )
}
