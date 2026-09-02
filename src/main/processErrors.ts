import { getLogger } from '../shared/logger'
import { normalizeError } from '../shared/errors/normalize'

const logger = getLogger().child('process')

export function registerProcessErrorHandlers(): void {
  process.on('unhandledRejection', (reason) => {
    const error = normalizeError(reason)
    logger.error('Unhandled promise rejection', error)
  })

  process.on('uncaughtException', (error) => {
    const normalized = normalizeError(error)
    logger.error('Uncaught exception', normalized)
  })
}
