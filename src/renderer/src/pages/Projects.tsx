import React, { useState } from 'react'
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
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import { useAppStore } from '../store/app.store'
import { useShallow } from 'zustand/react/shallow'

export default function Projects(): React.JSX.Element {
  const {
    projects,
    activeProjectId,
    currentUser,
    selectProject,
    createProject,
    updateProject,
    deleteProject,
    exportConfiguration,
  } = useAppStore(
    useShallow((s) => ({
      projects: s.projects,
      activeProjectId: s.activeProjectId,
      currentUser: s.currentUser,
      selectProject: s.selectProject,
      createProject: s.createProject,
      updateProject: s.updateProject,
      deleteProject: s.deleteProject,
      exportConfiguration: s.exportConfiguration,
    }))
  )

  const [openAddModal, setOpenAddModal] = useState(false)
  const [newProjName, setNewProjName] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [exportNotice, setExportNotice] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  
  const [openEditModal, setOpenEditModal] = useState(false)
  const [editProjId, setEditProjId] = useState('')
  const [editProjName, setEditProjName] = useState('')

  const handleCreate = async (): Promise<void> => {
    if (!newProjName.trim()) return
    await createProject(newProjName.trim())
    setNewProjName('')
    setOpenAddModal(false)
  }

  const handleUpdate = async (): Promise<void> => {
    if (!editProjName.trim() || !editProjId) return
    await updateProject(editProjId, editProjName.trim())
    setEditProjId('')
    setEditProjName('')
    setOpenEditModal(false)
  }

  const handleDeleteConfirm = async (): Promise<void> => {
    if (!deleteConfirmId) return
    await deleteProject(deleteConfirmId)
    setDeleteConfirmId(null)
  }

  const handleExportAll = async (): Promise<void> => {
    if (!currentUser || exporting) return
    setExporting(true)
    setExportNotice(null)
    try {
      const result = await exportConfiguration({ scope: 'all-workspaces', userId: currentUser.id })
      if (result.saved && result.filePath) {
        setExportNotice(`All workspaces exported to ${result.filePath}`)
      }
    } finally {
      setExporting(false)
    }
  }

  const handleExportWorkspace = async (projectId: string): Promise<void> => {
    if (exporting) return
    setExporting(true)
    setExportNotice(null)
    try {
      const result = await exportConfiguration({ scope: 'workspace', projectId })
      if (result.saved && result.filePath) {
        setExportNotice(`Workspace exported to ${result.filePath}`)
      }
    } finally {
      setExporting(false)
    }
  }

  return (
    <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', gap: 4, height: '100%', overflowY: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, mb: 1, color: 'text.primary' }}>
            Workspaces
          </Typography>
          <Typography variant="body1" sx={{ color: 'text.secondary' }}>
            Configure and switch between isolated workspaces/projects.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button
            variant="outlined"
            startIcon={<FileDownloadOutlinedIcon />}
            onClick={handleExportAll}
            disabled={!currentUser || projects.length === 0 || exporting}
            sx={{ py: 1 }}
          >
            Export All
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setOpenAddModal(true)}
            sx={{ py: 1 }}
          >
            New Workspace
          </Button>
        </Box>
      </Box>

      {exportNotice && (
        <Alert severity="success" onClose={() => setExportNotice(null)}>
          {exportNotice}
        </Alert>
      )}

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: 'text.primary' }}>
          All Workspaces
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <List>
          {projects.map((proj) => {
            const isActive = proj.id === activeProjectId
            return (
              <React.Fragment key={proj.id}>
                <ListItem
                  secondaryAction={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {isActive && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mr: 1, color: 'success.main' }}>
                          <CheckCircleIcon fontSize="small" />
                          <Typography variant="caption" sx={{ fontWeight: 700 }}>Active</Typography>
                        </Box>
                      )}
                      <IconButton
                        edge="end"
                        aria-label="export workspace"
                        disabled={exporting}
                        onClick={(e) => {
                          e.stopPropagation()
                          void handleExportWorkspace(proj.id)
                        }}
                        sx={{
                          color: 'text.secondary',
                          '&:hover': {
                            backgroundColor: 'action.hover',
                            color: 'primary.main',
                          },
                        }}
                      >
                        <FileDownloadOutlinedIcon />
                      </IconButton>
                      <IconButton
                        edge="end"
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditProjId(proj.id)
                          setEditProjName(proj.name)
                          setOpenEditModal(true)
                        }}
                        sx={{
                          color: 'text.secondary',
                          '&:hover': {
                            backgroundColor: 'action.hover',
                            color: 'primary.main',
                          },
                        }}
                      >
                        <EditOutlinedIcon />
                      </IconButton>
                      <IconButton
                        edge="end"
                        aria-label="delete"
                        disabled={projects.length <= 1}
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeleteConfirmId(proj.id)
                        }}
                        sx={{
                          color: 'error.main',
                          '&:hover': {
                            backgroundColor: 'action.hover',
                          },
                        }}
                      >
                        <DeleteOutlinedIcon />
                      </IconButton>
                    </Box>
                  }
                  disablePadding
                  sx={{
                    borderRadius: '8px',
                    mb: 1,
                    bgcolor: isActive ? 'action.selected' : 'transparent',
                    border: '1px solid',
                    borderColor: isActive ? 'primary.main' : 'divider',
                  }}
                >
                  <ListItemButton onClick={() => selectProject(proj.id)} sx={{ borderRadius: '8px' }}>
                    <ListItemText
                      primary={
                        <Typography variant="body1" sx={{ fontWeight: isActive ? 700 : 500, color: 'text.primary' }}>
                          {proj.name}
                        </Typography>
                      }
                      secondary={
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          ID: {proj.id}
                        </Typography>
                      }
                    />
                  </ListItemButton>
                </ListItem>
              </React.Fragment>
            )
          })}
        </List>
      </Paper>

      {/* Create project dialog */}
      <Dialog open={openAddModal} onClose={() => setOpenAddModal(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>New Workspace</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Workspace Name"
            fullWidth
            variant="outlined"
            value={newProjName}
            onChange={(e) => setNewProjName(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setOpenAddModal(false)} sx={{ color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button onClick={handleCreate} variant="contained" disabled={!newProjName.trim()}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit project dialog */}
      <Dialog open={openEditModal} onClose={() => setOpenEditModal(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Rename Workspace</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Workspace Name"
            fullWidth
            variant="outlined"
            value={editProjName}
            onChange={(e) => setEditProjName(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setOpenEditModal(false)} sx={{ color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button onClick={handleUpdate} variant="contained" disabled={!editProjName.trim()}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteConfirmId !== null} onClose={() => setDeleteConfirmId(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: 'error.main' }}>Delete Workspace?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'text.primary' }}>
            Are you sure you want to delete this workspace? This will permanently delete all associated OpenAPI specs, environment variables, and history runs. This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setDeleteConfirmId(null)} sx={{ color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button onClick={handleDeleteConfirm} variant="contained" color="error">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
