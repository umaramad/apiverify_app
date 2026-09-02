import React, { useEffect, useState } from 'react'
import { Box, Typography, Paper, Divider, List, ListItem, ListItemText } from '@mui/material'
import SpecExplorer from '../components/SpecExplorer'
import EndpointDetails from '../components/EndpointDetails'
import { useAppStore } from '../store/app.store'
import { isManualCollection } from '../../../shared/manualCollection'

type CollectionWorkspaceComponent = React.ComponentType

export default function APIs(): React.JSX.Element {
  const parsedSpec = useAppStore((s) => s.parsedSpec)
  const isManual = parsedSpec ? isManualCollection(parsedSpec) : false
  const [CollectionWorkspace, setCollectionWorkspace] = useState<CollectionWorkspaceComponent | null>(null)
  const [CollectionWorkspaceLoading, setCollectionWorkspaceLoading] =
    useState<CollectionWorkspaceComponent | null>(null)

  useEffect(() => {
    if (!isManual) {
      setCollectionWorkspace(null)
      setCollectionWorkspaceLoading(null)
      return
    }

    let cancelled = false
    void import('../components/CollectionWorkspace').then((module) => {
      if (!cancelled) {
        setCollectionWorkspace(() => module.default)
        setCollectionWorkspaceLoading(() => module.CollectionWorkspaceLoading)
      }
    })

    return () => {
      cancelled = true
    }
  }, [isManual, parsedSpec?.info?.title])

  return (
    <Box
      sx={{
        p: 4,
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ mb: 3, flexShrink: 0 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 1, color: 'text.primary' }}>
          API Specifications
        </Typography>
        <Typography variant="body1" sx={{ color: 'text.secondary' }}>
          Import OpenAPI/Swagger specs or create API collections manually when no spec file is available.
        </Typography>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '5fr 7fr' },
          gap: 3,
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        {/* Left Side: Spec Explorer Panel */}
        <Box sx={{ minHeight: 0, overflow: 'hidden', display: 'flex' }}>
          <Paper sx={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <SpecExplorer />
          </Paper>
        </Box>

        {/* Right Side: Spec Details or Collection Runner */}
        <Box sx={{ minHeight: 0, overflow: 'hidden', display: 'flex' }}>
          <Paper
            sx={{
              flex: 1,
              minHeight: 0,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {parsedSpec && isManual ? (
              CollectionWorkspace ? (
                <CollectionWorkspace />
              ) : CollectionWorkspaceLoading ? (
                <CollectionWorkspaceLoading />
              ) : null
            ) : (
              <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: 3 }}>
                {parsedSpec ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <Box>
                      <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary', mb: 1 }}>
                        {parsedSpec.info?.title || 'Untitled Spec'}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 2 }}>
                        OpenAPI version: {parsedSpec.openapi || parsedSpec.swagger || '3.x'} | API Version:{' '}
                        {parsedSpec.info?.version || '1.0.0'}
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        {parsedSpec.info?.description || 'No description provided.'}
                      </Typography>
                    </Box>

                    <Divider />

                    {/* Servers */}
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'text.primary', mb: 1.5 }}>
                        Servers / Base URLs
                      </Typography>
                      {parsedSpec.servers && parsedSpec.servers.length > 0 ? (
                        <List dense disablePadding>
                          {parsedSpec.servers.map((srv: any, idx: number) => (
                            <ListItem key={idx} sx={{ bgcolor: 'action.hover', borderRadius: '6px', mb: 1, px: 2, py: 1 }}>
                              <ListItemText
                                primary={
                                  <Typography
                                    variant="body2"
                                    sx={{ fontFamily: 'monospace', fontWeight: 600, color: 'primary.main' }}
                                  >
                                    {srv.url}
                                  </Typography>
                                }
                                secondary={srv.description}
                              />
                            </ListItem>
                          ))}
                        </List>
                      ) : (
                        <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                          No servers defined in this schema.
                        </Typography>
                      )}
                    </Box>

                    <Divider />

                    {/* Path counts */}
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, color: 'text.primary', mb: 1.5 }}>
                        Specifications Metrics
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                        Total Endpoints defined:{' '}
                        <strong>{parsedSpec.paths ? Object.keys(parsedSpec.paths).length : 0}</strong>
                      </Typography>
                    </Box>

                    {parsedSpec.paths && Object.keys(parsedSpec.paths).length > 0 && (
                      <>
                        <Divider />
                        <Box sx={{ mt: 2 }}>
                          <Typography variant="h6" sx={{ fontWeight: 800, mb: 3 }}>
                            Endpoints Overview
                          </Typography>
                          {Object.entries(parsedSpec.paths as Record<string, Record<string, unknown>>).flatMap(
                            ([pathKey, pathObj]) => {
                              if (!pathObj || typeof pathObj !== 'object') return []

                              return Object.keys(pathObj)
                                .filter((method) =>
                                  ['get', 'post', 'put', 'delete', 'patch'].includes(method.toLowerCase())
                                )
                                .map((method) => {
                                  const endpoint = pathObj[method]
                                  if (!endpoint || typeof endpoint !== 'object') return null

                                  return (
                                    <EndpointDetails
                                      key={`${method}-${pathKey}`}
                                      path={pathKey}
                                      method={method}
                                      endpoint={endpoint}
                                    />
                                  )
                                })
                                .filter((item): item is React.JSX.Element => item !== null)
                            }
                          )}
                        </Box>
                      </>
                    )}
                  </Box>
                ) : (
                  <Box sx={{ minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography variant="body1" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
                      Select a specification from the explorer to view detailed schema parameters.
                    </Typography>
                  </Box>
                )}
              </Box>
            )}
          </Paper>
        </Box>
      </Box>
    </Box>
  )
}
