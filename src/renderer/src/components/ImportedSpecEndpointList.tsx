import React from 'react'
import {
  Box,
  Checkbox,
  Chip,
  List,
  ListItem,
  ListItemText,
  Typography,
} from '@mui/material'
import { endpointOrderKey } from '../../../shared/manualCollectionOrder'
import { extractEndpointsFromSpec } from '../../../shared/engine/endpointExtractor'

function getMethodColor(method: string): string {
  switch (method.toLowerCase()) {
    case 'get':
      return '#10B981'
    case 'post':
      return '#3B82F6'
    case 'put':
      return '#F59E0B'
    case 'delete':
      return '#EF4444'
    default:
      return '#6B7280'
  }
}

export interface ImportedSpecEndpointListProps {
  parsedSpec: Record<string, unknown>
  projectId: string
  selectedKeys: Set<string>
  selectionOrder: string[]
  onToggle: (key: string) => void
  onToggleAll: (keys: string[], selected: boolean) => void
  onSelect: (path: string, method: string, pathObj: Record<string, unknown>) => void
}

export default function ImportedSpecEndpointList({
  parsedSpec,
  projectId,
  selectedKeys,
  selectionOrder,
  onToggle,
  onToggleAll,
  onSelect,
}: ImportedSpecEndpointListProps): React.JSX.Element {
  const endpoints = extractEndpointsFromSpec(projectId, parsedSpec, {
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  })
  const orderIndex = new Map(selectionOrder.map((key, index) => [key, index]))
  const orderedEndpoints = [...endpoints].sort((left, right) => {
    const leftKey = endpointOrderKey(left.method, left.path)
    const rightKey = endpointOrderKey(right.method, right.path)
    const leftIndex = orderIndex.get(leftKey) ?? Number.MAX_SAFE_INTEGER
    const rightIndex = orderIndex.get(rightKey) ?? Number.MAX_SAFE_INTEGER
    if (leftIndex !== rightIndex) return leftIndex - rightIndex
    return left.path.localeCompare(right.path)
  })

  const allKeys = orderedEndpoints.map((endpoint) => endpointOrderKey(endpoint.method, endpoint.path))
  const selectedCount = allKeys.filter((key) => selectedKeys.has(key)).length
  const allSelected = allKeys.length > 0 && selectedCount === allKeys.length
  const someSelected = selectedCount > 0 && !allSelected

  if (orderedEndpoints.length === 0) {
    return (
      <Typography variant="body2" sx={{ color: 'text.secondary', py: 2, px: 2, fontStyle: 'italic' }}>
        No endpoints found in this specification.
      </Typography>
    )
  }

  const paths = parsedSpec.paths as Record<string, Record<string, unknown>>

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Checkbox
          size="small"
          checked={allSelected}
          indeterminate={someSelected}
          onChange={() => onToggleAll(allKeys, !allSelected)}
        />
        <Typography variant="caption" color="text.secondary">
          {selectedCount > 0
            ? `${selectedCount} selected — order follows selection sequence`
            : 'Select APIs to save as a manual collection'}
        </Typography>
      </Box>

      <List dense disablePadding sx={{ py: 1 }}>
        {orderedEndpoints.map((endpoint) => {
          const key = endpointOrderKey(endpoint.method, endpoint.path)
          const pathObj = paths[endpoint.path]
          const method = endpoint.method.toLowerCase()
          const selectionIndex = orderIndex.get(key)

          return (
            <ListItem
              key={key}
              disablePadding
              sx={{
                borderRadius: '6px',
                mb: 0.5,
                '&:hover': { backgroundColor: 'action.hover' },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', py: 0.75, px: 1, gap: 0.5, minWidth: 0 }}>
                <Checkbox
                  size="small"
                  checked={selectedKeys.has(key)}
                  onChange={() => onToggle(key)}
                  onClick={(event) => event.stopPropagation()}
                />
                {selectionIndex !== undefined && selectedKeys.has(key) && (
                  <Chip
                    label={selectionIndex + 1}
                    size="small"
                    sx={{ height: 18, fontSize: '0.65rem', minWidth: 24 }}
                  />
                )}
                <Box
                  onClick={() => pathObj && onSelect(endpoint.path, method, pathObj)}
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
                    label={endpoint.method}
                    size="small"
                    sx={{
                      backgroundColor: 'transparent',
                      border: `1px solid ${getMethodColor(endpoint.method)}`,
                      color: getMethodColor(endpoint.method),
                      fontWeight: 800,
                      fontSize: '0.65rem',
                      height: 18,
                      flexShrink: 0,
                    }}
                  />
                  <ListItemText
                    sx={{ minWidth: 0 }}
                    primary={
                      <Typography
                        sx={{
                          color: 'text.primary',
                          fontSize: '0.8rem',
                          fontFamily: 'monospace',
                          wordBreak: 'break-all',
                        }}
                      >
                        {endpoint.path}
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
                        {endpoint.name}
                      </Typography>
                    }
                  />
                </Box>
              </Box>
            </ListItem>
          )
        })}
      </List>
    </Box>
  )
}
