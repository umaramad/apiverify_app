import type { ApiAuthConfig } from '../../models'
import type { AuthApplyInput, AuthContext, AuthStrategy } from '../types'
import { passthroughResult } from '../utils'

/**
 * Placeholder for OAuth 2.0 (client credentials, authorization code, etc.).
 * Register token acquisition and header injection here when implemented.
 */
export const oauth2Strategy: AuthStrategy = {
  type: 'oauth2',

  isConfigured(_config: ApiAuthConfig): boolean {
    return false
  },

  apply(input: AuthApplyInput, _context: AuthContext) {
    return passthroughResult(input, [
      'OAuth 2.0 authentication is not implemented yet. No credentials were applied.',
    ])
  },
}
