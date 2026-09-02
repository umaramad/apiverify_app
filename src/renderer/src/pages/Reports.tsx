import React from 'react'
import {
  Box,
  Typography,
  Paper,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
} from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CancelIcon from '@mui/icons-material/Cancel'
import InfoIcon from '@mui/icons-material/Info'
import { useAppStore } from '../store/app.store'
import { formatLocalDateTimeFull } from '../../../shared/utils/dateTime'

export default function Reports(): React.JSX.Element {
  const history = useAppStore((s) => s.history)

  // Telemetry computations
  const total = history.length
  
  const passed = history.filter((h) => {
    if (!h.validationResult || !h.validationResult.validationErrors) return false
    try {
      return JSON.parse(h.validationResult.validationErrors).valid === true
    } catch (_) {
      return false
    }
  }).length

  const failed = history.filter((h) => {
    if (!h.validationResult || !h.validationResult.validationErrors) return false
    try {
      return JSON.parse(h.validationResult.validationErrors).valid === false
    } catch (_) {
      return false
    }
  }).length

  const untested = total - (passed + failed)
  const passRate = total > 0 ? Math.round((passed / total) * 100) : 0

  return (
    <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', gap: 4, height: '100%', overflowY: 'auto' }}>
      <Box sx={{ mb: 1 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 1, color: 'text.primary' }}>
          Validation Reports
        </Typography>
        <Typography variant="body1" sx={{ color: 'text.secondary' }}>
          Historical analysis of your OpenAPI schema validation runs.
        </Typography>
      </Box>

      {total === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <InfoIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
          <Typography variant="body1" sx={{ color: 'text.primary', mb: 1, fontWeight: 600 }}>
            No History Available
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Run API tests on the Validation Runner page to compile validation history reports.
          </Typography>
        </Paper>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {/* Statistical Telemetry Widget */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
              gap: 3,
            }}
          >
            {/* Pie Chart / Bar Chart representation */}
            <Box>
              <Paper sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'text.primary' }}>
                  Pass Rate Metric
                </Typography>
                <Divider />
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 2, gap: 1 }}>
                  {/* Custom CSS/SVG circular progress */}
                  <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                    <svg width="120" height="120" viewBox="0 0 120 120">
                      {/* Background circle */}
                      <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="12" />
                      {/* Progress circle */}
                      <circle
                        cx="60"
                        cy="60"
                        r="50"
                        fill="none"
                        stroke="#10B981"
                        strokeWidth="12"
                        strokeDasharray={2 * Math.PI * 50}
                        strokeDashoffset={2 * Math.PI * 50 * (1 - passRate / 100)}
                        strokeLinecap="round"
                        transform="rotate(-90 60 60)"
                      />
                    </svg>
                    <Box
                      sx={{
                        top: 0,
                        left: 0,
                        bottom: 0,
                        right: 0,
                        position: 'absolute',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Typography variant="h5" component="div" sx={{ fontWeight: 800, color: 'text.primary' }}>
                        {passRate}%
                      </Typography>
                    </Box>
                  </Box>
                  <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600, mt: 1 }}>
                    Validation Success Rate
                  </Typography>
                </Box>
              </Paper>
            </Box>

            {/* Success Bar metrics */}
            <Box>
              <Paper sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'text.primary' }}>
                  Distribution Metrics
                </Typography>
                <Divider />
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, py: 1 }}>
                  {/* Passed Bar */}
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>Passed ({passed})</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: 'success.main' }}>
                        {total > 0 ? Math.round((passed / total) * 100) : 0}%
                      </Typography>
                    </Box>
                    <Box sx={{ height: 8, bgcolor: 'action.hover', borderRadius: 4, overflow: 'hidden' }}>
                      <Box sx={{ height: '100%', bgcolor: 'success.main', width: `${total > 0 ? (passed / total) * 100 : 0}%` }} />
                    </Box>
                  </Box>

                  {/* Failed Bar */}
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>Failed ({failed})</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: 'error.main' }}>
                        {total > 0 ? Math.round((failed / total) * 100) : 0}%
                      </Typography>
                    </Box>
                    <Box sx={{ height: 8, bgcolor: 'action.hover', borderRadius: 4, overflow: 'hidden' }}>
                      <Box sx={{ height: '100%', bgcolor: 'error.main', width: `${total > 0 ? (failed / total) * 100 : 0}%` }} />
                    </Box>
                  </Box>

                  {/* Untested Bar */}
                  <Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>Untested ({untested})</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                        {total > 0 ? Math.round((untested / total) * 100) : 0}%
                      </Typography>
                    </Box>
                    <Box sx={{ height: 8, bgcolor: 'action.hover', borderRadius: 4, overflow: 'hidden' }}>
                      <Box sx={{ height: '100%', bgcolor: 'text.secondary', width: `${total > 0 ? (untested / total) * 100 : 0}%` }} />
                    </Box>
                  </Box>
                </Box>
              </Paper>
            </Box>
          </Box>

          {/* Historical Run Log */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: 'text.primary' }}>
              Historical Run Log
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <TableContainer>
              <Table size="small">
                <TableHead sx={{ bgcolor: 'action.hover' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Method</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Endpoint / URL</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Validation Result</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Date/Time</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {history.map((h) => {
                    let isValid = null
                    if (h.validationResult && h.validationResult.validationErrors) {
                      try {
                        isValid = JSON.parse(h.validationResult.validationErrors).valid
                      } catch (_) {}
                    }

                    return (
                      <TableRow key={h.id}>
                        <TableCell>
                          <Chip
                            size="small"
                            label={h.validationResult?.responseStatus || 0}
                            sx={{
                              bgcolor: (h.validationResult?.responseStatus || 0) >= 200 && (h.validationResult?.responseStatus || 0) < 300 ? 'success.main' : 'error.main',
                              color: '#FFFFFF',
                              fontWeight: 700,
                            }}
                          />
                        </TableCell>
                        <TableCell sx={{ fontWeight: 800, fontFamily: 'monospace', color: 'text.primary' }}>
                          {h.method}
                        </TableCell>
                        <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'text.primary', wordBreak: 'break-all' }}>
                          {h.url}
                        </TableCell>
                        <TableCell>
                          {isValid === null ? (
                            <Chip icon={<InfoIcon />} label="No spec" size="small" variant="outlined" />
                          ) : isValid ? (
                            <Chip icon={<CheckCircleIcon sx={{ '&&': { color: 'success.main' } }} />} label="Passed" size="small" sx={{ borderColor: 'success.main', color: 'success.main' }} variant="outlined" />
                          ) : (
                            <Chip icon={<CancelIcon sx={{ '&&': { color: 'error.main' } }} />} label="Failed" size="small" sx={{ borderColor: 'error.main', color: 'error.main' }} variant="outlined" />
                          )}
                        </TableCell>
                        <TableCell sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>
                          {h.createdAt ? formatLocalDateTimeFull(h.createdAt) : ''}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Box>
      )}
    </Box>
  )
}
