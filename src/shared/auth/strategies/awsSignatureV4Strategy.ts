import type { ApiAuthConfig } from '../../models'
import type { AuthApplyInput, AuthContext, AuthStrategy } from '../types'
import { passthroughResult } from '../utils'

/**
 * Placeholder for AWS Signature Version 4 request signing.
 * Will require method, URL, headers, and body from {@link AuthApplyInput}.
 */
export const awsSignatureV4Strategy: AuthStrategy = {
  type: 'aws',

  isConfigured(_config: ApiAuthConfig): boolean {
    return false
  },

  apply(input: AuthApplyInput, _context: AuthContext) {
    return passthroughResult(input, [
      'AWS Signature V4 authentication is not implemented yet. No credentials were applied.',
    ])
  },
}
