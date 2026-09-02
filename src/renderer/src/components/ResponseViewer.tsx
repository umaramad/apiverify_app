import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Typography,
} from '@mui/material'
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined'
import InfoIcon from '@mui/icons-material/Info'
import { useAppStore } from '../store/app.store'
import { useShallow } from 'zustand/react/shallow'
import AppErrorAlert from './AppErrorAlert'
import { isManualCollection } from '../../../shared/manualCollection'
import {
  suggestBodyResponseVariables,
  suggestHeaderResponseVariables,
} from '../../../shared/responseVariableSuggestions'

type ResponseVariablePickerComponent = React.ComponentType<{
  status: number
  headers: Record<string, string>
  data: unknown
  embedded?: boolean
}>

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
  disablePadding?: boolean
  scrollable?: boolean
}

const RESPONSE_TAB = {
  body: 0,
  headers: 1,
  validation: 2,
  variables: 3,
} as const

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
      id={`response-tabpanel-${index}`}
      aria-labelledby={`response-tab-${index}`}
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

export default function ResponseViewer({ embedded = false }: { embedded?: boolean }): React.JSX.Element {
  const { response, validation, activeSpecId, parsedSpec, sendRequest } = useAppStore(
    useShallow((s) => ({
      response: s.response,
      validation: s.validation,
      activeSpecId: s.activeSpecId,
      parsedSpec: s.parsedSpec,
      sendRequest: s.sendRequest,
    }))
  )
  const [tabValue, setTabValue] = useState<number>(RESPONSE_TAB.body)
  const [VariablePicker, setVariablePicker] = useState<ResponseVariablePickerComponent | null>(null)
  const wasLoadingRef = useRef(false)

  const showVariablePicker =
    embedded &&
    parsedSpec &&
    isManualCollection(parsedSpec) &&
    response.status >= 200 &&
    response.status < 300 &&
    !response.loading

  const variableSuggestionCount = useMemo(() => {
    if (!showVariablePicker) return 0
    return (
      suggestBodyResponseVariables(response.data).length +
      suggestHeaderResponseVariables(response.headers).length
    )
  }, [showVariablePicker, response.data, response.headers])

  const hasVariableSuggestions = variableSuggestionCount > 0

  useEffect(() => {
    if (!hasVariableSuggestions) {
      setVariablePicker(null)
      return
    }

    let cancelled = false
    void import('./ResponseVariablePicker').then((module) => {
      if (!cancelled) {
        setVariablePicker(() => module.default)
      }
    })

    return () => {
      cancelled = true
    }
  }, [hasVariableSuggestions, response.status, response.data])

  useEffect(() => {
    if (wasLoadingRef.current && !response.loading && hasVariableSuggestions) {
      setTabValue(RESPONSE_TAB.variables)
    }
    wasLoadingRef.current = response.loading
  }, [response.loading, hasVariableSuggestions])

  const handleTabChange = (_: React.SyntheticEvent, newValue: number): void => {
    setTabValue(newValue)
  }

  const getStatusColor = (status: number): string => {
    if (status >= 200 && status < 300) return '#10B981' // Green
    if (status >= 300 && status < 400) return '#3B82F6' // Blue
    if (status >= 400 && status < 500) return '#F59E0B' // Orange
    return '#EF4444' // Red
  }

  // Format JSON response safely
  const getFormattedData = (): string => {
    if (!response.data) return ''
    if (typeof response.data === 'string') {
      try {
        return JSON.stringify(JSON.parse(response.data), null, 2)
      } catch (_) {
        return response.data
      }
    }
    return JSON.stringify(response.data, null, 2)
  }

  // Calculate size in KB/bytes
  const getResponseSize = (): string => {
    if (!response.data) return '0 B'
    const str = typeof response.data === 'object' ? JSON.stringify(response.data) : String(response.data)
    const bytes = new Blob([str]).size
    if (bytes >= 1024) {
      return `${(bytes / 1024).toFixed(2)} KB`
    }
    return `${bytes} B`
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
        bgcolor: 'background.paper',
        ...(embedded ? {} : { borderLeft: '1px solid', borderColor: 'divider' }),
      }}
    >
      {/* Loading state */}
      {response.loading && (
        <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', gap: 2 }}>
          <CircularProgress color="primary" />
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Sending request...
          </Typography>
        </Box>
      )}

      {/* No response yet */}
      {!response.loading && !response.status && !response.error && (
        <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', p: 4 }}>
          <InfoIcon sx={{ color: 'text.secondary', fontSize: 40, mb: 1 }} />
          <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center' }}>
            Send a request to see the response payload and schema validation results.
          </Typography>
        </Box>
      )}

      {/* Error state (Network Error, etc.) */}
      {!response.loading && response.error && !response.status && (
        <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2, flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <AppErrorAlert
            error={response.errorPayload ?? response.error}
            onRetry={() => sendRequest()}
            onDismiss={() =>
              useAppStore.setState({
                response: { ...useAppStore.getState().response, error: null, errorPayload: null },
              })
            }
          />
        </Box>
      )}

      {/* Response Panel */}
      {!response.loading && response.status > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {/* Compact response summary — status, size, validation in one line */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 2,
              py: 0.75,
              borderBottom: '1px solid',
              borderColor: 'divider',
              flexShrink: 0,
              overflow: 'hidden',
              whiteSpace: 'nowrap',
            }}
          >
            <Chip
              label={response.status}
              size="small"
              sx={{
                height: 22,
                bgcolor: getStatusColor(response.status),
                color: '#FFFFFF',
                fontWeight: 700,
                fontSize: '0.7rem',
                flexShrink: 0,
              }}
            />
            <Typography variant="caption" sx={{ fontWeight: 600, flexShrink: 0 }}>
              {response.statusText}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
              ·
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
              {getResponseSize()}
            </Typography>
            {activeSpecId && validation && (
              <>
                <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                  ·
                </Typography>
                {validation.valid ? (
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'success.main',
                      fontWeight: 600,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    Schema matches spec
                  </Typography>
                ) : (
                  <Typography
                    variant="caption"
                    sx={{
                      color: 'error.main',
                      fontWeight: 600,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {validation.errors?.length || 0} schema violation(s)
                  </Typography>
                )}
              </>
            )}
          </Box>

          {/* Tabs */}
          <Box sx={{ borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
            <Tabs
              value={tabValue}
              onChange={handleTabChange}
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
              <Tab label="Body" />
              <Tab label="Headers" />
              <Tab label={`Validation ${validation && !validation.valid ? `(${validation.errors?.length})` : ''}`} />
              {hasVariableSuggestions && (
                <Tab label={`Create Variables (${variableSuggestionCount})`} />
              )}
            </Tabs>
          </Box>

          <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* Body Tab */}
          <TabPanel value={tabValue} index={RESPONSE_TAB.body}>
            <Typography
              component="pre"
              sx={{
                m: 0,
                fontFamily: 'monospace',
                fontSize: '0.8rem',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                color: 'text.primary',
                bgcolor: 'action.hover',
                p: 2,
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
              }}
            >
              {getFormattedData()}
            </Typography>
          </TabPanel>

          {/* Headers Tab */}
          <TabPanel value={tabValue} index={RESPONSE_TAB.headers}>
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
              <Table size="small">
                <TableBody>
                  {Object.entries(response.headers).map(([key, value]) => (
                    <TableRow key={key} sx={{ '&:nth-of-type(odd)': { bgcolor: 'action.hover' } }}>
                      <TableCell sx={{ color: 'text.primary', fontWeight: 600, width: '30%', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                        {key}
                      </TableCell>
                      <TableCell sx={{ color: 'text.secondary', fontFamily: 'monospace', fontSize: '0.75rem', wordBreak: 'break-all' }}>
                        {value}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </TabPanel>

          {/* Schema Validation Tab */}
          <TabPanel value={tabValue} index={RESPONSE_TAB.validation}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {!activeSpecId ? (
                <Card variant="outlined" sx={{ borderColor: 'divider', borderRadius: 2, bgcolor: 'action.hover' }}>
                  <CardContent>
                    <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center' }}>
                      No active specification selected to run validation. Select an OpenAPI spec from the sidebar to validate schemas automatically.
                    </Typography>
                  </CardContent>
                </Card>
              ) : validation ? (
                validation.valid ? (
                  <Card variant="outlined" sx={{ borderColor: 'success.light', bgcolor: 'action.hover', borderRadius: 2 }}>
                    <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <CheckCircleOutlinedIcon sx={{ color: 'success.main', fontSize: 32 }} />
                      <Box>
                        <Typography variant="subtitle2" sx={{ color: 'success.main', fontWeight: 700 }}>
                          Schema Validation Passed
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'success.main' }}>
                          The payload perfectly maps the schema defined for response code {response.status}.
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {validation.message && (
                      <Alert severity="warning" sx={{ border: '1px solid', borderColor: 'warning.light' }}>
                        {validation.message}
                      </Alert>
                    )}
                    
                    <Typography variant="subtitle2" sx={{ color: 'text.primary', fontWeight: 700 }}>
                      Validation Failures ({validation.errors?.length || 0})
                    </Typography>

                    {validation.errors?.map((err, i) => (
                      <Paper
                        key={i}
                        variant="outlined"
                        sx={{
                          p: 2,
                          borderColor: 'error.light',
                          bgcolor: 'action.hover',
                          borderRadius: 2,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 1,
                        }}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 700, color: 'error.main', fontSize: '0.8rem' }}>
                            {err.instancePath || 'root'}
                          </Typography>
                          <Chip
                            label={err.keyword}
                            size="small"
                            sx={{
                              bgcolor: 'error.light',
                              color: 'error.contrastText',
                              fontWeight: 700,
                              fontSize: '0.65rem',
                              height: 18,
                            }}
                          />
                        </Box>
                        
                        <Typography variant="body2" sx={{ color: 'error.main', fontWeight: 500, fontSize: '0.85rem' }}>
                          {err.message}
                        </Typography>

                        <Divider />

                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                            Schema Details:
                          </Typography>
                          <Typography
                            variant="caption"
                            component="pre"
                            sx={{
                              bgcolor: 'background.paper',
                              p: 1,
                              borderRadius: 1,
                              border: '1px solid',
                              borderColor: 'divider',
                              fontFamily: 'monospace',
                              fontSize: '0.75rem',
                              overflowX: 'auto',
                            }}
                          >
                            {JSON.stringify(
                              {
                                schemaPath: err.schemaPath,
                                params: err.params,
                              },
                              null,
                              2
                            )}
                          </Typography>
                        </Box>
                      </Paper>
                    ))}
                  </Box>
                )
              ) : (
                <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center', py: 4 }}>
                  No validation logs generated.
                </Typography>
              )}
            </Box>
          </TabPanel>

          {hasVariableSuggestions && VariablePicker && (
            <TabPanel
              value={tabValue}
              index={RESPONSE_TAB.variables}
              disablePadding
              scrollable={false}
            >
              <VariablePicker
                status={response.status}
                headers={response.headers}
                data={response.data}
                embedded
              />
            </TabPanel>
          )}
          </Box>
        </Box>
      )}
    </Box>
  )
}
