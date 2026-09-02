/**
 * Settings → Feature Modules → Ask AI (LLM + multi MCP servers).
 */
import React, { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import ScienceOutlinedIcon from '@mui/icons-material/ScienceOutlined'
import MaskedSecretField from '../../../../renderer/src/components/MaskedSecretField'
import {
  createEmptyMcpServer,
  type AskAiConfig,
  type AskAiMcpServerConfig,
  type AskAiMode,
} from '../../models'
import { useAskAiConfig } from '../hooks/useAskAiConfig'

export default function AskAiSettingsPanel(): React.JSX.Element {
  const { config, loading, error, refresh, save } = useAskAiConfig()
  const [draft, setDraft] = useState<AskAiConfig>(config)
  const [saving, setSaving] = useState(false)
  const [testMsg, setTestMsg] = useState<string | null>(null)
  const [testError, setTestError] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)
  const [mcpDialogOpen, setMcpDialogOpen] = useState(false)
  const [mcpDraft, setMcpDraft] = useState<AskAiMcpServerConfig | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    setDraft(config)
  }, [config])

  const persist = async (next: AskAiConfig): Promise<void> => {
    setSaving(true)
    setSaveError(null)
    try {
      await save(next)
      setDraft(next)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save Ask AI settings.')
    } finally {
      setSaving(false)
    }
  }

  const openAddMcp = (): void => {
    setMcpDraft(createEmptyMcpServer())
    setMcpDialogOpen(true)
  }

  const openEditMcp = (server: AskAiMcpServerConfig): void => {
    setMcpDraft({ ...server })
    setMcpDialogOpen(true)
  }

  const saveMcpDraft = async (): Promise<void> => {
    if (!mcpDraft || !mcpDraft.url.trim() || !mcpDraft.name.trim()) return
    const existingIdx = draft.mcpServers.findIndex((s) => s.id === mcpDraft.id)
    const mcpServers =
      existingIdx >= 0
        ? draft.mcpServers.map((s, i) => (i === existingIdx ? mcpDraft : s))
        : [...draft.mcpServers, mcpDraft]
    await persist({ ...draft, mcpServers })
    setMcpDialogOpen(false)
    setMcpDraft(null)
  }

  const removeMcp = async (id: string): Promise<void> => {
    await persist({
      ...draft,
      mcpServers: draft.mcpServers.filter((s) => s.id !== id),
      lastMcpServerId: draft.lastMcpServerId === id ? undefined : draft.lastMcpServerId,
    })
  }

  const testLlm = async (): Promise<void> => {
    setTesting(true)
    setTestMsg(null)
    setTestError(null)
    try {
      await persist(draft)
      const result = await window.api.linuxSearchAssistantTestAskAiLlm()
      if (result.ok) setTestMsg(result.message)
      else setTestError(result.message)
    } catch (err) {
      setTestError(err instanceof Error ? err.message : 'LLM test failed.')
    } finally {
      setTesting(false)
    }
  }

  const testMcp = async (serverId: string): Promise<void> => {
    setTesting(true)
    setTestMsg(null)
    setTestError(null)
    try {
      await persist(draft)
      const result = await window.api.linuxSearchAssistantTestAskAiMcp(serverId)
      if (result.ok) setTestMsg(result.message)
      else setTestError(result.message)
    } catch (err) {
      setTestError(err instanceof Error ? err.message : 'MCP test failed.')
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
        <CircularProgress size={22} />
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
        <Box>
          <Typography variant="body1" sx={{ fontWeight: 600 }}>
            Ask AI / Send to MCP
          </Typography>
          <Typography variant="body2" color="text.secondary">
            When enabled, Linux Search Assistant Output shows Ask AI. Configure an LLM and/or multiple MCP
            servers, then pick one at analysis time.
          </Typography>
        </Box>
        <FormControlLabel
          control={
            <Switch
              checked={draft.enabled}
              onChange={(e) => {
                const next = { ...draft, enabled: e.target.checked }
                setDraft(next)
                void persist(next)
              }}
              color="primary"
            />
          }
          label={draft.enabled ? 'Enabled' : 'Disabled'}
          sx={{ mr: 0, flexShrink: 0 }}
        />
      </Box>

      {(error || saveError) && <Alert severity="error">{error || saveError}</Alert>}
      {testMsg && (
        <Alert severity="success" onClose={() => setTestMsg(null)}>
          {testMsg}
        </Alert>
      )}
      {testError && (
        <Alert severity="warning" onClose={() => setTestError(null)}>
          {testError}
        </Alert>
      )}

      <FormControl size="small" sx={{ maxWidth: 280 }} disabled={!draft.enabled}>
        <InputLabel id="ask-ai-mode-label">Default mode</InputLabel>
        <Select
          labelId="ask-ai-mode-label"
          label="Default mode"
          value={draft.mode}
          onChange={(e) => setDraft({ ...draft, mode: e.target.value as AskAiMode })}
        >
          <MenuItem value="llm">LLM (OpenAI-compatible)</MenuItem>
          <MenuItem value="mcp">MCP server</MenuItem>
        </Select>
      </FormControl>

      <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 1 }}>
        LLM
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25 }}>
        <TextField
          size="small"
          label="Base URL"
          value={draft.llm.baseUrl}
          disabled={!draft.enabled}
          onChange={(e) => setDraft({ ...draft, llm: { ...draft.llm, baseUrl: e.target.value } })}
          sx={{ flex: '1 1 220px' }}
          helperText="e.g. https://api.openai.com/v1 or http://localhost:11434/v1"
        />
        <TextField
          size="small"
          label="Model"
          value={draft.llm.model}
          disabled={!draft.enabled}
          onChange={(e) => setDraft({ ...draft, llm: { ...draft.llm, model: e.target.value } })}
          sx={{ flex: '1 1 160px' }}
        />
        <MaskedSecretField
          size="small"
          label="API key (optional)"
          value={draft.llm.apiKey}
          disabled={!draft.enabled}
          onChange={(e) => setDraft({ ...draft, llm: { ...draft.llm, apiKey: e.target.value } })}
          sx={{ flex: '1 1 200px' }}
          helperText="Leave empty if your endpoint does not require a key"
        />
      </Box>
      <TextField
        size="small"
        label="System prompt (optional)"
        value={draft.llm.systemPrompt || ''}
        disabled={!draft.enabled}
        onChange={(e) => setDraft({ ...draft, llm: { ...draft.llm, systemPrompt: e.target.value } })}
        fullWidth
        multiline
        minRows={2}
      />
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button
          size="small"
          variant="outlined"
          disabled={!draft.enabled || saving || testing}
          onClick={() => void persist(draft)}
        >
          {saving ? 'Saving…' : 'Save LLM settings'}
        </Button>
        <Button
          size="small"
          variant="outlined"
          startIcon={testing ? <CircularProgress size={14} /> : <ScienceOutlinedIcon />}
          disabled={!draft.enabled || testing}
          onClick={() => void testLlm()}
        >
          Test LLM
        </Button>
        <Button size="small" onClick={() => void refresh()} disabled={loading}>
          Reload
        </Button>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          MCP servers
        </Typography>
        <Button
          size="small"
          startIcon={<AddIcon />}
          disabled={!draft.enabled}
          onClick={openAddMcp}
        >
          Add MCP server
        </Button>
      </Box>

      {draft.mcpServers.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No MCP servers configured. Add one to use Send to MCP from Output.
        </Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>URL</TableCell>
              <TableCell>Tool</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {draft.mcpServers.map((server) => (
              <TableRow key={server.id}>
                <TableCell>{server.name}</TableCell>
                <TableCell sx={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {server.url}
                </TableCell>
                <TableCell>{server.toolName}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={server.enabled ? 'On' : 'Off'}
                    color={server.enabled ? 'success' : 'default'}
                  />
                </TableCell>
                <TableCell align="right">
                  <IconButton
                    size="small"
                    disabled={!draft.enabled || testing}
                    onClick={() => void testMcp(server.id)}
                    aria-label={`Test ${server.name}`}
                  >
                    <ScienceOutlinedIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    disabled={!draft.enabled}
                    onClick={() => openEditMcp(server)}
                    aria-label={`Edit ${server.name}`}
                  >
                    <EditOutlinedIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    disabled={!draft.enabled}
                    onClick={() => void removeMcp(server.id)}
                    aria-label={`Delete ${server.name}`}
                  >
                    <DeleteOutlinedIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={mcpDialogOpen} onClose={() => setMcpDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          {mcpDraft && draft.mcpServers.some((s) => s.id === mcpDraft.id) ? 'Edit MCP server' : 'Add MCP server'}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 1 }}>
          {mcpDraft && (
            <>
              <TextField
                size="small"
                label="Name"
                value={mcpDraft.name}
                onChange={(e) => setMcpDraft({ ...mcpDraft, name: e.target.value })}
                fullWidth
              />
              <TextField
                size="small"
                label="URL"
                value={mcpDraft.url}
                onChange={(e) => setMcpDraft({ ...mcpDraft, url: e.target.value })}
                fullWidth
                helperText="Remote MCP HTTP endpoint (JSON-RPC tools/call)"
              />
              <TextField
                size="small"
                label="Tool name"
                value={mcpDraft.toolName}
                onChange={(e) => setMcpDraft({ ...mcpDraft, toolName: e.target.value })}
                fullWidth
              />
              <MaskedSecretField
                size="small"
                label="Auth / Bearer (optional)"
                value={mcpDraft.authHeader || ''}
                onChange={(e) => setMcpDraft({ ...mcpDraft, authHeader: e.target.value })}
                fullWidth
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={mcpDraft.enabled}
                    onChange={(e) => setMcpDraft({ ...mcpDraft, enabled: e.target.checked })}
                  />
                }
                label="Enabled for analysis"
              />
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setMcpDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!mcpDraft?.name.trim() || !mcpDraft?.url.trim() || !mcpDraft?.toolName.trim()}
            onClick={() => void saveMcpDraft()}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
