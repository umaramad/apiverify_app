import type { ApiAuthConfig } from '../../models'
import type { AuthApplyInput, AuthContext, AuthStrategy } from '../types'
import { passthroughResult } from '../utils'

export const noneStrategy: AuthStrategy = {
  type: 'none',

  isConfigured(): boolean {
    return true
  },

  apply(input: AuthApplyInput, _context: AuthContext) {
    return passthroughResult(input)
  },
}

export function isNoneAuth(config: ApiAuthConfig): boolean {
  return config.type === 'none'
}
