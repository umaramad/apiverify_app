import React, { useEffect, useMemo, useState } from 'react'
import {
  Box,
  Chip,
  CircularProgress,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Typography,
} from '@mui/material'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import {
  endpointOrderKey,
  sortManualRequestsByOrder,
} from '../../../shared/manualCollectionOrder'
import { extractManualRequests, type ManualRequest } from '../../../shared/manualCollection'
import type { HttpMethod } from '../../../shared/models'

function getMethodColor(method: string): string {
  switch (method.toLowerCase()) {
    case 'get':
      return '#10B981'
    case 'post':
      return '#3B82F6'
    case 'put':
      return '#F59E0B'
    case 'patch':
      return '#8B5CF6'
    case 'delete':
      return '#EF4444'
    default:
      return '#6B7280'
  }
}

interface ManualCollectionRequestListProps {
  parsedSpec: Record<string, unknown>
  savingOrder: boolean
  onSelect: (path: string, method: string, pathObj: Record<string, unknown>) => void
  onEdit: (request: ManualRequest) => void
  onDelete: (path: string, method: HttpMethod) => void
  onReorder: (order: string[]) => Promise<{ success: boolean; error?: string }>
}

export default function ManualCollectionRequestList({
  parsedSpec,
  savingOrder,
  onSelect,
  onEdit,
  onDelete,
  onReorder,
}: ManualCollectionRequestListProps): React.JSX.Element {
  const orderedRequests = useMemo(() => {
    const requests = extractManualRequests(parsedSpec)
    return sortManualRequestsByOrder(requests, parsedSpec) as ManualRequest[]
  }, [parsedSpec])

  const [displayRequests, setDisplayRequests] = useState<ManualRequest[]>(orderedRequests)
  const [draggingKey, setDraggingKey] = useState<string | null>(null)
  const [dragOverKey, setDragOverKey] = useState<string | null>(null)

  useEffect(() => {
    setDisplayRequests(orderedRequests)
  }, [orderedRequests])

  const paths = parsedSpec.paths as Record<string, Record<string, unknown>>

  const moveRequest = async (fromKey: string, toKey: string): Promise<void> => {
    if (fromKey === toKey) return

    const current = [...displayRequests]
    const fromIndex = current.findIndex((request) => endpointOrderKey(request.method, request.path) === fromKey)
    const toIndex = current.findIndex((request) => endpointOrderKey(request.method, request.path) === toKey)
    if (fromIndex < 0 || toIndex < 0) return

    const [moved] = current.splice(fromIndex, 1)
    current.splice(toIndex, 0, moved)
    setDisplayRequests(current)

    const result = await onReorder(current.map((request) => endpointOrderKey(request.method, request.path)))
    if (!result.success) {
      setDisplayRequests(orderedRequests)
    }
  }

  if (displayRequests.length === 0) {
    return (
      <Typography variant="body2" sx={{ color: 'text.secondary', py: 2, px: 2, fontStyle: 'italic' }}>
        No requests yet. Click &quot;Add Request&quot; to create your first API.
      </Typography>
    )
  }

  return (
    <List dense disablePadding sx={{ py: 1 }}>
      {displayRequests.map((request) => {
        const itemKey = endpointOrderKey(request.method, request.path)
        const pathObj = paths?.[request.path]
        const method = request.method.toLowerCase()
        const isDragging = draggingKey === itemKey
        const isDragOver = dragOverKey === itemKey && draggingKey !== itemKey

        return (
          <ListItem
            key={itemKey}
            disablePadding
            onDragOver={(event) => {
              event.preventDefault()
              setDragOverKey(itemKey)
            }}
            onDragLeave={() => {
              if (dragOverKey === itemKey) setDragOverKey(null)
            }}
            onDrop={(event) => {
              event.preventDefault()
              const sourceKey = draggingKey ?? event.dataTransfer.getData('text/plain')
              setDraggingKey(null)
              setDragOverKey(null)
              if (sourceKey) {
                void moveRequest(sourceKey, itemKey)
              }
            }}
            sx={{
              borderRadius: '6px',
              mb: 0.5,
              opacity: isDragging ? 0.45 : 1,
              bgcolor: isDragOver ? 'action.selected' : 'transparent',
              border: isDragOver ? '1px dashed' : '1px solid transparent',
              borderColor: isDragOver ? 'primary.main' : 'transparent',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                width: '100%',
                py: 0.75,
                px: 1,
                gap: 0.75,
                minWidth: 0,
              }}
            >
              <IconButton
                size="small"
                draggable={!savingOrder}
                aria-label={`Reorder ${request.name}`}
                onDragStart={(event) => {
                  setDraggingKey(itemKey)
                  event.dataTransfer.effectAllowed = 'move'
                  event.dataTransfer.setData('text/plain', itemKey)
                }}
                onDragEnd={() => {
                  setDraggingKey(null)
                  setDragOverKey(null)
                }}
                disabled={savingOrder}
                sx={{
                  cursor: savingOrder ? 'default' : 'grab',
                  color: 'text.secondary',
                  flexShrink: 0,
                  '&:active': { cursor: 'grabbing' },
                }}
                onClick={(event) => event.stopPropagation()}
              >
                {savingOrder && draggingKey === itemKey ? (
                  <CircularProgress size={16} />
                ) : (
                  <DragIndicatorIcon fontSize="small" />
                )}
              </IconButton>

              <Box
                onClick={() => pathObj && onSelect(request.path, method, pathObj)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  flex: 1,
                  minWidth: 0,
                  cursor: 'pointer',
                  gap: 1,
                }}
              >
                <Chip
                  label={request.method}
                  size="small"
                  sx={{
                    backgroundColor: 'transparent',
                    border: `1px solid ${getMethodColor(request.method)}`,
                    color: getMethodColor(request.method),
                    fontWeight: 800,
                    fontSize: '0.65rem',
                    height: 18,
                    flexShrink: 0,
                  }}
                />
                <ListItemText
                  sx={{ minWidth: 0, flex: 1 }}
                  primary={
                    <Typography
                      sx={{
                        color: 'text.primary',
                        fontSize: '0.8rem',
                        fontFamily: 'monospace',
                        wordBreak: 'break-all',
                      }}
                    >
                      {request.path}
                    </Typography>
                  }
                  secondary={
                    <Typography
                      variant="body2"
                      sx={{
                        color: 'text.secondary',
                        fontSize: '0.7rem',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {request.name}
                    </Typography>
                  }
                />
                <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                  <IconButton
                    size="small"
                    onClick={(event) => {
                      event.stopPropagation()
                      onEdit(request)
                    }}
                    sx={{ color: 'text.secondary' }}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={(event) => {
                      event.stopPropagation()
                      onDelete(request.path, request.method)
                    }}
                    sx={{ color: 'text.secondary' }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Box>
            </Box>
          </ListItem>
        )
      })}
    </List>
  )
}
