import type { ApiAuthConfig } from '../../models'
import type { AuthApplyInput, AuthContext, AuthStrategy } from '../types'
import { appendQueryParam, passthroughResult, setHeader } from '../utils'

export const apiKeyStrategy: AuthStrategy = {
  type: 'apiKey',

  isConfigured(config: ApiAuthConfig): boolean {
    return Boolean(config.key?.trim() && config.value !== undefined)
  },

  apply(input: AuthApplyInput, context: AuthContext) {
    const key = input.config.key?.trim()
    if (!key || input.config.value === undefined) {
      return passthroughResult(input)
    }

    const resolvedKey = context.interpolate(key, context.variables)
    const resolvedValue = context.interpolate(input.config.value, context.variables)
    const addTo = input.config.addTo ?? 'header'

    if (addTo === 'query') {
      return {
        url: appendQueryParam(input.url, resolvedKey, resolvedValue),
        headers: input.headers,
        warnings: [],
      }
    }

    setHeader(input.headers, resolvedKey, resolvedValue)
    return passthroughResult(input)
  },
}
