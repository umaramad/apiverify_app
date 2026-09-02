import React, { useMemo, useState } from 'react'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
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
  type SxProps,
  type Theme,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { useAppStore } from '../store/app.store'
import { useShallow } from 'zustand/react/shallow'
import { buildCollectionVariableMap, extractCollectionVariables } from '../../../shared/collectionVariables'
import { isManualCollection } from '../../../shared/manualCollection'
import { resolveEditorRequest } from '../../../shared/engine/resolveEditorRequest'
import { getExplicitCollectionServerUrl } from '../../../shared/engine/requestBuilder'
import { isSensitiveKey } from '../../../shared/security/redact'

function maskValue(key: string, value: string): string {
  return isSensitiveKey(key) || /token|secret|password/i.test(key) ? '••••••••' : value
}

interface ResolvedRequestPreviewProps {
  /** Fills the request tab panel and scrolls within parent bounds */
  embedded?: boolean
}

export default function ResolvedRequestPreview({
  embedded = false,
}: ResolvedRequestPreviewProps): React.JSX.Element | null {
  const { request, environments, activeEnvId, parsedSpec, collectionChainVariables } = useAppStore(
    useShallow((s) => ({
      request: s.request,
      environments: s.environments,
      activeEnvId: s.activeEnvId,
      parsedSpec: s.parsedSpec,
      collectionChainVariables: s.collectionChainVariables,
    }))
  )

  const [expandedSection, setExpandedSection] = useState<string | false>('variables')

  const preview = useMemo(() => {
    const environment = environments.find((env) => env.id === activeEnvId)
    if (!environment) return null

    const isManual = parsedSpec ? isManualCollection(parsedSpec) : false
    const variables = isManual
      ? buildCollectionVariableMap(
          environment,
          extractCollectionVariables(parsedSpec),
          collectionChainVariables,
          getExplicitCollectionServerUrl(parsedSpec)
        )
      : environment.variables

    return resolveEditorRequest(request, {
      variables,
      baseUrl: environment.baseUrl,
      defaultHeaders: environment.defaultHeaders,
      envAuth: environment.authConfig,
      isManualCollection: isManual,
      specBaseUrl: isManual ? getExplicitCollectionServerUrl(parsedSpec) : undefined,
    })
  }, [request, environments, activeEnvId, parsedSpec, collectionChainVariables])

  const embeddedShellSx: SxProps<Theme> = {
    flex: 1,
    minHeight: 0,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    bgcolor: 'background.paper',
  }

  const standaloneShellSx: SxProps<Theme> = {
    mx: 2,
    mt: 2,
    mb: 0,
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    minHeight: 0,
  }

  const shellSx = embedded ? embeddedShellSx : standaloneShellSx

  if (!activeEnvId) {
    return (
      <Paper variant="outlined" sx={{ ...shellSx, p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Select an active environment to preview resolved URL, headers, and body values.
        </Typography>
      </Paper>
    )
  }

  if (!preview) return null

  const headerEntries = Object.entries(preview.headers)
  const variableEntries = Object.entries(preview.variables).sort(([a], [b]) => a.localeCompare(b))

  const handleSectionChange =
    (panel: string) =>
    (_: React.SyntheticEvent, isExpanded: boolean): void => {
      setExpandedSection(isExpanded ? panel : false)
    }

  const content = (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        overflowX: 'hidden',
        px: embedded ? 2 : 0,
        py: embedded ? 1.5 : 0,
      }}
    >
      <Accordion
        expanded={expandedSection === 'url'}
        onChange={handleSectionChange('url')}
        disableGutters
        elevation={0}
        sx={{ '&:before': { display: 'none' }, borderBottom: '1px solid', borderColor: 'divider' }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 40, '& .MuiAccordionSummary-content': { my: 0.5 } }}>
          <Typography variant="caption" sx={{ fontWeight: 700 }}>
            Resolved URL
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 0, pb: 1.5 }}>
          <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>
            <Chip label={preview.method} size="small" sx={{ mr: 1, height: 20, fontWeight: 700 }} />
            {preview.url}
          </Typography>
        </AccordionDetails>
      </Accordion>

      <Accordion
        expanded={expandedSection === 'variables'}
        onChange={handleSectionChange('variables')}
        disableGutters
        elevation={0}
        sx={{ '&:before': { display: 'none' }, borderBottom: '1px solid', borderColor: 'divider' }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 40, '& .MuiAccordionSummary-content': { my: 0.5 } }}>
          <Typography variant="caption" sx={{ fontWeight: 700 }}>
            Runtime Variables ({variableEntries.length})
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 0, pb: 1.5 }}>
          {variableEntries.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              No variables in scope.
            </Typography>
          ) : (
            <TableContainer>
              <Table size="small" sx={{ tableLayout: 'fixed', width: '100%' }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 700, width: '32%' }}>Key</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Resolved Value</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {variableEntries.map(([key, value]) => (
                    <TableRow key={key}>
                      <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600, verticalAlign: 'top', wordBreak: 'break-all' }}>
                        {key}
                      </TableCell>
                      <TableCell
                        sx={{
                          fontFamily: 'monospace',
                          wordBreak: 'break-all',
                          whiteSpace: 'pre-wrap',
                          verticalAlign: 'top',
                        }}
                      >
                        {maskValue(key, value)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </AccordionDetails>
      </Accordion>

      {headerEntries.length > 0 && (
        <Accordion
          expanded={expandedSection === 'headers'}
          onChange={handleSectionChange('headers')}
          disableGutters
          elevation={0}
          sx={{ '&:before': { display: 'none' }, borderBottom: '1px solid', borderColor: 'divider' }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 40, '& .MuiAccordionSummary-content': { my: 0.5 } }}>
            <Typography variant="caption" sx={{ fontWeight: 700 }}>
              Headers ({headerEntries.length})
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0, pb: 1.5 }}>
            <TableContainer>
              <Table size="small" sx={{ tableLayout: 'fixed', width: '100%' }}>
                <TableBody>
                  {headerEntries.map(([key, value]) => (
                    <TableRow key={key}>
                      <TableCell
                        sx={{ fontFamily: 'monospace', fontWeight: 600, width: '32%', verticalAlign: 'top', wordBreak: 'break-all' }}
                      >
                        {key}
                      </TableCell>
                      <TableCell
                        sx={{
                          fontFamily: 'monospace',
                          wordBreak: 'break-all',
                          whiteSpace: 'pre-wrap',
                          verticalAlign: 'top',
                        }}
                      >
                        {value}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </AccordionDetails>
        </Accordion>
      )}

      {preview.body && (
        <Accordion
          expanded={expandedSection === 'body'}
          onChange={handleSectionChange('body')}
          disableGutters
          elevation={0}
          sx={{ '&:before': { display: 'none' } }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 40, '& .MuiAccordionSummary-content': { my: 0.5 } }}>
            <Typography variant="caption" sx={{ fontWeight: 700 }}>
              Body
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0, pb: 1.5 }}>
            <Typography
              component="pre"
              sx={{
                m: 0,
                p: 1.25,
                bgcolor: 'action.hover',
                borderRadius: 1,
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                overflowX: 'auto',
              }}
            >
              {preview.body}
            </Typography>
          </AccordionDetails>
        </Accordion>
      )}
    </Box>
  )

  if (embedded) {
    return (
      <Box sx={shellSx}>
        <Box sx={{ px: 2, py: 1, flexShrink: 0, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'action.hover' }}>
          <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.8rem' }}>
            Resolved Request Preview
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            Values after {'{{variable}}'} substitution — this is what Send will use
          </Typography>
        </Box>
        {content}
      </Box>
    )
  }

  return (
    <Paper variant="outlined" sx={shellSx}>
      <Box sx={{ px: 1.5, py: 1, bgcolor: 'action.hover', flexShrink: 0, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography variant="caption" sx={{ fontWeight: 700, fontSize: '0.8rem' }}>
          Resolved Request Preview
        </Typography>
      </Box>
      {content}
    </Paper>
  )
}
