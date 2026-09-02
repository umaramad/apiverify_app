import React, { useEffect, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material'
import type { LinuxSearchTargetConfig } from '../../models/config'
import type { SshSessionHandle } from '../../models/ssh'
import { toSshServerIdentity } from '../../models/sshIdentity'

export interface SshConnectionDialogValues {
  server: string
  host: string
  username: string
  port?: number
  /** When set (e.g. from target config), used as the session serverId. */
  id?: string
}

interface SshConnectionDialogProps {
  open: boolean
  initial: SshConnectionDialogValues
  /** Saved application targets from Settings (used to prefill + pick). */
  targets?: LinuxSearchTargetConfig[]
  onClose: () => void
  /** Called with the authenticated session handle after success (dialog already closing). */
  onConnected: (session: SshSessionHandle) => void
  /** Notifies parent when connect attempt starts/ends (for live console indicator). */
  onConnectingChange?: (connecting: boolean) => void
}

const noStoreInput = {
  autoComplete: 'off',
  'data-lpignore': 'true',
  'data-1p-ignore': 'true',
  'data-form-type': 'other',
} as const

function applyTarget(
  target: LinuxSearchTargetConfig | null | undefined
): SshConnectionDialogValues | null {
  if (!target) return null
  const identity = toSshServerIdentity(target)
  return {
    id: identity.id,
    server: target.serverName || target.applicationName || identity.host,
    host: identity.host,
    username: identity.username,
    port: identity.port,
  }
}

/**
 * Simple SSH connection dialog.
 * Password is always blank when opened, never remembered, never autofilled.
 * Prefills from saved Settings targets when available.
 */
export default function SshConnectionDialog({
  open,
  initial,
  targets = [],
  onClose,
  onConnected,
  onConnectingChange,
}: SshConnectionDialogProps): React.JSX.Element {
  const [selectedTargetId, setSelectedTargetId] = useState('')
  const [server, setServer] = useState(initial.server)
  const [host, setHost] = useState(initial.host)
  const [username, setUsername] = useState(initial.username)
  const [port, setPort] = useState(initial.port ?? 22)
  const [serverId, setServerId] = useState(initial.id ?? '')
  const [password, setPassword] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errorDetail, setErrorDetail] = useState<string | null>(null)
  const [debugOpen, setDebugOpen] = useState(false)
  const [debugText, setDebugText] = useState<string | null>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  const updateConnecting = (next: boolean): void => {
    setConnecting(next)
    onConnectingChange?.(next)
  }

  useEffect(() => {
    if (!open) return

    const preferred =
      (initial.id ? targets.find((t) => t.id === initial.id) : undefined) ?? targets[0]
    const fromTarget = applyTarget(preferred)
    const next = fromTarget ?? initial

    setSelectedTargetId(preferred?.id ?? '')
    setServer(next.server || '')
    setHost(next.host || '')
    setUsername(next.username || '')
    setPort(next.port ?? 22)
    setServerId(next.id || '')
    setPassword('')
    setError(null)
    setErrorDetail(null)
    setDebugOpen(false)
    setDebugText(null)
    updateConnecting(false)

    const t = window.setTimeout(() => passwordRef.current?.focus(), 50)
    return () => {
      window.clearTimeout(t)
      setPassword('')
    }
    // Prefill only when the dialog opens (targets are refreshed before open).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const handleSelectTarget = (targetId: string): void => {
    setSelectedTargetId(targetId)
    const target = targets.find((t) => t.id === targetId)
    const next = applyTarget(target)
    if (!next) return
    setServer(next.server)
    setHost(next.host)
    setUsername(next.username)
    setPort(next.port ?? 22)
    setServerId(next.id || '')
  }

  const handleCancel = (): void => {
    setPassword('')
    setError(null)
    setErrorDetail(null)
    onClose()
  }

  const loadDebugInfo = async (): Promise<void> => {
    try {
      const [info, tail] = await Promise.all([
        window.api.linuxSearchAssistantGetDebugInfo(),
        window.api.linuxSearchAssistantGetLogTail(60),
      ])
      const sshLines = tail.lines.filter((line) => /ssh|linuxSearchAssistant\.ssh/i.test(line))
      setDebugText(
        [
          `platform: ${info.platform}/${info.arch}`,
          `userData: ${info.userDataPath}`,
          `logFile: ${info.logFilePath}`,
          '',
          'Recent SSH log lines:',
          ...(sshLines.length ? sshLines : tail.lines.slice(-20)),
        ].join('\n')
      )
      setDebugOpen(true)
    } catch (err) {
      setDebugText(err instanceof Error ? err.message : 'Could not load debug info.')
      setDebugOpen(true)
    }
  }

  const handleConnect = async (): Promise<void> => {
    setError(null)
    setErrorDetail(null)
    updateConnecting(true)

    let oneTimePassword = password
    setPassword('')

    try {
      const hostValue = host.trim()
      const usernameValue = username.trim()
      const portValue = Number(port) || 22
      const session = await window.api.linuxSearchAssistantSshConnect(
        {
          id: serverId.trim() || `${usernameValue}@${hostValue}:${portValue}`,
          server: server.trim(),
          label: server.trim(),
          host: hostValue,
          username: usernameValue,
          port: portValue,
        },
        oneTimePassword
      )
      oneTimePassword = ''
      onConnected(session)
      onClose()
    } catch (err) {
      oneTimePassword = ''
      setPassword('')
      const appErr = err as { message?: string; technicalDetails?: string; code?: string }
      setError(appErr?.message || (err instanceof Error ? err.message : 'Connection failed.'))
      setErrorDetail(
        [appErr?.code ? `code: ${appErr.code}` : null, appErr?.technicalDetails || null]
          .filter(Boolean)
          .join('\n') || null
      )
    } finally {
      oneTimePassword = ''
      updateConnecting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={connecting ? undefined : handleCancel}
      fullWidth
      maxWidth="xs"
      disableRestoreFocus
    >
      <DialogTitle sx={{ fontWeight: 700 }}>Connect</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
        {error && (
          <Alert severity="error" onClose={() => { setError(null); setErrorDetail(null) }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {error}
            </Typography>
            {errorDetail && (
              <Typography
                component="pre"
                variant="caption"
                sx={{ m: 0, mt: 1, whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}
              >
                {errorDetail}
              </Typography>
            )}
            <Button size="small" sx={{ mt: 1 }} onClick={() => void loadDebugInfo()}>
              Show debug / log path
            </Button>
          </Alert>
        )}

        {debugOpen && debugText && (
          <Box
            component="pre"
            sx={{
              m: 0,
              p: 1,
              maxHeight: 180,
              overflow: 'auto',
              bgcolor: 'action.hover',
              borderRadius: 1,
              fontSize: 11,
              whiteSpace: 'pre-wrap',
            }}
          >
            {debugText}
          </Box>
        )}

        {targets.length > 0 ? (
          <FormControl fullWidth size="small">
            <InputLabel id="lsa-connect-target-label">Saved application</InputLabel>
            <Select
              labelId="lsa-connect-target-label"
              label="Saved application"
              value={selectedTargetId}
              onChange={(e) => handleSelectTarget(e.target.value)}
              disabled={connecting}
            >
              {targets.map((t) => (
                <MenuItem key={t.id} value={t.id}>
                  {t.applicationName || t.serverName || t.hostNameOrIp || t.id}
                  {t.hostNameOrIp ? ` (${t.username}@${t.hostNameOrIp})` : ''}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        ) : (
          <Alert severity="info">
            No saved application targets yet. Add one under Settings → Feature Modules → Linux Search
            Assistant, then open Connect again.
          </Alert>
        )}

        <TextField
          label="Server"
          value={server}
          onChange={(e) => setServer(e.target.value)}
          fullWidth
          size="small"
          autoComplete="off"
          slotProps={{ htmlInput: noStoreInput }}
        />
        <TextField
          label="Host"
          value={host}
          onChange={(e) => setHost(e.target.value)}
          fullWidth
          size="small"
          autoComplete="off"
          slotProps={{ htmlInput: noStoreInput }}
        />
        <TextField
          label="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          fullWidth
          size="small"
          autoComplete="off"
          slotProps={{ htmlInput: { ...noStoreInput, autoComplete: 'off' } }}
        />
        <TextField
          label="Port"
          type="number"
          value={port}
          onChange={(e) => setPort(Number(e.target.value) || 22)}
          fullWidth
          size="small"
          autoComplete="off"
          slotProps={{ htmlInput: noStoreInput }}
        />
        <TextField
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !connecting) void handleConnect()
          }}
          fullWidth
          size="small"
          inputRef={passwordRef}
          autoComplete="new-password"
          name="lsa-ssh-one-time-password"
          slotProps={{
            htmlInput: {
              ...noStoreInput,
              autoComplete: 'new-password',
            },
          }}
        />
        <Typography variant="caption" color="text.secondary">
          Password is used once for this connection and is never saved.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleCancel} disabled={connecting}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={() => void handleConnect()}
          disabled={connecting || !host.trim() || !username.trim() || !password}
        >
          {connecting ? 'Connecting…' : 'Connect'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
