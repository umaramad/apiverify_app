import React from 'react'
import { Box, Typography, Paper, Chip, Divider, Accordion, AccordionSummary, AccordionDetails, Table, TableBody, TableCell, TableHead, TableRow, TableContainer } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'

interface EndpointDetailsProps {
  path: string
  method: string
  endpoint: any
}

const getMethodColor = (method: string): string => {
  switch (method.toLowerCase()) {
    case 'get':
      return '#10B981'
    case 'post':
      return '#3B82F6'
    case 'put':
      return '#F59E0B'
    case 'delete':
      return '#EF4444'
    case 'patch':
      return '#8B5CF6'
    default:
      return '#6B7280'
  }
}

export default function EndpointDetails({ path, method, endpoint }: EndpointDetailsProps): React.JSX.Element {
  const parameters = endpoint.parameters || []
  
  const requestBody = endpoint.requestBody
  const responses = endpoint.responses || {}

  return (
    <Box sx={{ mb: 4 }} id={`endpoint-${method}-${path.replace(/[/\\?%*:|"<>]/g, '-')}`}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1.5 }}>
        <Chip
          label={method.toUpperCase()}
          size="medium"
          sx={{
            backgroundColor: 'transparent',
            border: `1px solid ${getMethodColor(method)}`,
            color: getMethodColor(method),
            fontWeight: 800,
            fontSize: '0.8rem',
          }}
        />
        <Typography variant="h6" sx={{ fontFamily: 'monospace', fontWeight: 700 }}>
          {path}
        </Typography>
      </Box>

      {endpoint.summary && (
        <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
          {endpoint.summary}
        </Typography>
      )}
      {endpoint.description && (
        <Typography variant="body2" sx={{ mb: 3, color: 'text.secondary' }}>
          {endpoint.description}
        </Typography>
      )}

      {/* Parameters */}
      {parameters.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, textTransform: 'uppercase', color: 'text.secondary', fontSize: '0.75rem' }}>
            Parameters
          </Typography>
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
            <Table size="small">
              <TableHead sx={{ bgcolor: 'action.hover' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>In</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Required</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Description</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {parameters.map((param: any, idx: number) => (
                  <TableRow key={idx}>
                    <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{param.name}</TableCell>
                    <TableCell>
                      <Chip label={param.in} size="small" sx={{ fontSize: '0.65rem', height: 20 }} />
                    </TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                      {param.schema ? param.schema.type : param.type || 'any'}
                    </TableCell>
                    <TableCell>{param.required ? 'Yes' : 'No'}</TableCell>
                    <TableCell sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>{param.description}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* Request Body */}
      {requestBody && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, textTransform: 'uppercase', color: 'text.secondary', fontSize: '0.75rem' }}>
            Request Body
          </Typography>
          {requestBody.description && (
            <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
              {requestBody.description}
            </Typography>
          )}
          {requestBody.content && Object.keys(requestBody.content).map((contentType) => (
            <Accordion key={contentType} variant="outlined" sx={{ borderRadius: '8px !important', '&:before': { display: 'none' } }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{contentType}</Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ bgcolor: 'background.default', borderTop: '1px solid', borderColor: 'divider', overflowX: 'auto' }}>
                <pre style={{ margin: 0, fontSize: '0.75rem', fontFamily: 'monospace' }}>
                  {JSON.stringify(requestBody.content[contentType]?.schema ?? {}, null, 2)}
                </pre>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      )}

      {/* Responses */}
      {Object.keys(responses).length > 0 && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5, textTransform: 'uppercase', color: 'text.secondary', fontSize: '0.75rem' }}>
            Responses
          </Typography>
          {Object.keys(responses).map((status) => {
            const response = responses[status]
            return (
              <Accordion key={status} variant="outlined" sx={{ borderRadius: '8px !important', mb: 1, '&:before': { display: 'none' } }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        fontWeight: 800, 
                        color: status.startsWith('2') ? 'success.main' : status.startsWith('4') || status.startsWith('5') ? 'error.main' : 'text.primary' 
                      }}
                    >
                      {status}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                      {response.description}
                    </Typography>
                  </Box>
                </AccordionSummary>
                {response.content && (
                  <AccordionDetails sx={{ bgcolor: 'background.default', borderTop: '1px solid', borderColor: 'divider', overflowX: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {Object.keys(response.content).map((contentType) => (
                      <Box key={contentType}>
                        <Typography variant="caption" sx={{ fontWeight: 600, mb: 1, display: 'block' }}>{contentType}</Typography>
                        <pre style={{ margin: 0, fontSize: '0.75rem', fontFamily: 'monospace', background: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '4px' }}>
                          {JSON.stringify(response.content[contentType]?.schema ?? {}, null, 2)}
                        </pre>
                      </Box>
                    ))}
                  </AccordionDetails>
                )}
              </Accordion>
            )
          })}
        </Box>
      )}
      
      <Divider sx={{ mt: 4 }} />
    </Box>
  )
}
