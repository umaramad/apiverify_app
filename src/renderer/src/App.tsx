import React, { useEffect } from 'react'
import { Box } from '@mui/material'
import { useAppStore } from './store/app.store'
import { useErrorStore } from './store/error.store'
import AppErrorAlert from './components/AppErrorAlert'
import AppSidebar from './components/AppSidebar'
import AppHeader from './components/AppHeader'
import PageRouter from './components/PageRouter'
import FindInPage from './components/FindInPage'

export default function App(): React.JSX.Element {
  const init = useAppStore((s) => s.init)
  const activePage = useAppStore((s) => s.activePage)
  const globalError = useErrorStore((s) => s.globalError)
  const clearGlobalError = useErrorStore((s) => s.clearGlobalError)

  useEffect(() => {
    init()
  }, [init])

  const loadSchedules = useAppStore((s) => s.loadSchedules)
  const reloadHistory = useAppStore((s) => s.reloadHistory)

  useEffect(() => {
    const unsubscribe = window.api.onSchedulerUpdated((event) => {
      void loadSchedules()
      if (event.status === 'completed') {
        void reloadHistory()
      }
    })
    return unsubscribe
  }, [loadSchedules, reloadHistory])

  return (
    <Box
      sx={{
        display: 'flex',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        bgcolor: 'background.default',
        color: 'text.primary',
      }}
    >
      <AppSidebar />

      <Box
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          overflow: 'hidden',
          bgcolor: 'background.default',
        }}
      >
        <AppHeader />

        <Box sx={{ flexGrow: 1, overflow: 'hidden', bgcolor: 'background.default', display: 'flex', flexDirection: 'column' }}>
          {globalError && (
            <Box sx={{ px: 3, pt: 2, flexShrink: 0 }}>
              <AppErrorAlert error={globalError} onDismiss={clearGlobalError} />
            </Box>
          )}
          <Box sx={{ flexGrow: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <PageRouter activePage={activePage} />
          </Box>
        </Box>
      </Box>
      <FindInPage />
    </Box>
  )
}
