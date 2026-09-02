import React, { Suspense, lazy, useEffect, useState } from 'react'
import { Box, CircularProgress } from '@mui/material'
import type { ActivePage } from '../store/app.store'
import PageErrorBoundary from './PageErrorBoundary'

const PAGE_COMPONENTS: Record<ActivePage, React.LazyExoticComponent<React.ComponentType>> = {
  home: lazy(() => import('../pages/HomePage')),
  dashboard: lazy(() => import('../pages/Dashboard')),
  projects: lazy(() => import('../pages/Projects')),
  environments: lazy(() => import('../pages/Environments')),
  apis: lazy(() => import('../pages/APIs')),
  runner: lazy(() => import('../pages/Runner')),
  scheduler: lazy(() => import('../pages/Scheduler')),
  results: lazy(() => import('../pages/Results')),
  reports: lazy(() => import('../pages/Reports')),
  linuxSearchAssistant: lazy(
    () => import('../../../modules/linuxSearchAssistant/renderer/pages/LinuxSearchAssistantPage')
  ),
  localLogViewer: lazy(
    () => import('../../../modules/linuxSearchAssistant/renderer/pages/LocalLogViewerPage')
  ),
  settings: lazy(() => import('../pages/Settings')),
}

function PageLoadingFallback(): React.JSX.Element {
  return (
    <Box
      sx={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
      }}
    >
      <CircularProgress size={32} />
    </Box>
  )
}

const PageSlot = React.memo(function PageSlot({
  pageId,
  isActive,
}: {
  pageId: ActivePage
  isActive: boolean
}): React.JSX.Element {
  const Page = PAGE_COMPONENTS[pageId]

  return (
    <Box
      sx={{
        display: isActive ? 'flex' : 'none',
        flex: 1,
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
      aria-hidden={!isActive}
    >
      <Suspense fallback={<PageLoadingFallback />}>
        <PageErrorBoundary pageName={pageId}>
          <Page />
        </PageErrorBoundary>
      </Suspense>
    </Box>
  )
})

interface PageRouterProps {
  activePage: ActivePage
}

export default React.memo(function PageRouter({ activePage }: PageRouterProps): React.JSX.Element {
  const [mountedPages, setMountedPages] = useState<Set<ActivePage>>(() => new Set([activePage]))

  useEffect(() => {
    setMountedPages((prev) => {
      if (prev.has(activePage)) return prev
      const next = new Set(prev)
      next.add(activePage)
      return next
    })
  }, [activePage])

  return (
    <>
      {Array.from(mountedPages).map((pageId) => (
        <PageSlot key={pageId} pageId={pageId} isActive={activePage === pageId} />
      ))}
    </>
  )
})
