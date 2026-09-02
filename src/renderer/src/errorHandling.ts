import { useErrorStore, reportError } from './store/error.store'

export function registerRendererErrorHandlers(): void {
  window.addEventListener('unhandledrejection', (event) => {
    reportError(event.reason)
    event.preventDefault()
  })

  window.addEventListener('error', (event) => {
    reportError(event.error ?? event.message)
  })
}

export function useGlobalErrorReporter(): void {
  // Side-effect import hook point if needed later
  useErrorStore
}

export { reportError }
