import React from 'react'
import {
  Box,
  Divider,
  IconButton,
  InputBase,
  Tooltip,
  Typography,
  Badge,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined'
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined'
import WifiIcon from '@mui/icons-material/Wifi'
import NotificationsOutlinedIcon from '@mui/icons-material/NotificationsOutlined'
import { useAppStore } from '../store/app.store'
import { useShallow } from 'zustand/react/shallow'
import EnvSelector from './EnvSelector'

const PAGE_TITLES: Record<string, string> = {
  home: 'Home',
  dashboard: 'Dashboard',
  projects: 'Workspaces',
  environments: 'Environments',
  apis: 'API Specifications',
  runner: 'Validation Runner',
  scheduler: 'Scheduler',
  results: 'Validation Results',
  reports: 'Reports',
  linuxSearchAssistant: 'Linux Search Assistant',
  localLogViewer: 'Local Log Viewer',
  settings: 'Settings',
}

export default React.memo(function AppHeader(): React.JSX.Element {
  const { activePage, activeProjectId, activeProjectName, themeMode, setThemeMode } = useAppStore(
    useShallow((s) => ({
      activePage: s.activePage,
      activeProjectId: s.activeProjectId,
      activeProjectName: s.projects.find((p) => p.id === s.activeProjectId)?.name,
      themeMode: s.themeMode,
      setThemeMode: s.setThemeMode,
    }))
  )

  const pageTitle = PAGE_TITLES[activePage] ?? 'APIVerify'

  const toggleTheme = (): void => {
    setThemeMode(themeMode === 'light' ? 'dark' : 'light')
  }

  return (
    <Box
      sx={{
        height: 60,
        bgcolor: 'background.paper',
        borderBottom: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        px: 3,
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.02)',
        zIndex: 5,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Typography
          variant="h6"
          sx={{
            color: 'text.primary',
            fontWeight: 800,
            fontSize: '1.25rem',
            letterSpacing: '-0.02em',
          }}
        >
          {pageTitle}
        </Typography>
        {activeProjectId && activeProjectName && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              bgcolor: themeMode === 'dark' ? '#1E293B' : '#F3F4F6',
              px: 1.5,
              py: 0.4,
              borderRadius: '6px',
              border: '1px solid',
              borderColor: 'divider',
            }}
          >
            <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.75rem' }}>
              {activeProjectName}
            </Typography>
          </Box>
        )}
      </Box>

      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          alignItems: 'center',
          bgcolor: themeMode === 'dark' ? '#0B0F19' : '#F3F4F6',
          px: 1.5,
          py: 0.5,
          borderRadius: '8px',
          width: 320,
          border: '1px solid',
          borderColor: 'transparent',
          transition: 'border-color 0.15s, background-color 0.15s',
          '&:focus-within': {
            borderColor: 'primary.main',
            bgcolor: 'background.paper',
            boxShadow: '0 0 0 2px rgba(59, 130, 246, 0.1)',
          },
        }}
      >
        <SearchIcon sx={{ color: 'text.secondary', mr: 1, fontSize: 18 }} />
        <InputBase
          placeholder="Search endpoints, rules, history..."
          sx={{
            fontSize: '0.825rem',
            color: 'text.primary',
            flexGrow: 1,
            '& input::placeholder': {
              color: 'text.secondary',
              opacity: 0.8,
            },
          }}
        />
        <Box
          sx={{
            fontSize: '0.7rem',
            fontWeight: 700,
            color: 'text.secondary',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: '4px',
            px: 0.6,
            py: 0.1,
            bgcolor: themeMode === 'dark' ? '#1E293B' : '#FFFFFF',
          }}
        >
          ⌘K
        </Box>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Tooltip title="Network Connectivity: Live & Validating">
          <Box
            sx={{
              display: { xs: 'none', sm: 'flex' },
              alignItems: 'center',
              gap: 1,
              px: 1.5,
              py: 0.5,
              borderRadius: '20px',
              border: '1px solid',
              borderColor: 'divider',
              bgcolor: 'rgba(16, 185, 129, 0.05)',
            }}
          >
            <Box
              sx={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                bgcolor: '#10B981',
              }}
            />
            <Typography
              variant="caption"
              sx={{
                color: '#10B981',
                fontWeight: 700,
                fontSize: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
              }}
            >
              <WifiIcon sx={{ fontSize: 11 }} /> Live
            </Typography>
          </Box>
        </Tooltip>

        <EnvSelector />

        <Divider orientation="vertical" variant="middle" flexItem sx={{ mx: 0.5 }} />

        <IconButton
          size="small"
          sx={{
            color: 'text.secondary',
            bgcolor: themeMode === 'dark' ? '#1E293B' : '#F3F4F6',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: '8px',
            width: 36,
            height: 36,
          }}
        >
          <Badge color="error" variant="dot" invisible={false}>
            <NotificationsOutlinedIcon fontSize="small" />
          </Badge>
        </IconButton>

        <Tooltip title={themeMode === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
          <IconButton
            onClick={toggleTheme}
            size="small"
            sx={{
              color: 'text.secondary',
              bgcolor: themeMode === 'dark' ? '#1E293B' : '#F3F4F6',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: '8px',
              width: 36,
              height: 36,
            }}
          >
            {themeMode === 'dark' ? (
              <LightModeOutlinedIcon fontSize="small" />
            ) : (
              <DarkModeOutlinedIcon fontSize="small" />
            )}
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  )
})
