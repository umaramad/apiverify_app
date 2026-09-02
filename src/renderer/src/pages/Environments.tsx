import React, { useState, useEffect, useMemo } from 'react'
import { getFriendlyMessage } from '../../../shared/errors'
import {
  Alert,
  Box,
  Typography,
  Paper,
  Button,
  TextField,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  IconButton,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Tabs,
  Tab,
  Checkbox,
  CircularProgress,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined'
import SaveIcon from '@mui/icons-material/Save'
import { useAppStore } from '../store/app.store'
import { useShallow } from 'zustand/react/shallow'
import type { Environment, HeaderOrQueryParam, ApiAuthConfig, AuthType } from '../../../shared/models'
import MaskedSecretField from '../components/MaskedSecretField'
import { isSensitiveKey } from '../../../shared/security/redact'
import {
  authConfigWithNewToken,
  formatOAuthTokenExpiryDisplay,
  getOAuthTokenExpiryInfo,
} from '../../../shared/auth/oauthClientCredentials'

export default function Environments(): React.JSX.Element {
  const {
    environments,
    activeEnvId,
    activeProjectId,
    saveEnvironment,
    deleteEnvironment,
    setActiveEnvironment,
    exportConfiguration,
  } = useAppStore(
    useShallow((s) => ({
      environments: s.environments,
      activeEnvId: s.activeEnvId,
      activeProjectId: s.activeProjectId,
      saveEnvironment: s.saveEnvironment,
      deleteEnvironment: s.deleteEnvironment,
      setActiveEnvironment: s.setActiveEnvironment,
      exportConfiguration: s.exportConfiguration,
    }))
  )

  const [selectedEnv, setSelectedEnv] = useState<Environment | null>(null)
  const [activeTab, setActiveTab] = useState(0)
  const [exportNotice, setExportNotice] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [tokenVerifyStatus, setTokenVerifyStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [tokenVerifyMessage, setTokenVerifyMessage] = useState('')
  const [tokenExpiryNow, setTokenExpiryNow] = useState(() => Date.now())

  // Local state for the selected environment (draft)
  const [envName, setEnvName] = useState('')
  const [envType, setEnvType] = useState<Environment['type']>('Custom')
  const [envBaseUrl, setEnvBaseUrl] = useState('')
  const [variablesList, setVariablesList] = useState<Array<{ key: string; value: string }>>([])
  const [headersList, setHeadersList] = useState<HeaderOrQueryParam[]>([])
  const [authConfig, setAuthConfig] = useState<ApiAuthConfig>({ type: 'none' })
  
  const [openAddModal, setOpenAddModal] = useState(false)
  const [newEnvName, setNewEnvName] = useState('')
  const [newEnvType, setNewEnvType] = useState<Environment['type']>('Custom')
  const [deleteConfirmEnvId, setDeleteConfirmEnvId] = useState<string | null>(null)

  // Sync state when selectedEnv changes
  useEffect(() => {
    if (selectedEnv) {
      setTokenVerifyStatus('idle')
      setTokenVerifyMessage('')
      setTokenExpiryNow(Date.now())
      setEnvName(selectedEnv.name)
      setEnvType(selectedEnv.type || 'Custom')
      setEnvBaseUrl(selectedEnv.baseUrl || '')

      try {
        const parsed = typeof selectedEnv.variables === 'string' ? JSON.parse(selectedEnv.variables) : selectedEnv.variables
        const mapped = Object.keys(parsed || {}).map((k) => ({ key: k, value: String(parsed[k]) }))
        setVariablesList(mapped)
      } catch (_) {
        setVariablesList([])
      }

      try {
        const parsedHeaders = typeof selectedEnv.defaultHeaders === 'string' ? JSON.parse(selectedEnv.defaultHeaders) : (selectedEnv.defaultHeaders || [])
        setHeadersList(parsedHeaders)
      } catch (_) {
        setHeadersList([])
      }

      try {
        const parsedAuth = typeof selectedEnv.authConfig === 'string' ? JSON.parse(selectedEnv.authConfig) : (selectedEnv.authConfig || { type: 'none' })
        setAuthConfig(parsedAuth)
      } catch (_) {
        setAuthConfig({ type: 'none' })
      }
    } else {
      setVariablesList([])
      setHeadersList([])
      setAuthConfig({ type: 'none' })
    }
  }, [selectedEnv])

  const usesTokenEndpoint =
    authConfig.type === 'basic' && Boolean(authConfig.tokenUrl?.trim())

  const tokenExpiryInfo = useMemo(
    () => (usesTokenEndpoint ? getOAuthTokenExpiryInfo(authConfig, tokenExpiryNow) : null),
    [authConfig, tokenExpiryNow, usesTokenEndpoint]
  )

  const tokenExpiryDisplay = useMemo(
    () => (tokenExpiryInfo ? formatOAuthTokenExpiryDisplay(tokenExpiryInfo) : null),
    [tokenExpiryInfo]
  )

  useEffect(() => {
    if (!usesTokenEndpoint) return
    if (tokenExpiryInfo?.kind !== 'active' && tokenExpiryInfo?.kind !== 'expired') return

    const timer = window.setInterval(() => {
      setTokenExpiryNow(Date.now())
    }, 1000)

    return () => window.clearInterval(timer)
  }, [usesTokenEndpoint, tokenExpiryInfo?.kind])

  // Refresh selected environment when environments change in store
  useEffect(() => {
    if (selectedEnv) {
      const updated = environments.find((e) => e.id === selectedEnv.id)
      if (updated) {
        setSelectedEnv(updated)
      } else {
        setSelectedEnv(environments[0] || null)
      }
    } else if (environments.length > 0) {
      setSelectedEnv(environments[0])
    }
  }, [environments])

  const handleCreateEnv = async (): Promise<void> => {
    if (!newEnvName.trim() || !activeProjectId) return
    const newId = crypto.randomUUID()
    await saveEnvironment({
      id: newId,
      projectId: activeProjectId,
      name: newEnvName.trim(),
      type: newEnvType,
      baseUrl: '',
      variables: {},
      defaultHeaders: [],
      authConfig: { type: 'none' },
      isActive: environments.length === 0,
    })
    setNewEnvName('')
    setNewEnvType('Custom')
    setOpenAddModal(false)
  }

  const handleConfirmDeleteEnvironment = async (): Promise<void> => {
    if (!deleteConfirmEnvId) return
    if (selectedEnv?.id === deleteConfirmEnvId) {
      setSelectedEnv(null)
    }
    await deleteEnvironment(deleteConfirmEnvId)
    setDeleteConfirmEnvId(null)
  }

  const handleSaveEnvironment = async (): Promise<void> => {
    if (!selectedEnv) return
    const variablesObj: Record<string, string> = {}
    variablesList.forEach((v) => {
      if (v.key.trim()) {
        variablesObj[v.key.trim()] = v.value
      }
    })

    await saveEnvironment({
      id: selectedEnv.id,
      projectId: selectedEnv.projectId,
      name: envName.trim(),
      type: envType,
      baseUrl: envBaseUrl,
      variables: variablesObj,
      defaultHeaders: headersList,
      authConfig,
      isActive: selectedEnv.isActive,
    })
  }

  // Row handlers for key-value lists
  const handleAddVarRow = (): void => setVariablesList([...variablesList, { key: '', value: '' }])
  const handleRemoveVarRow = (index: number): void => {
    const updated = [...variablesList]; updated.splice(index, 1); setVariablesList(updated)
  }
  const handleVarChange = (index: number, field: 'key' | 'value', value: string): void => {
    const updated = [...variablesList]; updated[index][field] = value; setVariablesList(updated)
  }

  const handleAddHeaderRow = (): void => setHeadersList([...headersList, { key: '', value: '', enabled: true }])
  const handleRemoveHeaderRow = (index: number): void => {
    const updated = [...headersList]; updated.splice(index, 1); setHeadersList(updated)
  }
  const handleHeaderChange = (index: number, field: 'key' | 'value', value: string): void => {
    const updated = [...headersList]; updated[index][field] = value; setHeadersList(updated)
  }
  const handleHeaderToggle = (index: number): void => {
    const updated = [...headersList]; updated[index].enabled = !updated[index].enabled; setHeadersList(updated)
  }

  const handleExportAll = async (): Promise<void> => {
    if (!activeProjectId || exporting) return
    setExporting(true)
    setExportNotice(null)
    try {
      const result = await exportConfiguration({ scope: 'environments', projectId: activeProjectId })
      if (result.saved && result.filePath) {
        setExportNotice(`Environments exported to ${result.filePath}`)
      }
    } finally {
      setExporting(false)
    }
  }

  const handleExportEnvironment = async (environmentId: string): Promise<void> => {
    if (exporting) return
    setExporting(true)
    setExportNotice(null)
    try {
      const result = await exportConfiguration({ scope: 'environment', environmentId })
      if (result.saved && result.filePath) {
        setExportNotice(`Environment exported to ${result.filePath}`)
      }
    } finally {
      setExporting(false)
    }
  }

  const handleVerifyToken = async (): Promise<void> => {
    const tokenUrl = authConfig.tokenUrl?.trim()
    const clientId = authConfig.username?.trim()
    const clientSecret = authConfig.password ?? ''

    if (!tokenUrl || !clientId) {
      setTokenVerifyStatus('error')
      setTokenVerifyMessage('Token endpoint URI and client ID are required.')
      return
    }

    setTokenVerifyStatus('loading')
    setTokenVerifyMessage('')

    try {
      const result = await window.api.verifyOAuthToken({
        tokenUrl,
        clientId,
        clientSecret,
      })

      if (result.success && result.accessToken) {
        const updatedAuth = authConfigWithNewToken(authConfig, result.accessToken, result.expiresIn)
        setAuthConfig(updatedAuth)
        setTokenExpiryNow(Date.now())
        setTokenVerifyStatus('success')
        const expiryInfo = getOAuthTokenExpiryInfo(updatedAuth)
        const expiryDisplay = formatOAuthTokenExpiryDisplay(expiryInfo)
        setTokenVerifyMessage(
          result.expiresIn !== undefined
            ? `Access token retrieved successfully. ${expiryDisplay.title}`
            : 'Access token retrieved successfully. Expiry time was not provided by the token endpoint.'
        )
      } else {
        setTokenVerifyStatus('error')
        setTokenVerifyMessage(result.error ?? 'Token verification failed.')
      }
    } catch (error) {
      setTokenVerifyStatus('error')
      setTokenVerifyMessage(getFriendlyMessage(error, 'Token verification failed.'))
    }
  }

  return (
    <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', gap: 4, height: '100%', overflowY: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, mb: 1, color: 'text.primary' }}>
            Environments
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary' }}>
            Manage environment variables (e.g., baseURL, token) for variable interpolation.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button
            variant="outlined"
            startIcon={<FileDownloadOutlinedIcon />}
            onClick={handleExportAll}
            disabled={!activeProjectId || environments.length === 0 || exporting}
          >
            Export All
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setOpenAddModal(true)}
          >
            New Environment
          </Button>
        </Box>
      </Box>

      {exportNotice && (
        <Alert severity="success" onClose={() => setExportNotice(null)}>
          {exportNotice}
        </Alert>
      )}

      {environments.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="body1" sx={{ color: 'text.secondary', mb: 2 }}>
            No environments found for this workspace. Create one to start using variables.
          </Typography>
          <Button variant="outlined" onClick={() => setOpenAddModal(true)}>
            Create Environment
          </Button>
        </Paper>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 2fr' },
            gap: 3,
            height: 'calc(100% - 100px)',
          }}
        >
          {/* List of Envs (Left Sidebar inside page) */}
          <Box sx={{ height: '100%' }}>
            <Paper sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary' }}>
                Environments
              </Typography>
              <Divider />
              <List sx={{ flexGrow: 1, overflowY: 'auto' }}>
                {environments.map((env) => {
                  const isActive = env.id === activeEnvId
                  const isSelected = selectedEnv && env.id === selectedEnv.id
                  return (
                    <ListItem
                      key={env.id}
                      disablePadding
                      secondaryAction={
                        <Box sx={{ display: 'flex', gap: 0.5 }}>
                          <IconButton
                            size="small"
                            disabled={exporting}
                            onClick={() => void handleExportEnvironment(env.id)}
                            sx={{ color: 'text.secondary' }}
                          >
                            <FileDownloadOutlinedIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => setActiveEnvironment(isActive ? null : env.id)}
                            sx={{ color: isActive ? 'success.main' : 'text.secondary' }}
                          >
                            {isActive ? <CheckCircleIcon /> : <CheckCircleOutlinedIcon />}
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => setDeleteConfirmEnvId(env.id)}
                            sx={{ color: 'error.main' }}
                          >
                            <DeleteOutlinedIcon />
                          </IconButton>
                        </Box>
                      }
                      sx={{
                        borderRadius: '8px',
                        mb: 1,
                        bgcolor: isSelected ? 'action.selected' : 'transparent',
                        border: '1px solid',
                        borderColor: isSelected ? 'primary.main' : 'divider',
                      }}
                    >
                      <ListItemButton onClick={() => setSelectedEnv(env)} sx={{ borderRadius: '8px', pr: 10 }}>
                        <ListItemText
                          primary={
                            <Typography variant="body1" sx={{ fontWeight: isSelected ? 700 : 500, color: 'text.primary' }}>
                              {env.name}
                            </Typography>
                          }
                          secondary={
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              {env.type || 'Custom'}
                            </Typography>
                          }
                        />
                      </ListItemButton>
                    </ListItem>
                  )
                })}
              </List>
            </Paper>
          </Box>

          {/* Variables Grid (Right pane) */}
          <Box sx={{ height: '100%' }}>
            {selectedEnv ? (
              <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ p: 3, pb: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary' }}>
                    Configure: {envName}
                  </Typography>
                  <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSaveEnvironment}>
                    Save Changes
                  </Button>
                </Box>

                <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ px: 3, borderBottom: 1, borderColor: 'divider', mt: 2 }}>
                  <Tab label="General" />
                  <Tab label="Variables" />
                  <Tab label="Headers" />
                  <Tab label="Auth" />
                </Tabs>

                <Box sx={{ p: 3, flexGrow: 1, overflowY: 'auto' }}>
                  {activeTab === 0 && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <TextField
                        label="Environment Name"
                        fullWidth
                        value={envName}
                        onChange={(e) => setEnvName(e.target.value)}
                      />
                      <FormControl fullWidth>
                        <InputLabel>Environment Type</InputLabel>
                        <Select
                          value={envType}
                          label="Environment Type"
                          onChange={(e) => setEnvType(e.target.value as any)}
                        >
                          <MenuItem value="DEV">DEV</MenuItem>
                          <MenuItem value="QA">QA</MenuItem>
                          <MenuItem value="UAT">UAT</MenuItem>
                          <MenuItem value="PROD">PROD</MenuItem>
                          <MenuItem value="Custom">Custom</MenuItem>
                        </Select>
                      </FormControl>
                      <TextField
                        label="Base URL"
                        fullWidth
                        placeholder="https://api.example.com"
                        value={envBaseUrl}
                        onChange={(e) => setEnvBaseUrl(e.target.value)}
                        helperText="All relative request paths will be appended to this Base URL."
                      />
                    </Box>
                  )}

                  {activeTab === 1 && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          Variables can be interpolated into requests using <code>{`{{variable}}`}</code> syntax.
                        </Typography>
                        <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={handleAddVarRow}>Add Variable</Button>
                      </Box>
                      {variablesList.map((row, idx) => (
                        <Box key={idx} sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                          <TextField
                            placeholder="Key"
                            value={row.key}
                            onChange={(e) => handleVarChange(idx, 'key', e.target.value)}
                            sx={{ flexGrow: 1 }}
                            size="small"
                          />
                          {isSensitiveKey(row.key) ? (
                            <MaskedSecretField
                              placeholder="Value"
                              value={row.value}
                              onChange={(e) => handleVarChange(idx, 'value', e.target.value)}
                              sx={{ flexGrow: 1 }}
                              size="small"
                            />
                          ) : (
                            <TextField
                              placeholder="Value"
                              value={row.value}
                              onChange={(e) => handleVarChange(idx, 'value', e.target.value)}
                              sx={{ flexGrow: 1 }}
                              size="small"
                            />
                          )}
                          <IconButton onClick={() => handleRemoveVarRow(idx)} sx={{ color: 'error.main' }}>
                            <DeleteOutlinedIcon />
                          </IconButton>
                        </Box>
                      ))}
                    </Box>
                  )}

                  {activeTab === 2 && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          These headers will be automatically injected into every request when this environment is active.
                        </Typography>
                        <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={handleAddHeaderRow}>Add Header</Button>
                      </Box>
                      {headersList.map((row, idx) => (
                        <Box key={idx} sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                          <Checkbox checked={row.enabled} onChange={() => handleHeaderToggle(idx)} />
                          <TextField
                            placeholder="Key"
                            value={row.key}
                            onChange={(e) => handleHeaderChange(idx, 'key', e.target.value)}
                            sx={{ flexGrow: 1 }}
                            size="small"
                          />
                          <TextField
                            placeholder="Value"
                            value={row.value}
                            onChange={(e) => handleHeaderChange(idx, 'value', e.target.value)}
                            sx={{ flexGrow: 1 }}
                            size="small"
                          />
                          <IconButton onClick={() => handleRemoveHeaderRow(idx)} sx={{ color: 'error.main' }}>
                            <DeleteOutlinedIcon />
                          </IconButton>
                        </Box>
                      ))}
                    </Box>
                  )}

                  {activeTab === 3 && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        Configure default authentication to inject into requests for this environment.
                      </Typography>
                      
                      <FormControl fullWidth>
                        <InputLabel>Auth Type</InputLabel>
                        <Select
                          value={authConfig.type}
                          label="Auth Type"
                          onChange={(e) => setAuthConfig({ ...authConfig, type: e.target.value as AuthType })}
                        >
                          <MenuItem value="none">None</MenuItem>
                          <MenuItem value="bearer">Bearer Token</MenuItem>
                          <MenuItem value="basic">Basic Auth</MenuItem>
                          <MenuItem value="apiKey">API Key</MenuItem>
                        </Select>
                      </FormControl>

                      {authConfig.type === 'bearer' && (
                        <MaskedSecretField
                          label="Bearer Token"
                          fullWidth
                          value={authConfig.token || ''}
                          onChange={(e) => setAuthConfig({ ...authConfig, token: e.target.value })}
                        />
                      )}
                      
                      {authConfig.type === 'basic' && (
                        <>
                          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                            Use username and password as client ID and secret for OAuth2 client credentials, or
                            leave the token endpoint empty for standard HTTP Basic authentication.
                          </Typography>
                          <TextField
                            label="Client ID / Username"
                            fullWidth
                            value={authConfig.username || ''}
                            onChange={(e) => {
                              setAuthConfig({ ...authConfig, username: e.target.value })
                              setTokenVerifyStatus('idle')
                              setTokenVerifyMessage('')
                            }}
                          />
                          <MaskedSecretField
                            label="Client Secret / Password"
                            fullWidth
                            value={authConfig.password || ''}
                            onChange={(e) => {
                              setAuthConfig({ ...authConfig, password: e.target.value })
                              setTokenVerifyStatus('idle')
                              setTokenVerifyMessage('')
                            }}
                          />
                          <TextField
                            label="Token Endpoint URI"
                            fullWidth
                            placeholder="https://sts.example.com/oauth2/token"
                            value={authConfig.tokenUrl || ''}
                            onChange={(e) => {
                              setAuthConfig({ ...authConfig, tokenUrl: e.target.value })
                              setTokenVerifyStatus('idle')
                              setTokenVerifyMessage('')
                            }}
                            helperText="Optional. When set, credentials are exchanged for a Bearer token (grant_type=client_credentials)."
                          />
                          {authConfig.tokenUrl?.trim() && (
                            <>
                              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
                                <Button
                                  variant="outlined"
                                  onClick={handleVerifyToken}
                                  disabled={tokenVerifyStatus === 'loading'}
                                  startIcon={
                                    tokenVerifyStatus === 'loading' ? (
                                      <CircularProgress size={16} />
                                    ) : undefined
                                  }
                                >
                                  {tokenVerifyStatus === 'loading' ? 'Verifying…' : 'Verify Token'}
                                </Button>
                              </Box>
                              {tokenExpiryDisplay && (
                                <Alert severity={tokenExpiryDisplay.severity} sx={{ py: 0.5 }}>
                                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                    {tokenExpiryDisplay.title}
                                  </Typography>
                                  {tokenExpiryDisplay.detail && (
                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                                      {tokenExpiryDisplay.detail}
                                    </Typography>
                                  )}
                                  {authConfig.token?.trim() && (
                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                      Save the environment to persist the token.
                                    </Typography>
                                  )}
                                </Alert>
                              )}
                              {tokenVerifyMessage && (
                                <Alert severity={tokenVerifyStatus === 'success' ? 'success' : 'error'}>
                                  {tokenVerifyMessage}
                                </Alert>
                              )}
                            </>
                          )}
                        </>
                      )}

                      {authConfig.type === 'apiKey' && (
                        <>
                          <TextField
                            label="Key (e.g. X-API-KEY)"
                            fullWidth
                            value={authConfig.key || ''}
                            onChange={(e) => setAuthConfig({ ...authConfig, key: e.target.value })}
                          />
                          <MaskedSecretField
                            label="Value"
                            fullWidth
                            value={authConfig.value || ''}
                            onChange={(e) => setAuthConfig({ ...authConfig, value: e.target.value })}
                          />
                          <FormControl fullWidth>
                            <InputLabel>Add To</InputLabel>
                            <Select
                              value={authConfig.addTo || 'header'}
                              label="Add To"
                              onChange={(e) => setAuthConfig({ ...authConfig, addTo: e.target.value as any })}
                            >
                              <MenuItem value="header">Header</MenuItem>
                              <MenuItem value="query">Query Params</MenuItem>
                            </Select>
                          </FormControl>
                        </>
                      )}
                    </Box>
                  )}
                </Box>
              </Paper>
            ) : (
              <Paper sx={{ p: 3, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography variant="body1" sx={{ color: 'text.secondary' }}>
                  Select an environment to view and edit details.
                </Typography>
              </Paper>
            )}
          </Box>
        </Box>
      )}

      {/* Add env dialog */}
      <Dialog open={openAddModal} onClose={() => setOpenAddModal(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>New Environment</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            autoFocus
            label="Environment Name"
            fullWidth
            variant="outlined"
            value={newEnvName}
            onChange={(e) => setNewEnvName(e.target.value)}
            sx={{ mt: 1 }}
          />
          <FormControl fullWidth>
            <InputLabel>Environment Type</InputLabel>
            <Select
              value={newEnvType}
              label="Environment Type"
              onChange={(e) => setNewEnvType(e.target.value as any)}
            >
              <MenuItem value="DEV">DEV</MenuItem>
              <MenuItem value="QA">QA</MenuItem>
              <MenuItem value="UAT">UAT</MenuItem>
              <MenuItem value="PROD">PROD</MenuItem>
              <MenuItem value="Custom">Custom</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setOpenAddModal(false)} sx={{ color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button onClick={handleCreateEnv} variant="contained" disabled={!newEnvName.trim()}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={deleteConfirmEnvId !== null}
        onClose={() => setDeleteConfirmEnvId(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700, color: 'error.main' }}>Delete Environment?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            Are you sure you want to delete{' '}
            <strong>{environments.find((env) => env.id === deleteConfirmEnvId)?.name ?? 'this environment'}</strong>?
            Variables, headers, and auth settings for this environment will be permanently removed.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setDeleteConfirmEnvId(null)} sx={{ color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button onClick={() => void handleConfirmDeleteEnvironment()} variant="contained" color="error">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
