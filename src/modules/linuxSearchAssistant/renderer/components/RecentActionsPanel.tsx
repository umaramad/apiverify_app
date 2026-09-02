/**
 * Recent Actions panel — filter, pin favorites, replay via active SSH session.
 * Stores / displays logical actions only (no absolute paths, passwords, or sessions).
 */
import React from 'react'
import {
  Box,
  Button,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import PushPinIcon from '@mui/icons-material/PushPin'
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined'
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined'
import type { RecentActionRecord } from '../../models'

const OPERATION_LABEL: Record<RecentActionRecord['operation'], string> = {
  SEARCH_TEXT: 'Search Text',
  FIND_FILE: 'Find File',
  VIEW_FILE: 'View Files',
  TAIL_LOG: 'Tail Log',
  DOWNLOAD_FILE: 'Download File',
}

interface RecentActionsPanelProps {
  actions: RecentActionRecord[]
  filter: string
  onFilterChange: (value: string) => void
  loading?: boolean
  onReplay: (actionId: string) => void
  onTogglePin: (actionId: string, pinned: boolean) => void
  onRemove: (actionId: string) => void
  onClearUnpinned: () => void
  historySize?: number
}

export default function RecentActionsPanel({
  actions,
  filter,
  onFilterChange,
  loading,
  onReplay,
  onTogglePin,
  onRemove,
  onClearUnpinned,
  historySize,
}: RecentActionsPanelProps): React.JSX.Element {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        minHeight: 0,
        height: '100%',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        p: 1.5,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Recent Actions
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Logical history only · pinned never expire
            {typeof historySize === 'number' ? ` · size ${historySize}` : ''}
          </Typography>
        </Box>
        <Button size="small" onClick={onClearUnpinned} disabled={loading}>
          Clear
        </Button>
      </Box>

      <TextField
        size="small"
        placeholder="Filter recent actions…"
        value={filter}
        onChange={(e) => onFilterChange(e.target.value)}
        fullWidth
      />

      <List dense sx={{ flex: 1, minHeight: 0, overflowY: 'auto', py: 0 }}>
        {actions.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ px: 1, py: 2 }}>
            {loading ? 'Loading…' : 'No recent actions yet. Successful remote actions appear here.'}
          </Typography>
        )}
        {actions.map((action) => (
          <ListItem
            key={action.id}
            disablePadding
            secondaryAction={
              <Box sx={{ display: 'flex', gap: 0.25 }}>
                <Tooltip title={action.pinned ? 'Unpin' : 'Pin to Favorites'}>
                  <IconButton
                    edge="end"
                    size="small"
                    onClick={() => onTogglePin(action.id, !action.pinned)}
                    aria-label={action.pinned ? 'Unpin' : 'Pin to Favorites'}
                  >
                    {action.pinned ? (
                      <PushPinIcon fontSize="small" color="primary" />
                    ) : (
                      <PushPinOutlinedIcon fontSize="small" />
                    )}
                  </IconButton>
                </Tooltip>
                <Tooltip title="Remove">
                  <IconButton
                    edge="end"
                    size="small"
                    onClick={() => onRemove(action.id)}
                    aria-label="Remove"
                  >
                    <DeleteOutlineOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            }
            sx={{ pr: 9 }}
          >
            <ListItemButton onClick={() => onReplay(action.id)} sx={{ borderRadius: 1 }}>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {OPERATION_LABEL[action.operation]}
                    </Typography>
                    {action.pinned && <Chip size="small" label="Pinned" color="primary" variant="outlined" />}
                    <Chip size="small" label={action.application} variant="outlined" />
                  </Box>
                }
                secondary={
                  [
                    action.keyword ? `“${action.keyword}”` : null,
                    `pathId:${action.pathId}`,
                    action.fileName ? `file:${action.fileName}` : null,
                    new Date(action.timestamp).toLocaleString(),
                  ]
                    .filter(Boolean)
                    .join(' · ')
                }
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  )
}
