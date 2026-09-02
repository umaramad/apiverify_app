/**
 * Settings panel for enabling/disabling this module, history size, and portable targets.
 * Targets: one app + server + username with multiple App Log paths.
 * pathId is auto-generated offline (not shown); edit via modal.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined'
import {
  createEmptyLinuxSearchPathEntry,
  createEmptyLinuxSearchTargetConfig,
  DEFAULT_RECENT_ACTIONS_HISTORY_SIZE,
  MAX_RECENT_ACTIONS_HISTORY_SIZE,
  MIN_RECENT_ACTIONS_HISTORY_SIZE,
  type LinuxSearchAssistantConfigDocument,
  type LinuxSearchPathEntry,
  type LinuxSearchTargetConfig,
  type RecentActionsPreferences,
} from '../../models'
import { useLinuxSearchAssistantStatus } from '../hooks/useLinuxSearch'

function newId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

/** Stable offline path id — never shown in UI; preserved on edit when possible. */
function newPathId(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 24)
  return `log_${slug || 'path'}_${newId().slice(0, 8)}`
}

interface LogPathDraft {
  /** Existing id kept on edit so Recent Actions pathId still resolves. */
  id?: string
  label: string
  path: string
}

interface TargetDraft {
  applicationName: string
  serverName: string
  hostNameOrIp: string
  username: string
  sshPort: string
  logPaths: LogPathDraft[]
}

function emptyDraft(): TargetDraft {
  return {
    applicationName: '',
    serverName: '',
    hostNameOrIp: '',
    username: '',
    sshPort: '22',
    logPaths: [{ label: 'App logs', path: '/var/log/app' }],
  }
}

function draftFromTarget(target: LinuxSearchTargetConfig): TargetDraft {
  const logs =
    target.logPaths.length > 0
      ? target.logPaths.map((p) => ({ id: p.id, label: p.label, path: p.path }))
      : [{ label: 'App logs', path: '' }]
  return {
    applicationName: target.applicationName || '',
    serverName: target.serverName || '',
    hostNameOrIp: target.hostNameOrIp || '',
    username: target.username || '',
    sshPort: String(target.sshPort || 22),
    logPaths: logs,
  }
}

function toPathEntries(drafts: LogPathDraft[]): LinuxSearchPathEntry[] {
  return drafts
    .map((row) => {
      const label = row.label.trim() || 'App logs'
      const path = row.path.trim()
      if (!path) return null
      return createEmptyLinuxSearchPathEntry({
        id: row.id?.trim() || newPathId(label),
        label,
        path,
        enabled: true,
      })
    })
    .filter((p): p is LinuxSearchPathEntry => Boolean(p))
}

function LinuxSearchAssistantEnabledSettings(): React.JSX.Element {
  const [historySizeInput, setHistorySizeInput] = useState(String(DEFAULT_RECENT_ACTIONS_HISTORY_SIZE))
  const [config, setConfig] = useState<LinuxSearchAssistantConfigDocument | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<TargetDraft>(emptyDraft)
  const [modalError, setModalError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const importInputRef = useRef<HTMLInputElement>(null)

  const refresh = useCallback(async () => {
    setError(null)
    try {
      const [prefs, nextConfig] = await Promise.all([
        window.api.linuxSearchAssistantGetRecentActionsPrefs() as Promise<RecentActionsPreferences>,
        window.api.linuxSearchAssistantGetConfig() as Promise<LinuxSearchAssistantConfigDocument>,
      ])
      setHistorySizeInput(String(prefs.historySize ?? DEFAULT_RECENT_ACTIONS_HISTORY_SIZE))
      setConfig(nextConfig)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load module settings.')
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const handleSaveHistorySize = async (): Promise<void> => {
    const n = Number(historySizeInput)
    await window.api.linuxSearchAssistantSetRecentActionsHistorySize(n)
    setSaveMessage(
      `History size set to ${Math.min(
        Math.max(Math.trunc(n) || DEFAULT_RECENT_ACTIONS_HISTORY_SIZE, MIN_RECENT_ACTIONS_HISTORY_SIZE),
        MAX_RECENT_ACTIONS_HISTORY_SIZE
      )}.`
    )
    await refresh()
  }

  const openAddModal = (): void => {
    setEditingId(null)
    setDraft(emptyDraft())
    setModalError(null)
    setModalOpen(true)
  }

  const openEditModal = (target: LinuxSearchTargetConfig): void => {
    setEditingId(target.id)
    setDraft(draftFromTarget(target))
    setModalError(null)
    setModalOpen(true)
  }

  const closeModal = (): void => {
    setModalOpen(false)
    setEditingId(null)
    setModalError(null)
    setDraft(emptyDraft())
  }

  const updateLogPath = (index: number, patch: Partial<LogPathDraft>): void => {
    setDraft((d) => ({
      ...d,
      logPaths: d.logPaths.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    }))
  }

  const addLogPathRow = (): void => {
    setDraft((d) => ({
      ...d,
      logPaths: [...d.logPaths, { label: `App logs ${d.logPaths.length + 1}`, path: '' }],
    }))
  }

  const removeLogPathRow = (index: number): void => {
    setDraft((d) => ({
      ...d,
      logPaths: d.logPaths.length <= 1 ? d.logPaths : d.logPaths.filter((_, i) => i !== index),
    }))
  }

  const handleSaveTarget = async (): Promise<void> => {
    if (!config) return
    const host = draft.hostNameOrIp.trim()
    const username = draft.username.trim()
    const logPaths = toPathEntries(draft.logPaths)
    if (!host || !username) {
      setModalError('Host / IP and Username are required.')
      return
    }
    if (logPaths.some((p) => !p.path.startsWith('/'))) {
      setModalError('Each App Log path must be an absolute path starting with /.')
      return
    }
    if (logPaths.length === 0) {
      setModalError('Add at least one App Log with an absolute path.')
      return
    }

    setSaving(true)
    setModalError(null)
    try {
      const now = new Date().toISOString()
      let nextTargets: LinuxSearchTargetConfig[]
      if (editingId) {
        const existing = config.targets.find((t) => t.id === editingId)
        if (!existing) {
          setModalError('Target not found.')
          return
        }
        const updated = createEmptyLinuxSearchTargetConfig({
          ...existing,
          applicationName: draft.applicationName.trim() || 'Application',
          serverName: draft.serverName.trim() || host,
          hostNameOrIp: host,
          username,
          sshPort: Number(draft.sshPort) || 22,
          applicationHome: existing.applicationHome || '/',
          logPaths,
          configPaths: existing.configPaths || [],
          searchPaths: existing.searchPaths || [],
          createdAt: existing.createdAt,
          updatedAt: now,
        })
        nextTargets = config.targets.map((t) => (t.id === editingId ? updated : t))
      } else {
        const target = createEmptyLinuxSearchTargetConfig({
          id: newId(),
          applicationName: draft.applicationName.trim() || 'Application',
          serverName: draft.serverName.trim() || host,
          hostNameOrIp: host,
          username,
          sshPort: Number(draft.sshPort) || 22,
          applicationHome: '/',
          logPaths,
          configPaths: [],
          searchPaths: [],
        })
        nextTargets = [...config.targets, target]
      }

      const saved = await window.api.linuxSearchAssistantSaveConfig({
        schemaVersion: 1,
        targets: nextTargets,
      })
      setConfig(saved)
      setSaveMessage(
        editingId
          ? `Updated application “${draft.applicationName.trim() || 'Application'}”.`
          : `Added application “${draft.applicationName.trim() || 'Application'}”.`
      )
      closeModal()
    } catch (err) {
      setModalError(err instanceof Error ? err.message : 'Could not save target.')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteTarget = async (targetId: string): Promise<void> => {
    if (!config) return
    const target = config.targets.find((t) => t.id === targetId)
    if (!target) return
    if (!window.confirm(`Remove application “${target.applicationName || target.id}”?`)) return
    const saved = await window.api.linuxSearchAssistantSaveConfig({
      schemaVersion: 1,
      targets: config.targets.filter((t) => t.id !== targetId),
    })
    setConfig(saved)
    setSaveMessage(`Removed “${target.applicationName || target.id}”.`)
  }

  const handleExportConfig = (): void => {
    if (!config) return
    setError(null)
    try {
      const payload: LinuxSearchAssistantConfigDocument = {
        schemaVersion: 1,
        targets: config.targets,
      }
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const stamp = new Date().toISOString().slice(0, 10)
      a.href = url
      a.download = `linux-search-assistant-config-${stamp}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setSaveMessage('Exported Linux Search Assistant config (no passwords).')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed.')
    }
  }

  const handleImportConfig = async (file: File): Promise<void> => {
    setError(null)
    setSaveMessage(null)
    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as unknown
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Invalid JSON: expected a config object.')
      }
      const raw = parsed as Record<string, unknown>
      // Accept either full document { schemaVersion, targets } or a bare targets array.
      const document: LinuxSearchAssistantConfigDocument = Array.isArray(parsed)
        ? { schemaVersion: 1, targets: parsed as LinuxSearchTargetConfig[] }
        : {
            schemaVersion: 1,
            targets: Array.isArray(raw.targets) ? (raw.targets as LinuxSearchTargetConfig[]) : [],
          }
      if (document.targets.length === 0) {
        throw new Error('Import file has no application targets.')
      }
      const saved = await window.api.linuxSearchAssistantSaveConfig(document)
      setConfig(saved)
      setSaveMessage(
        `Imported ${saved.targets.length} application target${saved.targets.length === 1 ? '' : 's'} (replaced previous list).`
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.')
    } finally {
      if (importInputRef.current) importInputRef.current.value = ''
    }
  }

  return (
    <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
        Recent Actions history size
      </Typography>
      <Typography variant="caption" color="text.secondary">
        Default {DEFAULT_RECENT_ACTIONS_HISTORY_SIZE}. Pinned favorites never expire. Oldest unpinned entries are
        removed automatically.
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <TextField
          size="small"
          type="number"
          label="History size"
          value={historySizeInput}
          onChange={(e) => setHistorySizeInput(e.target.value)}
          slotProps={{
            htmlInput: {
              min: MIN_RECENT_ACTIONS_HISTORY_SIZE,
              max: MAX_RECENT_ACTIONS_HISTORY_SIZE,
            },
          }}
          sx={{ width: 160 }}
        />
        <Button variant="outlined" onClick={() => void handleSaveHistorySize()}>
          Save
        </Button>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mt: 1 }}>
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Application targets
          </Typography>
          <Typography variant="caption" color="text.secondary" component="div">
            One application + server + username, with multiple App Log paths. Path ids are generated offline and used
            only for Recent Actions replay (not shown here). Export/import JSON to move configs between machines (no
            passwords).
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 0.75, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleImportConfig(file)
            }}
          />
          <Button
            variant="outlined"
            size="small"
            startIcon={<FileUploadOutlinedIcon />}
            onClick={() => importInputRef.current?.click()}
          >
            Import
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<FileDownloadOutlinedIcon />}
            disabled={!config || config.targets.length === 0}
            onClick={handleExportConfig}
          >
            Export
          </Button>
          <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openAddModal}>
            Add
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      {(config?.targets.length ?? 0) === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No applications configured yet. Click Add to create one.
        </Typography>
      ) : (
        <List dense disablePadding sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
          {config!.targets.map((target) => (
            <ListItem
              key={target.id}
              divider
              secondaryAction={
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Tooltip title="Edit">
                    <IconButton edge="end" aria-label="Edit target" onClick={() => openEditModal(target)}>
                      <EditOutlinedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Remove">
                    <IconButton
                      edge="end"
                      aria-label="Remove target"
                      onClick={() => void handleDeleteTarget(target.id)}
                    >
                      <DeleteOutlineOutlinedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              }
              sx={{ pr: 10 }}
            >
              <ListItemText
                primary={target.applicationName || target.id}
                secondary={`${target.username}@${target.hostNameOrIp} · ${target.logPaths.length} log path${
                  target.logPaths.length === 1 ? '' : 's'
                }`}
              />
            </ListItem>
          ))}
        </List>
      )}

      {saveMessage && (
        <Alert severity="success" onClose={() => setSaveMessage(null)}>
          {saveMessage}
        </Alert>
      )}

      <Dialog open={modalOpen} onClose={closeModal} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {editingId ? 'Edit application target' : 'Add application target'}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '12px !important' }}>
          <Typography variant="caption" color="text.secondary">
            Portable config only — no passwords. SSH password is requested when you Connect.
          </Typography>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
            <TextField
              size="small"
              label="Application"
              value={draft.applicationName}
              onChange={(e) => setDraft((d) => ({ ...d, applicationName: e.target.value }))}
              fullWidth
            />
            <TextField
              size="small"
              label="Server name"
              value={draft.serverName}
              onChange={(e) => setDraft((d) => ({ ...d, serverName: e.target.value }))}
              fullWidth
            />
            <TextField
              size="small"
              label="Host / IP"
              value={draft.hostNameOrIp}
              onChange={(e) => setDraft((d) => ({ ...d, hostNameOrIp: e.target.value }))}
              fullWidth
              required
            />
            <TextField
              size="small"
              label="Username"
              value={draft.username}
              onChange={(e) => setDraft((d) => ({ ...d, username: e.target.value }))}
              fullWidth
              required
            />
            <TextField
              size="small"
              label="SSH port"
              type="number"
              value={draft.sshPort}
              onChange={(e) => setDraft((d) => ({ ...d, sshPort: e.target.value }))}
              sx={{ maxWidth: 140 }}
            />
          </Box>

          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                App Logs
              </Typography>
              <Button size="small" startIcon={<AddIcon />} onClick={addLogPathRow}>
                Add log path
              </Button>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {draft.logPaths.map((row, index) => (
                <Box
                  key={row.id || `new-${index}`}
                  sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'flex-start' }}
                >
                  <TextField
                    size="small"
                    label="Label"
                    value={row.label}
                    onChange={(e) => updateLogPath(index, { label: e.target.value })}
                    sx={{ flex: '1 1 120px', minWidth: 120 }}
                  />
                  <TextField
                    size="small"
                    label="Absolute path"
                    value={row.path}
                    onChange={(e) => updateLogPath(index, { path: e.target.value })}
                    placeholder="/var/log/myapp"
                    sx={{ flex: '2 1 200px', minWidth: 180 }}
                  />
                  <IconButton
                    size="small"
                    aria-label="Remove log path"
                    onClick={() => removeLogPathRow(index)}
                    disabled={draft.logPaths.length <= 1}
                    sx={{ mt: 0.5 }}
                  >
                    <DeleteOutlineOutlinedIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}
            </Box>
          </Box>

          {modalError && <Alert severity="error">{modalError}</Alert>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeModal} disabled={saving}>
            Cancel
          </Button>
          <Button variant="contained" onClick={() => void handleSaveTarget()} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default function LinuxSearchAssistantSettingsPanel(): React.JSX.Element {
  const { status, loading, setEnabled } = useLinuxSearchAssistantStatus()
  const envLocked = status?.source === 'env'

  return (
    <Box>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
        Offline Linux command search plus optional remote logical actions. Disable to hide the sidebar entry and block
        module IPC.
      </Typography>
      {envLocked && (
        <Alert severity="info" sx={{ mb: 1.5 }}>
          Controlled by the LINUX_SEARCH_ASSISTANT environment variable (settings toggle is ignored while set).
        </Alert>
      )}
      <FormControlLabel
        control={
          <Switch
            checked={Boolean(status?.enabled)}
            disabled={loading || envLocked}
            onChange={(_, checked) => void setEnabled(checked)}
          />
        }
        label={status?.enabled ? 'Enabled' : 'Disabled'}
      />

      {status?.enabled ? <LinuxSearchAssistantEnabledSettings /> : null}
    </Box>
  )
}
