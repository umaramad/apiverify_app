import React, { useState } from 'react'
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import SettingsIcon from '@mui/icons-material/Settings'
import { useAppStore } from '../store/app.store'

export default React.memo(function EnvSelector(): React.JSX.Element {
  const environments = useAppStore((s) => s.environments)
  const activeEnvId = useAppStore((s) => s.activeEnvId)
  const activeProjectId = useAppStore((s) => s.activeProjectId)
  const saveEnvironment = useAppStore((s) => s.saveEnvironment)
  const deleteEnvironment = useAppStore((s) => s.deleteEnvironment)
  const setActiveEnvironment = useAppStore((s) => s.setActiveEnvironment)

  const [open, setOpen] = useState(false)
  const [editingEnv, setEditingEnv] = useState<{ id?: string; name: string; variables: string } | null>(null)
  const [deleteConfirmEnvId, setDeleteConfirmEnvId] = useState<string | null>(null)

  const handleOpen = (): void => setOpen(true)
  const handleClose = (): void => {
    setOpen(false)
    setEditingEnv(null)
  }

  const handleConfirmDeleteEnvironment = async (): Promise<void> => {
    if (!deleteConfirmEnvId) return
    await deleteEnvironment(deleteConfirmEnvId)
    setDeleteConfirmEnvId(null)
  }

  const startEdit = (env: { id: string; name: string; variables: string }): void => {
    setEditingEnv(env)
  }

  const startCreate = (): void => {
    setEditingEnv({ name: '', variables: '{\n  "baseUrl": "https://api.example.com"\n}' })
  }

  const handleSave = async (): Promise<void> => {
    if (!editingEnv) return

    let parsed: any = null
    // Simple JSON validation
    try {
      parsed = JSON.parse(editingEnv.variables)
    } catch (e: any) {
      alert(`Invalid JSON: ${e.message}`)
      return
    }

    const env = environments.find((e) => e.id === editingEnv.id) || ({} as any)
    const id = editingEnv.id || crypto.randomUUID()
    await saveEnvironment({
      id: id,
      projectId: env.projectId || activeProjectId || '',
      name: editingEnv.name,
      variables: parsed,
      isActive: env.isActive || (activeEnvId === id),
      type: env.type || 'Custom',
      baseUrl: env.baseUrl || '',
      defaultHeaders: env.defaultHeaders || [],
      authConfig: env.authConfig || { type: 'inherit' }
    })

    setEditingEnv(null)
  }

    return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600 }}>
        Environment:
      </Typography>
      <Select
        value={activeEnvId || 'none'}
        onChange={(e) => {
          const val = e.target.value
          setActiveEnvironment(val === 'none' ? null : val)
        }}
        sx={{
          minWidth: 150,
          height: 36,
          backgroundColor: 'background.paper',
          fontSize: '0.875rem',
          '.MuiOutlinedInput-notchedOutline': {
            borderColor: 'divider',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: 'primary.main',
          },
        }}
      >
        <MenuItem value="none">No Environment</MenuItem>
        {environments.map((env) => (
          <MenuItem key={env.id} value={env.id}>
            {env.name}
          </MenuItem>
        ))}
      </Select>

      <IconButton
        onClick={handleOpen}
        size="small"
        sx={{
          color: 'text.secondary',
          '&:hover': {
            color: 'primary.main',
          },
        }}
      >
        <SettingsIcon fontSize="small" />
      </IconButton>

      {/* Environments Management Modal */}
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ color: 'text.primary', fontWeight: 700 }}>Manage Environments</DialogTitle>
        <DialogContent dividers>
          {editingEnv ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
              <TextField
                label="Environment Name"
                value={editingEnv.name}
                onChange={(e) => setEditingEnv({ ...editingEnv, name: e.target.value })}
                fullWidth
                required
              />
              <TextField
                label="Variables (JSON format)"
                value={editingEnv.variables}
                onChange={(e) => setEditingEnv({ ...editingEnv, variables: e.target.value })}
                multiline
                rows={8}
                fullWidth
                required
                helperText="Use format: {{varName}} in URLs and headers. Write standard JSON, e.g., { 'baseUrl': '...' }"
                sx={{
                  '& .MuiInputBase-input': {
                    fontFamily: 'monospace',
                    fontSize: '0.85rem',
                  },
                }}
              />
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                <Button size="small" onClick={() => setEditingEnv(null)} sx={{ color: 'text.secondary' }}>
                  Cancel
                </Button>
                <Button size="small" variant="contained" onClick={handleSave} sx={{ bgcolor: 'primary.main' }}>
                  Save
                </Button>
              </Box>
            </Box>
          ) : (
            <Box>
              <Button
                startIcon={<AddIcon />}
                onClick={startCreate}
                variant="outlined"
                sx={{
                  mb: 2,
                  borderColor: 'primary.main',
                  color: 'primary.main',
                  '&:hover': {
                    borderColor: 'primary.main',
                    backgroundColor: 'action.hover',
                  },
                }}
              >
                Add Environment
              </Button>
              {environments.length === 0 ? (
                <Typography variant="body2" sx={{ color: 'text.secondary', py: 2, textAlign: 'center' }}>
                  No environments configured yet.
                </Typography>
              ) : (
                <List>
                  {environments.map((env) => (
                    <ListItem
                      key={env.id}
                      secondaryAction={
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <IconButton size="small" onClick={() => startEdit({ ...env, variables: typeof env.variables === 'string' ? env.variables : JSON.stringify(env.variables, null, 2) })} sx={{ color: 'text.secondary' }}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => setDeleteConfirmEnvId(env.id)}
                            sx={{
                              color: 'error.main',
                              '&:hover': {
                                color: 'error.main',
                                backgroundColor: 'action.hover',
                              },
                            }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      }
                      sx={{ borderBottom: '1px solid', borderColor: 'divider' }}
                    >
                      <ListItemText
                        primary={
                          <Typography sx={{ color: 'text.primary', fontWeight: 500 }}>
                            {env.name}
                          </Typography>
                        }
                        secondary={
                          <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem' }}>
                            {`${Object.keys((typeof env.variables === 'string' ? JSON.parse(env.variables) : env.variables) || {}).length} variables`}
                          </Typography>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} sx={{ color: 'text.secondary' }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={deleteConfirmEnvId !== null}
        onClose={() => setDeleteConfirmEnvId(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ color: 'text.primary', fontWeight: 700 }}>Delete Environment?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Are you sure you want to delete{' '}
            <strong>{environments.find((env) => env.id === deleteConfirmEnvId)?.name ?? 'this environment'}</strong>?
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
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
})
