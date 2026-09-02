import type { ApiAuthConfig } from '../../models'
import type { AuthApplyInput, AuthContext, AuthStrategy } from '../types'
import { passthroughResult, setHeader } from '../utils'

export const bearerStrategy: AuthStrategy = {
  type: 'bearer',

  isConfigured(config: ApiAuthConfig): boolean {
    return Boolean(config.token?.trim())
  },

  apply(input: AuthApplyInput, context: AuthContext) {
    const token = input.config.token?.trim()
    if (!token) {
      return passthroughResult(input)
    }

    const resolved = context.interpolate(token, context.variables)
    setHeader(input.headers, 'authorization', `Bearer ${resolved}`)
    return passthroughResult(input)
  },
}
