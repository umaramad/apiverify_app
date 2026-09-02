import React from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'

interface AskAiResultPanelProps {
  open: boolean
  busy: boolean
  content: string | null
  error: string | null
  truncated?: boolean
  modeLabel?: string
  onClose: () => void
}

export default function AskAiResultPanel({
  open,
  busy,
  content,
  error,
  truncated,
  modeLabel,
  onClose,
}: AskAiResultPanelProps): React.JSX.Element {
  const handleCopy = async (): Promise<void> => {
    if (!content) return
    try {
      await navigator.clipboard.writeText(content)
    } catch {
      /* ignore */
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 800 }}>
        Ask AI result{modeLabel ? ` · ${modeLabel}` : ''}
      </DialogTitle>
      <DialogContent dividers>
        {busy && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 3 }}>
            <CircularProgress size={22} />
            <Typography variant="body2" color="text.secondary">
              Analyzing logs…
            </Typography>
          </Box>
        )}
        {!busy && truncated && (
          <Alert severity="info" sx={{ mb: 1.5 }}>
            Input was truncated to the Ask AI payload limit before sending.
          </Alert>
        )}
        {!busy && error && <Alert severity="error">{error}</Alert>}
        {!busy && content && (
          <Typography
            component="pre"
            sx={{
              m: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              fontSize: '0.85rem',
              lineHeight: 1.5,
            }}
          >
            {content}
          </Typography>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button startIcon={<ContentCopyIcon />} disabled={!content || busy} onClick={() => void handleCopy()}>
          Copy
        </Button>
        <Button variant="contained" onClick={onClose}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  )
}
