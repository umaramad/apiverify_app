/**
 * Home — feature landing page.
 * Renders one card per registered feature (see features/registry.ts).
 * Clicking a card opens the feature's default page; the sidebar then scopes
 * itself to that feature's menus.
 */
import React, { startTransition, useEffect, useState } from 'react'
import { Box, Button, Chip, Typography, alpha, Tooltip, useTheme } from '@mui/material'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'
import { FEATURES, LINUX_SEARCH_FEATURE, type FeatureDef } from '../features/registry'
import { useAppStore } from '../store/app.store'

function FeatureCard({
  feature,
  disabled,
  disabledReason,
}: {
  feature: FeatureDef
  disabled?: boolean
  disabledReason?: string
}): React.JSX.Element {
  const theme = useTheme()
  const setActivePage = useAppStore((s) => s.setActivePage)
  const Icon = feature.icon

  const card = (
    <Button
      fullWidth
      disabled={disabled}
      onClick={() => startTransition(() => setActivePage(feature.defaultPage))}
      sx={{
        position: 'relative',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
        gap: 2,
        p: 2.5,
        textAlign: 'left',
        textTransform: 'none',
        color: 'text.primary',
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: '16px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
        transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease',
        '&:hover': {
          transform: 'translateY(-3px)',
          borderColor: 'primary.main',
          boxShadow: `0 10px 28px ${alpha(theme.palette.primary.main, 0.16)}`,
        },
        '&:focus-visible': {
          outline: '2px solid',
          outlineColor: 'primary.main',
          outlineOffset: 2,
        },
        ...(disabled
          ? {
              opacity: 0.55,
              cursor: 'not-allowed',
              '&:hover': {
                transform: 'none',
                borderColor: 'divider',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.06)',
              },
            }
          : {}),
      }}
    >
      <Box
        sx={{
          flexShrink: 0,
          width: 56,
          height: 56,
          borderRadius: '14px',
          background: feature.gradient,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#FFFFFF',
          boxShadow: `0 6px 14px ${alpha(theme.palette.common.black, 0.18)}`,
        }}
      >
        <Icon sx={{ fontSize: 30 }} />
      </Box>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <Typography
            variant="subtitle1"
            sx={{ fontWeight: 800, fontSize: '1.05rem', letterSpacing: '-0.01em' }}
          >
            {feature.name}
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.85rem' }}>
            {feature.tagline}
          </Typography>
        </Box>
        <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.85rem', lineHeight: 1.5 }}>
          {feature.description}
        </Typography>
      </Box>

      {disabled ? (
        <Chip
          size="small"
          label={disabledReason ?? 'Unavailable'}
          sx={{ alignSelf: 'center', flexShrink: 0, fontSize: '0.68rem', fontWeight: 700 }}
        />
      ) : (
        <Box
          component="span"
          sx={{
            flexShrink: 0,
            alignSelf: 'center',
            width: 34,
            height: 34,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'text.secondary',
            border: '1px solid',
            borderColor: 'divider',
            transition: 'background-color 0.18s ease, color 0.18s ease, border-color 0.18s ease',
            '.MuiButton-root:hover &': {
              bgcolor: 'primary.main',
              borderColor: 'primary.main',
              color: '#FFFFFF',
            },
          }}
        >
          <ArrowForwardIcon sx={{ fontSize: 18 }} />
        </Box>
      )}
    </Button>
  )

  if (disabled) {
    return <Tooltip title="Enable it in Settings to use this tool">{card}</Tooltip>
  }
  return card
}

export default function HomePage(): React.JSX.Element {
  const [lsaEnabled, setLsaEnabled] = useState(true)

  // Mirror the sidebar's status fetch so the LSA card reflects the
  // Settings toggle instead of bouncing the user back after a click.
  useEffect(() => {
    let cancelled = false
    void window.api
      .linuxSearchAssistantGetStatus()
      .then((status) => {
        if (!cancelled) setLsaEnabled(status.enabled)
      })
      .catch(() => {
        if (!cancelled) setLsaEnabled(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <Box
      sx={{
        flex: 1,
        height: '100%',
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        px: 3,
        py: 5,
      }}
    >
      <Box sx={{ width: '100%', maxWidth: 820, display: 'flex', flexDirection: 'column', gap: 1.5, mb: 4 }}>
        <Chip
          size="small"
          icon={<AutoAwesomeOutlinedIcon sx={{ fontSize: 14 }} />}
          label="APIVerify"
          sx={{ alignSelf: 'flex-start', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.06, fontSize: '0.68rem' }}
        />
        <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.03em' }}>
          Choose a tool
        </Typography>
        <Typography variant="body1" sx={{ color: 'text.secondary', fontSize: '0.95rem' }}>
          Pick a feature to open its workspace. The sidebar shows only the menus for the active
          feature — switch anytime from Home.
        </Typography>
      </Box>

      <Box
        sx={{
          width: '100%',
          maxWidth: 820,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
          gap: 2.5,
        }}
      >
        {FEATURES.map((feature) => {
          const lsaDisabled = feature.id === LINUX_SEARCH_FEATURE.id && !lsaEnabled
          return (
            <FeatureCard
              key={feature.id}
              feature={feature}
              disabled={lsaDisabled}
              disabledReason={lsaDisabled ? 'Disabled in Settings' : undefined}
            />
          )
        })}
      </Box>

      <Typography variant="caption" sx={{ color: 'text.disabled', mt: 4 }}>
        More tools are on the way — this launcher grows with each new feature.
      </Typography>
    </Box>
  )
}
