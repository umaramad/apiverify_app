import React, { useMemo } from 'react'
import { Box, Chip, Typography } from '@mui/material'
import { listAvailableVariables, variableToken, type AvailableVariable } from '../../../shared/availableVariables'
import { extractCollectionVariables } from '../../../shared/collectionVariables'
import { useAppStore } from '../store/app.store'
import { useShallow } from 'zustand/react/shallow'

const SOURCE_LABEL: Record<AvailableVariable['source'], string> = {
  environment: 'Environment',
  collection: 'Collection',
  runtime: 'Runtime',
}

const SOURCE_COLOR: Record<AvailableVariable['source'], 'primary' | 'secondary' | 'success'> = {
  environment: 'primary',
  collection: 'secondary',
  runtime: 'success',
}

export interface VariableInserterBarProps {
  onInsert: (token: string, variableName?: string) => void
  includeRuntime?: boolean
  compact?: boolean
}

export default function VariableInserterBar({
  onInsert,
  includeRuntime = true,
  compact = false,
}: VariableInserterBarProps): React.JSX.Element | null {
  const { environments, activeEnvId, parsedSpec, collectionRuntimeVariables } = useAppStore(
    useShallow((s) => ({
      environments: s.environments,
      activeEnvId: s.activeEnvId,
      parsedSpec: s.parsedSpec,
      collectionRuntimeVariables: s.collectionRuntimeVariables,
    }))
  )

  const variables = useMemo(() => {
    const environment = environments.find((env) => env.id === activeEnvId)
    return listAvailableVariables({
      environmentVariables: environment?.variables,
      collectionVariables: parsedSpec ? extractCollectionVariables(parsedSpec) : [],
      runtimeVariables: includeRuntime ? collectionRuntimeVariables : {},
    })
  }, [environments, activeEnvId, parsedSpec, collectionRuntimeVariables, includeRuntime])

  if (variables.length === 0) {
    return (
      <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
        No variables available. Add environment or collection variables to insert {'{{name}}'} tokens.
      </Typography>
    )
  }

  const grouped = variables.reduce<Record<AvailableVariable['source'], AvailableVariable[]>>(
    (acc, variable) => {
      acc[variable.source].push(variable)
      return acc
    },
    { environment: [], collection: [], runtime: [] }
  )

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: compact ? 0.75 : 1 }}>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
        Insert variable
      </Typography>
      {(['environment', 'collection', 'runtime'] as const).map((source) => {
        const items = grouped[source]
        if (items.length === 0) return null

        return (
          <Box key={source} sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, alignItems: 'center' }}>
            <Typography variant="caption" color="text.secondary" sx={{ minWidth: 72, fontWeight: 600 }}>
              {SOURCE_LABEL[source]}
            </Typography>
            {items.map((variable) => (
              <Chip
                key={`${source}-${variable.name}`}
                label={variable.name}
                size="small"
                color={SOURCE_COLOR[source]}
                variant="outlined"
                title={variable.preview ? `${variable.name}: ${variable.preview}` : variable.name}
                onClick={() => onInsert(variableToken(variable.name), variable.name)}
                sx={{ fontFamily: 'monospace', fontSize: '0.7rem', height: 24, cursor: 'pointer' }}
              />
            ))}
          </Box>
        )
      })}
    </Box>
  )
}
