import React, { startTransition, useEffect, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import {
  Box,
  Button,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Select,
  TextField,
  Typography,
  Avatar,
  Badge,
  Tooltip,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import SchemaIcon from '@mui/icons-material/Schema'
import SettingsIcon from '@mui/icons-material/Settings'
import { useAppStore, type ActivePage } from '../store/app.store'
import {
  API_VERIFY_MENU_ITEMS,
  HOME_MENU_ITEM,
  LINUX_SEARCH_FEATURE,
  LINUX_SEARCH_MENU_ITEM,
  LOCAL_LOG_VIEWER_MENU_ITEM,
  REST_VALIDATOR_FEATURE,
  findFeatureByPage,
  type MenuItemDef,
} from '../features/registry'
import { LINUX_SEARCH_ASSISTANT_PAGE_ID } from '../../../modules/linuxSearchAssistant/models'

const SETTINGS_MENU_ITEM: MenuItemDef = {
  id: 'settings',
  label: 'Settings',
  icon: SettingsIcon,
  countKey: null,
}

type NavSectionId = 'apiVerify' | 'linuxSearch' | 'settings'

const SECTION_STORAGE_KEY = 'apiverify.sidebar.sections'

type SectionOpenState = Record<NavSectionId, boolean>

function loadSectionOpen(): SectionOpenState {
  try {
    const raw = localStorage.getItem(SECTION_STORAGE_KEY)
    if (!raw) return { apiVerify: true, linuxSearch: true, settings: true }
    const parsed = JSON.parse(raw) as Partial<SectionOpenState>
    return {
      apiVerify: parsed.apiVerify !== false,
      linuxSearch: parsed.linuxSearch !== false,
      settings: parsed.settings !== false,
    }
  } catch {
    return { apiVerify: true, linuxSearch: true, settings: true }
  }
}

const SidebarNavItem = React.memo(function SidebarNavItem({
  id,
  label,
  icon: Icon,
  count,
  isSelected,
  themeMode,
  collapsed,
  onSelect,
  nested,
}: {
  id: ActivePage
  label: string
  icon: React.ComponentType<{ sx?: object }>
  count: number | null
  isSelected: boolean
  themeMode: 'dark' | 'light'
  collapsed: boolean
  onSelect: (page: ActivePage) => void
  nested?: boolean
}): React.JSX.Element {
  const button = (
    <ListItemButton
      onClick={() => startTransition(() => onSelect(id))}
      sx={{
        py: nested ? 1 : 1.25,
        px: collapsed ? 1.25 : nested ? 1.5 : 2,
        pl: collapsed ? undefined : nested ? 2.25 : 2,
        justifyContent: collapsed ? 'center' : 'flex-start',
        borderRadius: '10px',
          color: isSelected ? 'primary.main' : 'text.secondary',
          bgcolor: isSelected
            ? themeMode === 'dark'
              ? 'rgba(59, 130, 246, 0.15)'
              : 'rgba(59, 130, 246, 0.08)'
            : 'transparent',
          position: 'relative',
          transition: 'background-color 0.15s ease, color 0.15s ease',
          '&::before': {
            content: '""',
            position: 'absolute',
            left: 0,
            top: '15%',
            height: '70%',
            width: '4px',
            borderRadius: '0 4px 4px 0',
            bgcolor: 'primary.main',
            transform: isSelected ? 'scaleY(1)' : 'scaleY(0)',
            transition: 'transform 0.15s ease',
          },
          '&:hover': {
            bgcolor: themeMode === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
            color: 'text.primary',
          },
        }}
      >
        <ListItemIcon
          sx={{
            minWidth: collapsed ? 0 : nested ? 30 : 34,
            color: isSelected ? 'primary.main' : 'text.secondary',
            justifyContent: 'center',
          }}
        >
          <Icon sx={{ fontSize: nested ? 20 : 22 }} />
        </ListItemIcon>
        {!collapsed && (
          <>
            <ListItemText
              primary={
                <Typography
                  sx={{
                    fontWeight: isSelected ? 700 : 500,
                    fontSize: nested ? '0.8rem' : '0.85rem',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {label}
                </Typography>
              }
            />
            {count !== null && (
              <Box
                sx={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  px: 1,
                  py: 0.2,
                  borderRadius: '10px',
                  bgcolor: isSelected ? 'primary.main' : themeMode === 'dark' ? '#1E293B' : '#E5E7EB',
                  color: isSelected ? '#FFFFFF' : 'text.secondary',
                }}
              >
                {count}
              </Box>
            )}
          </>
        )}
      </ListItemButton>
  )

  return (
    <ListItem disablePadding sx={{ mb: 0.5 }}>
      {collapsed ? (
        <Tooltip title={label} placement="right">
          {button}
        </Tooltip>
      ) : (
        button
      )}
    </ListItem>
  )
})

const SidebarSection = React.memo(function SidebarSection({
  title,
  open,
  onToggle,
  themeMode,
  children,
  selected,
}: {
  title: string
  open: boolean
  onToggle: () => void
  themeMode: 'dark' | 'light'
  children: React.ReactNode
  selected?: boolean
}): React.JSX.Element {
  return (
    <Box sx={{ mb: 1 }}>
      <ListItemButton
        onClick={onToggle}
        sx={{
          py: 0.75,
          px: 1.25,
          borderRadius: '8px',
          color: selected ? 'primary.main' : 'text.secondary',
          '&:hover': {
            bgcolor: themeMode === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
          },
        }}
      >
        <ListItemText
          primary={
            <Typography
              sx={{
                fontWeight: 700,
                fontSize: '0.68rem',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'inherit',
              }}
            >
              {title}
            </Typography>
          }
        />
        {open ? <ExpandLessIcon sx={{ fontSize: 18 }} /> : <ExpandMoreIcon sx={{ fontSize: 18 }} />}
      </ListItemButton>
      <Collapse in={open} timeout="auto" unmountOnExit={false}>
        <List dense disablePadding sx={{ pt: 0.25 }}>
          {children}
        </List>
      </Collapse>
    </Box>
  )
})

export default React.memo(function AppSidebar(): React.JSX.Element {
  const {
    activePage,
    setActivePage,
    currentUser,
    projects,
    activeProjectId,
    selectProject,
    createProject,
    deleteProject,
    specsCount,
    environmentsCount,
    historyCount,
    schedulesCompletedCount,
    themeMode,
    sidebarCollapsed,
    toggleSidebarCollapsed,
  } = useAppStore(
    useShallow((s) => ({
      activePage: s.activePage,
      setActivePage: s.setActivePage,
      currentUser: s.currentUser,
      projects: s.projects,
      activeProjectId: s.activeProjectId,
      selectProject: s.selectProject,
      createProject: s.createProject,
      deleteProject: s.deleteProject,
      specsCount: s.specs.length,
      environmentsCount: s.environments.length,
      historyCount: s.history.length,
      schedulesCompletedCount: s.schedules.filter((schedule) => schedule.status === 'completed').length,
      themeMode: s.themeMode,
      sidebarCollapsed: s.sidebarCollapsed,
      toggleSidebarCollapsed: s.toggleSidebarCollapsed,
    }))
  )

  const [openProjModal, setOpenProjModal] = useState(false)
  const [newProjName, setNewProjName] = useState('')
  const [deleteProjectConfirm, setDeleteProjectConfirm] = useState(false)
  const [linuxSearchEnabled, setLinuxSearchEnabled] = useState(true)
  const [sectionOpen, setSectionOpen] = useState<SectionOpenState>(loadSectionOpen)

  const toggleSection = (id: NavSectionId): void => {
    setSectionOpen((prev) => {
      const next = { ...prev, [id]: !prev[id] }
      try {
        localStorage.setItem(SECTION_STORAGE_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }

  useEffect(() => {
    let cancelled = false
    void window.api
      .linuxSearchAssistantGetStatus()
      .then((status) => {
        if (!cancelled) setLinuxSearchEnabled(status.enabled)
      })
      .catch(() => {
        if (!cancelled) setLinuxSearchEnabled(false)
      })
    return () => {
      cancelled = true
    }
  }, [activePage])

  useEffect(() => {
    if (!linuxSearchEnabled && activePage === LINUX_SEARCH_ASSISTANT_PAGE_ID) {
      setActivePage('home')
    }
  }, [linuxSearchEnabled, activePage, setActivePage])

  // Keep the section containing the active page expanded.
  useEffect(() => {
    // Derive the section from the registry (single source of truth for
    // which feature owns a page) instead of re-listing page ids here.
    const sectionForPage = (page: ActivePage): NavSectionId | null => {
      const feature = findFeatureByPage(page)
      if (feature?.id === REST_VALIDATOR_FEATURE.id) return 'apiVerify'
      if (feature?.id === LINUX_SEARCH_FEATURE.id) return 'linuxSearch'
      if (page === 'settings') return 'settings'
      return null
    }
    const section = sectionForPage(activePage)
    if (!section) return
    setSectionOpen((prev) => {
      if (prev[section]) return prev
      const next = { ...prev, [section]: true }
      try {
        localStorage.setItem(SECTION_STORAGE_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }, [activePage])

  // Which feature owns the current page (home/settings → none).
  const activeFeature = useMemo(() => findFeatureByPage(activePage), [activePage])

  const navSections = useMemo(() => {
    const sections: Array<{
      id: NavSectionId
      title: string
      items: MenuItemDef[]
    }> = []
    if (activeFeature?.id === REST_VALIDATOR_FEATURE.id) {
      sections.push({ id: 'apiVerify', title: 'API Verification', items: API_VERIFY_MENU_ITEMS })
    } else if (activeFeature?.id === LINUX_SEARCH_FEATURE.id) {
      if (linuxSearchEnabled) {
        sections.push({
          id: 'linuxSearch',
          title: 'Linux Search Assistant',
          items: [LINUX_SEARCH_MENU_ITEM, LOCAL_LOG_VIEWER_MENU_ITEM],
        })
      } else {
        // Local viewer does not need SSH / LSA enablement.
        sections.push({
          id: 'linuxSearch',
          title: 'Log tools',
          items: [LOCAL_LOG_VIEWER_MENU_ITEM],
        })
      }
    }
    sections.push({ id: 'settings', title: 'Settings', items: [SETTINGS_MENU_ITEM] })
    return sections
  }, [activeFeature, linuxSearchEnabled])

  const flatMenuItems = useMemo(
    () => [HOME_MENU_ITEM, ...navSections.flatMap((section) => section.items)],
    [navSections]
  )

  const counts: Record<string, number> = {
    projects: projects.length,
    environments: environmentsCount,
    specs: specsCount,
    history: historyCount,
    schedulesCompleted: schedulesCompletedCount,
  }

  const renderNavItem = (item: MenuItemDef, nested: boolean): React.JSX.Element => (
    <SidebarNavItem
      key={item.id}
      id={item.id}
      label={item.label}
      icon={item.icon}
      count={item.countKey ? counts[item.countKey] || null : null}
      isSelected={activePage === item.id}
      themeMode={themeMode}
      collapsed={sidebarCollapsed}
      onSelect={setActivePage}
      nested={nested}
    />
  )

  const handleCreateProject = async (): Promise<void> => {
    if (!newProjName.trim()) return
    if (!currentUser) {
      setOpenProjModal(false)
      setActivePage('settings')
      return
    }
    await createProject(newProjName.trim())
    setNewProjName('')
    setOpenProjModal(false)
  }

  const handleConfirmDeleteProject = async (): Promise<void> => {
    if (!activeProjectId) return
    await deleteProject(activeProjectId)
    setDeleteProjectConfirm(false)
  }

  const profileInitials = currentUser?.name
    ? currentUser.name
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => part[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : '?'

  const sidebarWidth = sidebarCollapsed ? 72 : 280

  return (
    <>
      <Box
        sx={{
          width: sidebarWidth,
          minWidth: sidebarWidth,
          borderRight: '1px solid',
          borderColor: 'divider',
          bgcolor: themeMode === 'dark' ? '#0F172A' : '#FFFFFF',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 10,
          transition: 'width 0.2s ease, min-width 0.2s ease',
        }}
      >
        <Box
          role="button"
          tabIndex={0}
          aria-label="Go to Home"
          onClick={() => startTransition(() => setActivePage('home'))}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              startTransition(() => setActivePage('home'))
            }
          }}
          sx={{
            p: sidebarCollapsed ? 1.5 : 2.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
            gap: 1.5,
            cursor: 'pointer',
            borderRadius: 2,
            '&:hover': { bgcolor: 'action.hover' },
          }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 36,
              height: 36,
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
              boxShadow: '0 4px 10px rgba(59, 130, 246, 0.3)',
              flexShrink: 0,
            }}
          >
            <SchemaIcon sx={{ fontSize: 20, color: '#FFFFFF' }} />
          </Box>
          {!sidebarCollapsed && (
            <Typography
              variant="h6"
              sx={{
                fontWeight: 800,
                fontSize: '1.2rem',
                color: 'text.primary',
                letterSpacing: '-0.03em',
                background: 'linear-gradient(to right, #3B82F6, #60A5FA)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: themeMode === 'dark' ? 'transparent' : 'inherit',
              }}
            >
              APIVerify
            </Typography>
          )}
        </Box>

        <Divider sx={{ mx: sidebarCollapsed ? 1 : 2, opacity: 0.6 }} />

        {!sidebarCollapsed && (
          <>
            <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0, overflow: 'hidden' }}>
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  fontSize: '0.7rem',
                }}
              >
                Workspace
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', width: '100%', minWidth: 0 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Select
                    value={activeProjectId || ''}
                    onChange={(e) => selectProject(e.target.value)}
                    fullWidth
                    size="small"
                    sx={{
                      height: 38,
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      color: 'text.primary',
                      bgcolor: themeMode === 'dark' ? '#1E293B' : '#F9FAFB',
                      borderRadius: '8px',
                      '.MuiOutlinedInput-notchedOutline': { borderColor: 'divider' },
                      '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.main' },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'primary.main',
                        borderWidth: '1px',
                      },
                      '.MuiSelect-select': {
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      },
                    }}
                  >
                    {projects.map((proj) => (
                      <MenuItem key={proj.id} value={proj.id}>
                        {proj.name}
                      </MenuItem>
                    ))}
                  </Select>
                </Box>
                <IconButton
                  size="small"
                  onClick={() => {
                    if (!currentUser) {
                      setActivePage('settings')
                      return
                    }
                    setOpenProjModal(true)
                  }}
                  sx={{
                    flexShrink: 0,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: '8px',
                    color: 'text.secondary',
                    width: 38,
                    height: 38,
                    bgcolor: themeMode === 'dark' ? '#1E293B' : '#F9FAFB',
                  }}
                >
                  <AddIcon fontSize="small" />
                </IconButton>
                {projects.length > 1 && activeProjectId && (
                  <IconButton
                    size="small"
                    onClick={() => setDeleteProjectConfirm(true)}
                    sx={{
                      flexShrink: 0,
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: '8px',
                      color: 'error.main',
                      width: 38,
                      height: 38,
                      bgcolor: themeMode === 'dark' ? '#1E293B' : '#F9FAFB',
                    }}
                  >
                    <DeleteOutlinedIcon fontSize="small" />
                  </IconButton>
                )}
              </Box>
            </Box>

            <Divider sx={{ mx: 2, opacity: 0.6 }} />
          </>
        )}

        <Box sx={{ flexGrow: 1, overflowY: 'auto', p: sidebarCollapsed ? 1 : 1.5 }}>
          {sidebarCollapsed ? (
            <List dense disablePadding>
              {flatMenuItems.map((item) => renderNavItem(item, false))}
            </List>
          ) : (
            <>
              <Box sx={{ mb: 0.5 }}>{renderNavItem(HOME_MENU_ITEM, false)}</Box>
              {navSections.map((section) => (
                <SidebarSection
                  key={section.id}
                  title={section.title}
                  open={sectionOpen[section.id]}
                  onToggle={() => toggleSection(section.id)}
                  themeMode={themeMode}
                  selected={section.items.some((item) => item.id === activePage)}
                >
                  {section.items.map((item) => renderNavItem(item, true))}
                </SidebarSection>
              ))}
            </>
          )}
        </Box>

        <Box sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
          <ListItemButton
            onClick={() => startTransition(() => setActivePage('settings'))}
            sx={{
              p: sidebarCollapsed ? 1.5 : 2,
              bgcolor: themeMode === 'dark' ? '#0B0F19' : '#F9FAFB',
              alignItems: 'center',
              justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
              gap: 1.5,
              borderRadius: 0,
              '&:hover': {
                bgcolor: themeMode === 'dark' ? '#111827' : '#F3F4F6',
              },
            }}
          >
            <Tooltip title={sidebarCollapsed ? (currentUser?.name ?? 'Settings') : ''} placement="right">
              <Badge
                overlap="circular"
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                variant="dot"
                sx={{
                  '& .MuiBadge-badge': {
                    backgroundColor: '#10B981',
                    color: '#10B981',
                    boxShadow: `0 0 0 2px ${themeMode === 'dark' ? '#0B0F19' : '#F9FAFB'}`,
                  },
                }}
              >
                <Avatar sx={{ width: 40, height: 40, bgcolor: 'primary.main', fontWeight: 700, fontSize: '0.95rem' }}>
                  {profileInitials}
                </Avatar>
              </Badge>
            </Tooltip>
            {!sidebarCollapsed && (
              <>
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography variant="body2" noWrap sx={{ fontWeight: 700, color: 'text.primary', fontSize: '0.85rem' }}>
                    {currentUser?.name ?? 'Set up profile'}
                  </Typography>
                  <Typography variant="caption" noWrap sx={{ display: 'block', color: 'text.secondary', fontSize: '0.75rem' }}>
                    {currentUser?.email ?? 'Click to open Settings'}
                  </Typography>
                </Box>
                <SettingsIcon fontSize="small" sx={{ color: 'text.secondary', flexShrink: 0 }} />
              </>
            )}
          </ListItemButton>

          <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
            <IconButton
              size="small"
              onClick={toggleSidebarCollapsed}
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: '8px',
                color: 'text.secondary',
              }}
            >
              {sidebarCollapsed ? <ChevronRightIcon fontSize="small" /> : <ChevronLeftIcon fontSize="small" />}
            </IconButton>
          </Box>
        </Box>
      </Box>

      <Dialog open={openProjModal} onClose={() => setOpenProjModal(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ color: 'text.primary', fontWeight: 700 }}>New Workspace</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Workspace Name"
            fullWidth
            variant="outlined"
            value={newProjName}
            onChange={(e) => setNewProjName(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setOpenProjModal(false)} sx={{ color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button onClick={handleCreateProject} variant="contained" disabled={!newProjName.trim()}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteProjectConfirm} onClose={() => setDeleteProjectConfirm(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: 'error.main' }}>Delete Workspace?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'text.primary' }}>
            Are you sure you want to delete{' '}
            <strong>{projects.find((p) => p.id === activeProjectId)?.name ?? 'this workspace'}</strong>? This will
            permanently delete all associated OpenAPI specs, environments, and validation history. This action cannot
            be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setDeleteProjectConfirm(false)} sx={{ color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button onClick={() => void handleConfirmDeleteProject()} variant="contained" color="error">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
})
