import React from 'react'
import {
  Alert,
  Box,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { useAppStore } from '../store/app.store'
import { useShallow } from 'zustand/react/shallow'
import { isManualCollection } from '../../../shared/manualCollection'

interface CollectionExecutionPanelProps {
  variant?: 'default' | 'tab'
}

export default function CollectionExecutionPanel({
  variant = 'default',
}: CollectionExecutionPanelProps): React.JSX.Element {
  const { parsedSpec, collectionRuntimeVariables, collectionRunLogs } = useAppStore(
    useShallow((s) => ({
      parsedSpec: s.parsedSpec,
      collectionRuntimeVariables: s.collectionRuntimeVariables,
      collectionRunLogs: s.collectionRunLogs,
    }))
  )

  const isManual = parsedSpec ? isManualCollection(parsedSpec) : false
  const variableEntries = Object.entries(collectionRuntimeVariables)

  if (!isManual) {
    return (
      <Alert severity="info" sx={{ m: 0 }}>
        Select a manual collection to run chained requests with pre/post variables.
      </Alert>
    )
  }

  if (variant === 'tab') {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
            Current Variables
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
            Environment variables, collection pre-variables, and values extracted from earlier responses during a run.
          </Typography>
        </Box>

        <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
          <TableContainer>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700, width: '35%' }}>Key</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Value</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {variableEntries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2}>
                      <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', py: 1 }}>
                        No runtime variables yet. Configure pre-variables from the collection menu, or run the collection
                        to extract post-variables from responses.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  variableEntries.map(([key, value]) => (
                    <TableRow key={key} hover>
                      <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600, verticalAlign: 'top' }}>{key}</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', wordBreak: 'break-all', verticalAlign: 'top' }}>{value}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
            Run Log
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
            Step-by-step output when you use Run Collection from the toolbar above.
          </Typography>
        </Box>

        <Paper variant="outlined" sx={{ p: 1.5, minHeight: 120 }}>
          {collectionRunLogs.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              No collection run yet. Click Run Collection to execute all requests in order.
            </Typography>
          ) : (
            collectionRunLogs.map((line, index) => (
              <Box key={index} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
                <Chip
                  label={line.status}
                  size="small"
                  color={line.status === 'success' ? 'success' : line.status === 'error' ? 'error' : 'default'}
                  variant="outlined"
                  sx={{ height: 20, fontSize: '0.65rem', flexShrink: 0, mt: 0.25 }}
                />
                <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-word' }}>
                  {line.message}
                </Typography>
              </Box>
            ))
          )}
        </Paper>
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, minHeight: 0 }}>
      <Typography variant="caption" color="text.secondary">
        Post-variables from each response are applied before the next request runs.
      </Typography>

      <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
        <Box sx={{ px: 1.5, py: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Current Variables ({variableEntries.length})
          </Typography>
        </Box>
        <TableContainer sx={{ maxHeight: 180, overflow: 'auto' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Key</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Value</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {variableEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2}>
                    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                      No runtime variables yet.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                variableEntries.map(([key, value]) => (
                  <TableRow key={key}>
                    <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{key}</TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{value}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  )
}
