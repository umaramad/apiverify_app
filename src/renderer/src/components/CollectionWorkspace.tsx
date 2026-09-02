import React, { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Tab,
  Tabs,
  Typography,
} from '@mui/material'
import { useAppStore } from '../store/app.store'
import { useShallow } from 'zustand/react/shallow'

type WorkspaceTab = 'request' | 'response' | 'variables'

type RequestEditorComponent = React.ComponentType
type ResponseViewerComponent = React.ComponentType<{ embedded?: boolean }>
type CollectionExecutionPanelComponent = React.ComponentType<{ variant?: 'default' | 'tab' }>

interface TabPanelProps {
  children: React.ReactNode
  value: WorkspaceTab
  index: WorkspaceTab
}

function WorkspaceTabPanel({ children, value, index }: TabPanelProps): React.JSX.Element | null {
  if (value !== index) return null

  return (
    <Box
      role="tabpanel"
      sx={{
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {children}
    </Box>
  )
}

function PanelLoading(): React.JSX.Element {
  return (
    <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 160 }}>
      <CircularProgress size={24} />
    </Box>
  )
}

export default function CollectionWorkspace(): React.JSX.Element {
  const { response, collectionRunStatus, collectionRuntimeVariables, activeEnvId, runCollection, resetCollectionVariables, collectionWorkspaceFocus } =
    useAppStore(
      useShallow((s) => ({
        response: s.response,
        collectionRunStatus: s.collectionRunStatus,
        collectionRuntimeVariables: s.collectionRuntimeVariables,
        activeEnvId: s.activeEnvId,
        runCollection: s.runCollection,
        resetCollectionVariables: s.resetCollectionVariables,
        collectionWorkspaceFocus: s.collectionWorkspaceFocus,
      }))
    )

  const [activeTab, setActiveTab] = useState<WorkspaceTab>('request')
  const [RequestEditorPanel, setRequestEditorPanel] = useState<RequestEditorComponent | null>(null)
  const [ResponseViewerPanel, setResponseViewerPanel] = useState<ResponseViewerComponent | null>(null)
  const [ExecutionPanel, setExecutionPanel] = useState<CollectionExecutionPanelComponent | null>(null)
  const wasLoadingRef = useRef(false)

  useEffect(() => {
    if (wasLoadingRef.current && !response.loading && (response.status > 0 || response.error)) {
      setActiveTab('response')
    }
    wasLoadingRef.current = response.loading
  }, [response.loading, response.status, response.error])

  useEffect(() => {
    if (collectionRunStatus === 'running') {
      setActiveTab('variables')
    }
  }, [collectionRunStatus])

  useEffect(() => {
    setActiveTab('request')
  }, [collectionWorkspaceFocus])

  useEffect(() => {
    if (activeTab !== 'request' || RequestEditorPanel) return

    let cancelled = false
    void import('./RequestEditor').then((module) => {
      if (!cancelled) {
        setRequestEditorPanel(() => module.default)
      }
    })

    return () => {
      cancelled = true
    }
  }, [activeTab, RequestEditorPanel])

  useEffect(() => {
    if (activeTab !== 'response' || ResponseViewerPanel) return

    let cancelled = false
    void import('./ResponseViewer').then((module) => {
      if (!cancelled) {
        setResponseViewerPanel(() => module.default)
      }
    })

    return () => {
      cancelled = true
    }
  }, [activeTab, ResponseViewerPanel])

  useEffect(() => {
    if (activeTab !== 'variables' || ExecutionPanel) return

    let cancelled = false
    void import('./CollectionExecutionPanel').then((module) => {
      if (!cancelled) {
        setExecutionPanel(() => module.default)
      }
    })

    return () => {
      cancelled = true
    }
  }, [activeTab, ExecutionPanel])

  const variableCount = Object.keys(collectionRuntimeVariables).length

  return (
    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Box
        sx={{
          flexShrink: 0,
          px: 2,
          pt: 1.5,
          pb: 0,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, mb: 1 }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Collection Workspace
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Use tabs to switch between building a request, viewing the response, and running the full collection.
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <Button
              size="small"
              variant="outlined"
              onClick={() => resetCollectionVariables()}
              disabled={collectionRunStatus === 'running'}
            >
              Reset Variables
            </Button>
            <Button
              size="small"
              variant="contained"
              onClick={() => void runCollection()}
              disabled={!activeEnvId || collectionRunStatus === 'running'}
            >
              {collectionRunStatus === 'running' ? 'Running…' : 'Run Collection'}
            </Button>
          </Box>
        </Box>

        {!activeEnvId && (
          <Alert severity="warning" sx={{ mb: 1, py: 0 }}>
            Select an active environment before running the collection.
          </Alert>
        )}

        <Tabs
          value={activeTab}
          onChange={(_, value: WorkspaceTab) => setActiveTab(value)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            minHeight: 42,
            '& .MuiTab-root': {
              minHeight: 42,
              textTransform: 'none',
              fontWeight: 600,
              fontSize: '0.85rem',
            },
          }}
        >
          <Tab label="Request" value="request" />
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                Response
                {response.status > 0 && (
                  <Chip
                    label={response.status}
                    size="small"
                    sx={{
                      height: 18,
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      bgcolor: response.status >= 200 && response.status < 300 ? 'success.main' : 'warning.main',
                      color: '#fff',
                    }}
                  />
                )}
              </Box>
            }
            value="response"
          />
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                Variables &amp; Log
                {variableCount > 0 && (
                  <Chip label={variableCount} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.65rem' }} />
                )}
              </Box>
            }
            value="variables"
          />
        </Tabs>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', bgcolor: 'background.paper' }}>
        <WorkspaceTabPanel value={activeTab} index="request">
          {RequestEditorPanel ? <RequestEditorPanel /> : <PanelLoading />}
        </WorkspaceTabPanel>

        <WorkspaceTabPanel value={activeTab} index="response">
          {ResponseViewerPanel ? <ResponseViewerPanel embedded /> : <PanelLoading />}
        </WorkspaceTabPanel>

        <WorkspaceTabPanel value={activeTab} index="variables">
          <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: 2 }}>
            {ExecutionPanel ? <ExecutionPanel variant="tab" /> : <PanelLoading />}
          </Box>
        </WorkspaceTabPanel>
      </Box>
    </Box>
  )
}

export function CollectionWorkspaceLoading(): React.JSX.Element {
  return (
    <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 240 }}>
      <CircularProgress size={28} />
    </Box>
  )
}
