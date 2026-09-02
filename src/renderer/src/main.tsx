import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { getTheme } from './theme'
import { useAppStore } from './store/app.store'
import { registerRendererErrorHandlers } from './errorHandling'
import App from './App'

registerRendererErrorHandlers()

const isDev = import.meta.env.DEV

function Main(): React.JSX.Element {
  const themeMode = useAppStore((state) => state.themeMode)
  const theme = getTheme(themeMode)

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  )
}

const app = <Main />

createRoot(document.getElementById('root')!).render(
  isDev ? <StrictMode>{app}</StrictMode> : app
)

