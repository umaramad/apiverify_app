import type { ApiAuthConfig } from '../../models'
import type { AuthApplyInput, AuthContext, AuthStrategy } from '../types'
import { passthroughResult, setHeader } from '../utils'

export const customHeadersStrategy: AuthStrategy = {
  type: 'custom',

  isConfigured(config: ApiAuthConfig): boolean {
    return Boolean(
      config.customHeaders?.some((header) => header.enabled && header.key.trim())
    )
  },

  apply(input: AuthApplyInput, context: AuthContext) {
    for (const header of input.config.customHeaders ?? []) {
      if (!header.enabled || !header.key.trim()) continue
      const key = context.interpolate(header.key.trim(), context.variables)
      const value = context.interpolate(header.value ?? '', context.variables)
      setHeader(input.headers, key, value)
    }

    return passthroughResult(input)
  },
}
