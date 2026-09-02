import React from 'react'
import { Box, Chip, Paper, Typography } from '@mui/material'
import type { LinuxSearchHit } from '../../models'

interface LinuxSearchResultListProps {
  hits: LinuxSearchHit[]
  selectedId: string | null
  onSelect: (hit: LinuxSearchHit) => void
}

export default function LinuxSearchResultList({
  hits,
  selectedId,
  onSelect,
}: LinuxSearchResultListProps): React.JSX.Element {
  if (hits.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 2, fontStyle: 'italic' }}>
        No matching Linux commands. Try a different keyword (for example: find, ports, disk, nginx).
      </Typography>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {hits.map((hit) => {
        const selected = hit.entry.id === selectedId
        return (
          <Paper
            key={hit.entry.id}
            variant="outlined"
            onClick={() => onSelect(hit)}
            sx={{
              p: 1.5,
              cursor: 'pointer',
              borderColor: selected ? 'primary.main' : 'divider',
              bgcolor: selected ? 'action.selected' : 'background.paper',
              '&:hover': { borderColor: 'primary.main' },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, fontFamily: 'monospace' }}>
                {hit.entry.name}
              </Typography>
              <Chip label={hit.entry.category} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
            </Box>
            <Typography variant="body2" color="text.secondary">
              {hit.entry.description}
            </Typography>
          </Paper>
        )
      })}
    </Box>
  )
}
