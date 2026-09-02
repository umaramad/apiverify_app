import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Typography,
  Button,
  FormControlLabel,
  Switch,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import StorageIcon from '@mui/icons-material/Storage'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined'
import SettingsEthernetIcon from '@mui/icons-material/SettingsEthernet'
import ExtensionOutlinedIcon from '@mui/icons-material/ExtensionOutlined'
import { useAppStore } from '../store/app.store'
import { DEFAULT_PROXY_SETTINGS, type ProxySettings } from '../../../shared/models/proxySettings'
import PageErrorBoundary from '../components/PageErrorBoundary'

const LinuxSearchAssistantSettingsPanel = lazy(
  () =>
    import('../../../modules/linuxSearchAssistant/renderer/components/LinuxSearchAssistantSettingsPanel')
)

const AskAiSettingsPanel = lazy(
  () => import('../../../modules/linuxSearchAssistant/renderer/components/AskAiSettingsPanel')
)

const SETTINGS_EXPANDED_KEY = 'apiverify.settings.expandedSections'

type SettingsSectionId = 'profile' | 'proxy' | 'appearance' | 'features' | 'database'

const DEFAULT_EXPANDED: Record<SettingsSectionId, boolean> = {
  profile: true,
  proxy: false,
  appearance: false,
  features: false,
  database: false,
}

function loadExpanded(): Record<SettingsSectionId, boolean> {
  try {
    const raw = localStorage.getItem(SETTINGS_EXPANDED_KEY)
    if (!raw) return { ...DEFAULT_EXPANDED }
    const parsed = JSON.parse(raw) as Partial<Record<SettingsSectionId, boolean>>
    return { ...DEFAULT_EXPANDED, ...parsed }
  } catch {
    return { ...DEFAULT_EXPANDED }
  }
}

function getProfileInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
}

interface SettingsAccordionProps {
  id: SettingsSectionId
  expanded: boolean
  onChange: (id: SettingsSectionId, expanded: boolean) => void
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}

function SettingsAccordion({
  id,
  expanded,
  onChange,
  icon,
  title,
  children,
}: SettingsAccordionProps): React.JSX.Element {
  return (
    <Accordion
      disableGutters
      elevation={0}
      expanded={expanded}
      onChange={(_, next) => onChange(id, next)}
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: '8px !important',
        '&:before': { display: 'none' },
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        aria-controls={`settings-${id}-content`}
        id={`settings-${id}-header`}
        sx={{
          px: 2.5,
          minHeight: 52,
          position: 'sticky',
          top: 0,
          zIndex: 1,
          bgcolor: 'background.paper',
          '& .MuiAccordionSummary-content': { my: 1 },
        }}
      >
        <Typography
          variant="h6"
          sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1, color: 'text.primary' }}
        >
          {icon} {title}
        </Typography>
      </AccordionSummary>
      <AccordionDetails
        sx={{
          px: 3,
          pb: 3,
          pt: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          // Keep section body within the viewport so small screens can scroll the content.
          maxHeight: {
            xs: 'min(50vh, 360px)',
            sm: 'min(55vh, 440px)',
            md: 'min(60vh, 520px)',
          },
          overflowY: 'auto',
          overflowX: 'hidden',
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {children}
      </AccordionDetails>
    </Accordion>
  )
}

export default function Settings(): React.JSX.Element {
  const currentUser = useAppStore((s) => s.currentUser)
  const activePage = useAppStore((s) => s.activePage)
  const saveUserProfile = useAppStore((s) => s.saveUserProfile)
  const themeMode = useAppStore((s) => s.themeMode)
  const setThemeMode = useAppStore((s) => s.setThemeMode)
  const activeProjectId = useAppStore((s) => s.activeProjectId)
  const clearHistory = useAppStore((s) => s.clearHistory)

  const [profileName, setProfileName] = useState('')
  const [profileEmail, setProfileEmail] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMessage, setProfileMessage] = useState<string | null>(null)
  const [openResetModal, setOpenResetModal] = useState(false)
  const [openClearHistoryModal, setOpenClearHistoryModal] = useState(false)
  const [proxySettings, setProxySettings] = useState<ProxySettings>(DEFAULT_PROXY_SETTINGS)
  const [proxySaving, setProxySaving] = useState(false)
  const [proxyMessage, setProxyMessage] = useState<string | null>(null)
  const [proxyLoaded, setProxyLoaded] = useState(false)
  const [expanded, setExpanded] = useState<Record<SettingsSectionId, boolean>>(loadExpanded)
  const nameInputRef = useRef<HTMLInputElement>(null)

  const setSectionExpanded = (id: SettingsSectionId, next: boolean): void => {
    setExpanded((prev) => {
      const updated = { ...prev, [id]: next }
      try {
        localStorage.setItem(SETTINGS_EXPANDED_KEY, JSON.stringify(updated))
      } catch {
        /* ignore */
      }
      return updated
    })
  }

  useEffect(() => {
    setProfileName(currentUser?.name ?? '')
    setProfileEmail(currentUser?.email ?? '')
  }, [currentUser])

  useEffect(() => {
    if (activePage === 'settings' && !currentUser) {
      setSectionExpanded('profile', true)
      document.getElementById('settings-profile-header')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      nameInputRef.current?.focus()
    }
  }, [activePage, currentUser])

  useEffect(() => {
    if (activePage !== 'settings') return

    let cancelled = false
    void (async () => {
      try {
        const settings = await window.api.getProxySettings()
        if (!cancelled) {
          setProxySettings(settings)
        }
      } catch (error) {
        console.error('Failed to load proxy settings', error)
        if (!cancelled) {
          setProxyMessage('Could not load saved proxy settings. You can still configure and save them.')
        }
      } finally {
        if (!cancelled) {
          setProxyLoaded(true)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [activePage])

  const profileInitials = useMemo(
    () => getProfileInitials(profileName || currentUser?.name || ''),
    [profileName, currentUser?.name]
  )

  const isProfileDirty =
    profileName.trim() !== (currentUser?.name ?? '') ||
    profileEmail.trim().toLowerCase() !== (currentUser?.email ?? '').toLowerCase()

  const handleSaveProxySettings = async (): Promise<void> => {
    if (proxySettings.enabled && !proxySettings.host.trim()) {
      setProxyMessage('Proxy host is required when proxy is enabled.')
      return
    }

    setProxySaving(true)
    setProxyMessage(null)
    try {
      const saved = await window.api.saveProxySettings({
        ...proxySettings,
        host: proxySettings.host.trim(),
        port: Number(proxySettings.port) || DEFAULT_PROXY_SETTINGS.port,
      })
      setProxySettings(saved)
      setProxyMessage('Proxy settings saved. New requests will use this configuration.')
    } catch {
      setProxyMessage('Could not save proxy settings.')
    } finally {
      setProxySaving(false)
    }
  }

  const updateProxyField = <K extends keyof ProxySettings>(key: K, value: ProxySettings[K]): void => {
    setProxySettings((prev) => ({ ...prev, [key]: value }))
    setProxyMessage(null)
  }

  const handleToggleTheme = (): void => {
    setThemeMode(themeMode === 'light' ? 'dark' : 'light')
  }

  const handleSaveProfile = async (): Promise<void> => {
    const name = profileName.trim()
    const email = profileEmail.trim()
    if (!name || !email) {
      setProfileMessage('Name and email are required.')
      return
    }

    setProfileSaving(true)
    setProfileMessage(null)
    try {
      await saveUserProfile(name, email)
      setProfileMessage(currentUser ? 'Profile updated.' : 'Profile created. Workspaces are now linked to your account.')
    } catch {
      setProfileMessage('Could not save profile. Check your details and try again.')
    } finally {
      setProfileSaving(false)
    }
  }

  const handleClearHistory = async (): Promise<void> => {
    if (activeProjectId) {
      await clearHistory()
    }
    setOpenClearHistoryModal(false)
  }

  const handlePurgeAllData = async (): Promise<void> => {
    const projectsList = currentUser
      ? await window.api.getProjects(currentUser.id)
      : await window.api.getProjects()
    for (const p of projectsList) {
      await window.api.deleteProject(p.id)
    }
    setOpenResetModal(false)
    window.location.reload()
  }

  return (
    <Box
      sx={{
        p: { xs: 2, sm: 3, md: 4 },
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        height: '100%',
        minHeight: 0,
        overflowY: 'auto',
        overflowX: 'hidden',
      }}
    >
      <Box sx={{ mb: 0.5, flexShrink: 0 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5, color: 'text.primary', fontSize: { xs: '1.5rem', sm: '2rem' } }}>
          Settings
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Expand a section to edit. Scroll inside a section if content is taller than the window.
        </Typography>
      </Box>

      <SettingsAccordion
        id="profile"
        expanded={expanded.profile}
        onChange={setSectionExpanded}
        icon={<PersonOutlinedIcon />}
        title="User Profile"
      >
        {!currentUser && (
          <Alert severity="info">
            Create your profile to save your name and email locally. All workspaces you create will be linked to this
            profile.
          </Alert>
        )}

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1 }}>
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              bgcolor: 'primary.main',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '1rem',
            }}
          >
            {profileInitials}
          </Box>
          <Box>
            <Typography variant="body1" sx={{ fontWeight: 700, color: 'text.primary' }}>
              {currentUser ? 'Your profile' : 'Set up your profile'}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Stored securely in the local SQLite database on this machine.
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
          <TextField
            inputRef={nameInputRef}
            label="Name"
            value={profileName}
            onChange={(e) => setProfileName(e.target.value)}
            fullWidth
            required
            placeholder="Alex Developer"
          />
          <TextField
            label="Email"
            type="email"
            value={profileEmail}
            onChange={(e) => setProfileEmail(e.target.value)}
            fullWidth
            required
            placeholder="alex@example.com"
          />
        </Box>

        {profileMessage && (
          <Alert severity={profileMessage.includes('Could not') ? 'error' : 'success'}>{profileMessage}</Alert>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            onClick={handleSaveProfile}
            disabled={profileSaving || !profileName.trim() || !profileEmail.trim() || (!!currentUser && !isProfileDirty)}
          >
            {currentUser ? 'Save Profile' : 'Create Profile'}
          </Button>
        </Box>
      </SettingsAccordion>

      <SettingsAccordion
        id="proxy"
        expanded={expanded.proxy}
        onChange={setSectionExpanded}
        icon={<SettingsEthernetIcon />}
        title="Network Proxy"
      >
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Configure an HTTP proxy for API validation, manual requests, and OAuth token calls when running behind a
          corporate firewall.
        </Typography>

        <FormControlLabel
          control={
            <Switch
              checked={proxySettings.enabled}
              onChange={(e) => updateProxyField('enabled', e.target.checked)}
              color="primary"
              disabled={!proxyLoaded}
            />
          }
          label="Enable proxy"
        />

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, gap: 2 }}>
          <TextField
            label="Proxy Host"
            value={proxySettings.host}
            onChange={(e) => updateProxyField('host', e.target.value)}
            fullWidth
            placeholder="proxy.company.com or http://proxy.company.com:8080"
            helperText="Use hostname, host:port, or full http:// URL. Save settings before testing APIs."
            disabled={!proxyLoaded || !proxySettings.enabled}
          />
          <TextField
            label="Port"
            type="number"
            value={proxySettings.port}
            onChange={(e) => updateProxyField('port', Number(e.target.value) || DEFAULT_PROXY_SETTINGS.port)}
            fullWidth
            slotProps={{ htmlInput: { min: 1, max: 65535 } }}
            disabled={!proxyLoaded || !proxySettings.enabled}
          />
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
          <TextField
            label="Username (optional)"
            value={proxySettings.username}
            onChange={(e) => updateProxyField('username', e.target.value)}
            fullWidth
            autoComplete="off"
            disabled={!proxyLoaded || !proxySettings.enabled}
          />
          <TextField
            label="Password (optional)"
            type="password"
            value={proxySettings.password}
            onChange={(e) => updateProxyField('password', e.target.value)}
            fullWidth
            autoComplete="off"
            disabled={!proxyLoaded || !proxySettings.enabled}
          />
        </Box>

        <FormControlLabel
          control={
            <Switch
              checked={proxySettings.bypassLocal}
              onChange={(e) => updateProxyField('bypassLocal', e.target.checked)}
              color="primary"
              disabled={!proxyLoaded || !proxySettings.enabled}
            />
          }
          label="Bypass proxy for localhost"
        />

        {proxyMessage && (
          <Alert severity={proxyMessage.includes('Could not') || proxyMessage.includes('required') ? 'error' : 'success'}>
            {proxyMessage}
          </Alert>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            onClick={() => void handleSaveProxySettings()}
            disabled={proxySaving || !proxyLoaded}
          >
            Save Proxy Settings
          </Button>
        </Box>
      </SettingsAccordion>

      <SettingsAccordion
        id="appearance"
        expanded={expanded.appearance}
        onChange={setSectionExpanded}
        icon={<DarkModeIcon />}
        title="Appearance Settings"
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1 }}>
          <Box>
            <Typography variant="body1" sx={{ fontWeight: 600, color: 'text.primary' }}>
              Dark Mode
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Switch interface palette between light and dark themes.
            </Typography>
          </Box>
          <FormControlLabel
            control={<Switch checked={themeMode === 'dark'} onChange={handleToggleTheme} color="primary" />}
            label={themeMode === 'dark' ? 'Dark' : 'Light'}
            sx={{ mr: 0 }}
          />
        </Box>
      </SettingsAccordion>

      <SettingsAccordion
        id="features"
        expanded={expanded.features}
        onChange={setSectionExpanded}
        icon={<ExtensionOutlinedIcon />}
        title="Feature Modules"
      >
        <Box>
          <Typography variant="body1" sx={{ fontWeight: 600, color: 'text.primary', mb: 0.5 }}>
            Linux Search Assistant
          </Typography>
          <PageErrorBoundary pageName="Linux Search Assistant settings">
            <Suspense
              fallback={
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                  <CircularProgress size={22} />
                </Box>
              }
            >
              <LinuxSearchAssistantSettingsPanel />
            </Suspense>
          </PageErrorBoundary>
        </Box>

        <Box sx={{ borderTop: '1px solid', borderColor: 'divider', my: 2 }} />

        <Box>
          <PageErrorBoundary pageName="Ask AI settings">
            <Suspense
              fallback={
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                  <CircularProgress size={22} />
                </Box>
              }
            >
              <AskAiSettingsPanel />
            </Suspense>
          </PageErrorBoundary>
        </Box>
      </SettingsAccordion>

      <SettingsAccordion
        id="database"
        expanded={expanded.database}
        onChange={setSectionExpanded}
        icon={<StorageIcon />}
        title="Database & Storage Management"
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1 }}>
          <Box>
            <Typography variant="body1" sx={{ fontWeight: 600, color: 'text.primary' }}>
              Clear Run History
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Delete all HTTP request and schema validation histories inside the active workspace.
            </Typography>
          </Box>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteOutlinedIcon />}
            onClick={() => setOpenClearHistoryModal(true)}
            disabled={!activeProjectId}
          >
            Clear History
          </Button>
        </Box>

        <Box sx={{ borderTop: '1px solid', borderColor: 'divider', my: 1 }} />

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1 }}>
          <Box>
            <Typography variant="body1" sx={{ fontWeight: 600, color: 'error.main' }}>
              Purge Database
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Deletes all workspaces, environments, specs, and history data for your profile. Your profile details are
              kept.
            </Typography>
          </Box>
          <Button
            variant="contained"
            color="error"
            startIcon={<DeleteOutlinedIcon />}
            onClick={() => setOpenResetModal(true)}
          >
            Purge Database
          </Button>
        </Box>
      </SettingsAccordion>

      <Dialog open={openClearHistoryModal} onClose={() => setOpenClearHistoryModal(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Clear History?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'text.primary' }}>
            Are you sure you want to clear request and validation logs for the current workspace? This will purge all
            run telemetry.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setOpenClearHistoryModal(false)} sx={{ color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button onClick={handleClearHistory} variant="contained" color="error">
            Clear Logs
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openResetModal} onClose={() => setOpenResetModal(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: 'error.main' }}>Purge Database?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'text.primary' }}>
            This will permanently delete all workspaces, environment variables, APIs, and logs linked to your profile.
            The application will refresh. This action is irreversible.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setOpenResetModal(false)} sx={{ color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button onClick={handlePurgeAllData} variant="contained" color="error">
            Reset All
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
