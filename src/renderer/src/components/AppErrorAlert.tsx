import React, { useState } from 'react'
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Collapse,
  IconButton,
  Typography,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import RefreshIcon from '@mui/icons-material/Refresh'
import CloseIcon from '@mui/icons-material/Close'
import { AppError, normalizeError, type AppErrorPayload } from '../../../shared/errors'

const USER_FACING_ERROR_CODES = new Set(['NETWORK', 'TIMEOUT', 'CANCELLED'])

export interface AppErrorAlertProps {
  error: unknown
  title?: string
  onRetry?: () => void
  onDismiss?: () => void
  retryLabel?: string
  sx?: object
}

function resolveError(error: unknown): AppError {
  if (error instanceof AppError) return error
  if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
    return AppError.fromPayload(error as AppErrorPayload)
  }
  return normalizeError(error)
}

function shouldShowTechnicalDetails(appError: AppError): boolean {
  if (!appError.technicalDetails) return false
  if (USER_FACING_ERROR_CODES.has(appError.code)) return false
  return !looksLikeStackTrace(appError.technicalDetails)
}

function looksLikeStackTrace(text: string): boolean {
  return (
    text.includes('node_modules/') ||
    text.includes('AxiosError.from') ||
    text.includes('RedirectableRequest.') ||
    /^\s*at\s+/m.test(text)
  )
}

export default function AppErrorAlert({
  error,
  title,
  onRetry,
  onDismiss,
  retryLabel = 'Retry',
  sx,
}: AppErrorAlertProps): React.JSX.Element | null {
  const [expanded, setExpanded] = useState(false)

  if (!error) return null

  const appError = resolveError(error)
  const severity =
    appError.code === 'CANCELLED' ? 'warning' : appError.code === 'VALIDATION' ? 'warning' : 'error'

  return (
    <Alert
      severity={severity}
      sx={{ alignItems: 'flex-start', ...sx }}
      action={
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {appError.retryable && onRetry && (
            <Button color="inherit" size="small" startIcon={<RefreshIcon />} onClick={onRetry}>
              {retryLabel}
            </Button>
          )}
          {onDismiss && (
            <IconButton aria-label="Dismiss" color="inherit" size="small" onClick={onDismiss}>
              <CloseIcon fontSize="small" />
            </IconButton>
          )}
        </Box>
      }
    >
      <AlertTitle sx={{ fontWeight: 700 }}>{title ?? errorTitle(appError.code)}</AlertTitle>
      <Typography variant="body2">{appError.message}</Typography>

      {shouldShowTechnicalDetails(appError) && (
        <Box sx={{ mt: 1 }}>
          <Button
            size="small"
            color="inherit"
            onClick={() => setExpanded((v) => !v)}
            endIcon={
              <ExpandMoreIcon
                sx={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: '0.2s' }}
              />
            }
            sx={{ px: 0, minWidth: 0, textTransform: 'none', fontWeight: 600 }}
          >
            Technical details
          </Button>
          <Collapse in={expanded}>
            <Box
              component="pre"
              sx={{
                mt: 1,
                p: 1.5,
                bgcolor: 'action.hover',
                borderRadius: 1,
                fontSize: '0.75rem',
                fontFamily: 'monospace',
                overflow: 'auto',
                maxHeight: 200,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                m: 0,
              }}
            >
              {`Code: ${appError.code}\n\n${appError.technicalDetails}`}
            </Box>
          </Collapse>
        </Box>
      )}
    </Alert>
  )
}

function errorTitle(code: AppError['code']): string {
  switch (code) {
    case 'NETWORK':
      return 'Connection problem'
    case 'TIMEOUT':
      return 'Request timed out'
    case 'OPENAPI':
      return 'Invalid API specification'
    case 'DATABASE':
      return 'Database error'
    case 'VALIDATION':
      return 'Validation error'
    case 'SSH':
      return 'SSH connection failed'
    case 'CANCELLED':
      return 'Cancelled'
    default:
      return 'Something went wrong'
  }
}
