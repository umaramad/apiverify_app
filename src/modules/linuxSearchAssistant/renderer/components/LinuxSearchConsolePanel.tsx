import React, { useEffect, useRef } from 'react'
import { Box, IconButton, Typography } from '@mui/material'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import TerminalIcon from '@mui/icons-material/Terminal'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import type { LinuxSearchConsoleLevel } from '../../models'
import type { LinuxSearchConsoleEntry } from '../hooks/useLinuxSearchConsole'

const EXPANDED_HEIGHT = 200

const LEVEL_COLORS: Record<LinuxSearchConsoleLevel, string> = {
  info: '#94A3B8',
  debug: '#64748B',
  warn: '#FBBF24',
  error: '#F87171',
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

interface LinuxSearchConsolePanelProps {
  logs: LinuxSearchConsoleEntry[]
  expanded: boolean
  busy?: boolean
  onToggleExpanded: () => void
  onClear: () => void
}

/**
 * Minimizable console for SSH connect / remote search progress.
 * Always visible so the user can expand while connecting or grepping.
 */
export default function LinuxSearchConsolePanel({
  logs,
  expanded,
  busy = false,
  onToggleExpanded,
  onClear,
}: LinuxSearchConsolePanelProps): React.JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (expanded && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs, expanded])

  return (
    <Box
      sx={{
        flexShrink: 0,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        bgcolor: 'background.paper',
        display: 'flex',
        flexDirection: 'column',
        minHeight: expanded ? EXPANDED_HEIGHT : 40,
        maxHeight: expanded ? EXPANDED_HEIGHT : 40,
        overflow: 'hidden',
        transition: 'max-height 0.2s ease',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 1.5,
          py: 0.5,
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
            {busy ? ' · live' : ''}
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
          <IconButton
            size="small"
            onClick={onToggleExpanded}
            aria-label={expanded ? 'Minimize console' : 'Expand console'}
          >
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
            px: 1.5,
            py: 1,
            fontFamily: 'monospace',
            fontSize: '0.75rem',
            lineHeight: 1.5,
            bgcolor: '#0F172A',
            color: '#E2E8F0',
          }}
        >
          {logs.length === 0 && (
            <Typography variant="caption" sx={{ color: '#64748B', fontFamily: 'monospace' }}>
              {busy
                ? 'Waiting for SSH / remote activity…'
                : 'Connect or run a remote action to see console output here.'}
            </Typography>
          )}
          {logs.map((entry) => (
            <Box key={entry.id} sx={{ mb: 0.75, display: 'flex', gap: 1, alignItems: 'baseline', flexWrap: 'wrap' }}>
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
              {entry.source && (
                <Typography
                  component="span"
                  sx={{ color: '#475569', fontFamily: 'monospace', fontSize: '0.7rem', flexShrink: 0 }}
                >
                  [{entry.source}]
                </Typography>
              )}
              <Typography
                component="span"
                sx={{ color: '#F1F5F9', fontFamily: 'monospace', fontSize: '0.75rem', wordBreak: 'break-all' }}
              >
                {entry.message}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
}
