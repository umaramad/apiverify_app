import React from 'react'
import { Alert, AlertTitle, Box, Button, Typography } from '@mui/material'

interface PageErrorBoundaryProps {
  pageName: string
  children: React.ReactNode
}

interface PageErrorBoundaryState {
  error: Error | null
}

export default class PageErrorBoundary extends React.Component<
  PageErrorBoundaryProps,
  PageErrorBoundaryState
> {
  state: PageErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): PageErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error(`[${this.props.pageName}] render error`, error, info)
  }

  private handleRetry = (): void => {
    this.setState({ error: null })
  }

  render(): React.ReactNode {
    if (this.state.error) {
      return (
        <Box sx={{ p: 4, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Alert
            severity="error"
            sx={{ maxWidth: 560, width: '100%' }}
            action={
              <Button color="inherit" size="small" onClick={this.handleRetry}>
                Retry
              </Button>
            }
          >
            <AlertTitle>{this.props.pageName} failed to load</AlertTitle>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
              {this.state.error.message}
            </Typography>
          </Alert>
        </Box>
      )
    }

    return this.props.children
  }
}
