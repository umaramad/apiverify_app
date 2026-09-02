import React from 'react'
import { Box, Chip, Divider, Paper, Typography } from '@mui/material'
import type { LinuxCommandEntry } from '../../models'

interface LinuxCommandDetailProps {
  entry: LinuxCommandEntry | null
}

export default function LinuxCommandDetail({ entry }: LinuxCommandDetailProps): React.JSX.Element {
  if (!entry) {
    return (
      <Paper variant="outlined" sx={{ p: 2.5, height: '100%' }}>
        <Typography variant="body2" color="text.secondary">
          Select a command to view synopsis, description, and examples.
        </Typography>
      </Paper>
    )
  }

  return (
    <Paper variant="outlined" sx={{ p: 2.5, height: '100%', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box>
        <Typography variant="h6" sx={{ fontWeight: 700, fontFamily: 'monospace' }}>
          {entry.name}
        </Typography>
        <Chip label={entry.category} size="small" sx={{ mt: 0.75 }} />
      </Box>

      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
          Synopsis
        </Typography>
        <Typography
          component="pre"
          sx={{
            m: 0,
            mt: 0.5,
            p: 1.25,
            bgcolor: 'action.hover',
            borderRadius: 1,
            fontFamily: 'monospace',
            fontSize: '0.8rem',
            whiteSpace: 'pre-wrap',
          }}
        >
          {entry.synopsis}
        </Typography>
      </Box>

      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
          Description
        </Typography>
        <Typography variant="body2" sx={{ mt: 0.5 }}>
          {entry.description}
        </Typography>
      </Box>

      <Divider />

      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
          Examples
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 0.75 }}>
          {entry.examples.map((example) => (
            <Typography
              key={example}
              component="pre"
              sx={{
                m: 0,
                p: 1.25,
                bgcolor: 'action.hover',
                borderRadius: 1,
                fontFamily: 'monospace',
                fontSize: '0.8rem',
                whiteSpace: 'pre-wrap',
              }}
            >
              {example}
            </Typography>
          ))}
        </Box>
      </Box>

      {entry.tags.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
          {entry.tags.map((tag) => (
            <Chip key={tag} label={tag} size="small" variant="outlined" />
          ))}
        </Box>
      )}
    </Paper>
  )
}
