import React, { useEffect, useRef } from 'react'
import { Box, IconButton, Typography } from '@mui/material'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import TerminalIcon from '@mui/icons-material/Terminal'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import type { ValidationConsoleLogEntry, ValidationConsoleLogLevel } from '../../../shared/models/validationRunner'

const EXPANDED_HEIGHT = 220

const LEVEL_COLORS: Record<ValidationConsoleLogLevel, string> = {
  info: '#94A3B8',
  request: '#60A5FA',
  response: '#A78BFA',
  success: '#34D399',
  error: '#F87171',
  warn: '#FBBF24',
}

function formatTime(timestamp: string): string {
  try {
    return new Date(timestamp).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  } catch {
    return ''
  }
}

interface RunnerDebugConsoleProps {
  logs: ValidationConsoleLogEntry[]
  expanded: boolean
  isRunning: boolean
  onToggleExpanded: () => void
  onClear: () => void
}

export default function RunnerDebugConsole({
  logs,
  expanded,
  isRunning,
  onToggleExpanded,
  onClear,
}: RunnerDebugConsoleProps): React.JSX.Element | null {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (expanded && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs, expanded])

  if (logs.length === 0 && !isRunning) return null

  return (
    <Box
      sx={{
        flexShrink: 0,
        borderTop: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        display: 'flex',
        flexDirection: 'column',
        minHeight: expanded ? EXPANDED_HEIGHT : 40,
        maxHeight: expanded ? EXPANDED_HEIGHT : 40,
        transition: 'max-height 0.2s ease',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 0.75,
          minHeight: 40,
          bgcolor: 'action.hover',
          cursor: 'pointer',
          userSelect: 'none',
        }}
        onClick={onToggleExpanded}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TerminalIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Console
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {logs.length} log{logs.length === 1 ? '' : 's'}
            {isRunning ? ' · live' : ''}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
          <IconButton
            size="small"
            onClick={onClear}
            disabled={logs.length === 0}
            aria-label="Clear console"
            sx={{ color: 'text.secondary', mr: 0.5 }}
          >
            <DeleteOutlinedIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" onClick={onToggleExpanded} aria-label={expanded ? 'Minimize console' : 'Expand console'}>
            {expanded ? <ExpandMoreIcon fontSize="small" /> : <ExpandLessIcon fontSize="small" />}
          </IconButton>
        </Box>
      </Box>

      {expanded && (
        <Box
          ref={scrollRef}
          sx={{
            flex: 1,
            overflowY: 'auto',
            px: 2,
            py: 1,
            fontFamily: 'monospace',
            fontSize: '0.75rem',
            lineHeight: 1.5,
            bgcolor: '#0F172A',
            color: '#E2E8F0',
          }}
        >
          {logs.length === 0 && isRunning && (
            <Typography variant="caption" sx={{ color: '#64748B', fontFamily: 'monospace' }}>
              Waiting for network activity…
            </Typography>
          )}
          {logs.map((entry) => (
            <Box key={entry.id} sx={{ mb: 1.25 }}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <Typography
                  component="span"
                  sx={{ color: '#64748B', fontFamily: 'monospace', fontSize: '0.7rem', flexShrink: 0 }}
                >
                  {formatTime(entry.timestamp)}
                </Typography>
                <Typography
                  component="span"
                  sx={{
                    color: LEVEL_COLORS[entry.level],
                    fontFamily: 'monospace',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    flexShrink: 0,
                  }}
                >
                  {entry.level}
                </Typography>
                <Typography
                  component="span"
                  sx={{ color: '#F1F5F9', fontFamily: 'monospace', fontSize: '0.75rem', wordBreak: 'break-all' }}
                >
                  {entry.message}
                </Typography>
              </Box>
              {entry.detail && (
                <Box
                  component="pre"
                  sx={{
                    m: 0,
                    mt: 0.5,
                    ml: 2,
                    p: 1,
                    borderRadius: 1,
                    bgcolor: 'rgba(255,255,255,0.04)',
                    color: '#CBD5E1',
                    fontSize: '0.7rem',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    maxHeight: 120,
                    overflowY: 'auto',
                  }}
                >
                  {entry.detail}
                </Box>
              )}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
}
