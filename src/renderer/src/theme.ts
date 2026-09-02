import { createTheme, Theme } from '@mui/material/styles'

export function getTheme(mode: 'light' | 'dark'): Theme {
  return createTheme({
    palette: {
      mode,
      primary: {
        main: '#3B82F6', // Action/Link
        contrastText: '#FFFFFF',
      },
      secondary: {
        main: '#6B7280', // Secondary Text
        contrastText: '#FFFFFF',
      },
      error: {
        main: '#EF4444', // Error
        contrastText: '#FFFFFF',
      },
      warning: {
        main: '#F59E0B',
        contrastText: '#FFFFFF',
      },
      success: {
        main: '#10B981',
        contrastText: '#FFFFFF',
      },
      info: {
        main: '#3B82F6',
        contrastText: '#FFFFFF',
      },
      text: {
        primary: mode === 'light' ? '#1A1A1B' : '#F8FAFC',
        secondary: mode === 'light' ? '#6B7280' : '#94A3B8',
      },
      background: {
        default: mode === 'light' ? '#F3F4F6' : '#0B0F19', // Sleeker darker deep background
        paper: mode === 'light' ? '#FFFFFF' : '#1E293B',
      },
      divider: mode === 'light' ? '#E5E7EB' : '#334155',
    },
    typography: {
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      h1: {
        color: mode === 'light' ? '#1A1A1B' : '#F8FAFC',
        fontWeight: 700,
      },
      h2: {
        color: mode === 'light' ? '#1A1A1B' : '#F8FAFC',
        fontWeight: 700,
      },
      h3: {
        color: mode === 'light' ? '#1A1A1B' : '#F8FAFC',
        fontWeight: 600,
      },
      h4: {
        color: mode === 'light' ? '#1A1A1B' : '#F8FAFC',
        fontWeight: 600,
      },
      h5: {
        color: mode === 'light' ? '#1A1A1B' : '#F8FAFC',
        fontWeight: 600,
      },
      h6: {
        color: mode === 'light' ? '#1A1A1B' : '#F8FAFC',
        fontWeight: 600,
      },
      body1: {
        color: mode === 'light' ? '#6B7280' : '#94A3B8',
      },
      body2: {
        color: mode === 'light' ? '#6B7280' : '#94A3B8',
      },
      button: {
        textTransform: 'none',
        fontWeight: 600,
      },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            scrollbarColor: mode === 'dark' ? '#334155 #0B0F19' : '#D1D5DB #F3F4F6',
            '&::-webkit-scrollbar': {
              width: '8px',
              height: '8px',
            },
            '&::-webkit-scrollbar-track': {
              background: mode === 'dark' ? '#0B0F19' : '#F3F4F6',
            },
            '&::-webkit-scrollbar-thumb': {
              background: mode === 'dark' ? '#334155' : '#D1D5DB',
              borderRadius: '4px',
            },
            '&::-webkit-scrollbar-thumb:hover': {
              background: mode === 'dark' ? '#475569' : '#9CA3AF',
            },
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            boxShadow: 'none',
            '&:hover': {
              boxShadow: 'none',
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            boxShadow: mode === 'light' 
              ? '0px 1px 3px rgba(0, 0, 0, 0.05), 0px 20px 25px -5px rgba(0, 0, 0, 0.05)'
              : '0px 1px 3px rgba(0, 0, 0, 0.3), 0px 20px 25px -5px rgba(0, 0, 0, 0.3)',
          },
        },
      },
      MuiTextField: {
        defaultProps: {
          size: 'small',
        },
      },
      MuiSelect: {
        defaultProps: {
          size: 'small',
        },
      },
    },
  })
}

