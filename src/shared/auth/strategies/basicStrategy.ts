import type { ApiAuthConfig } from '../../models'
import type { AuthApplyInput, AuthContext, AuthStrategy } from '../types'
import { encodeBase64, passthroughResult, setHeader } from '../utils'

export const basicStrategy: AuthStrategy = {
  type: 'basic',

  isConfigured(config: ApiAuthConfig): boolean {
    return Boolean(config.username?.trim())
  },

  apply(input: AuthApplyInput, context: AuthContext) {
    const tokenUrl = input.config.tokenUrl?.trim()
    if (tokenUrl) {
      const token = input.config.token?.trim()
      if (!token) {
        delete input.headers.authorization
        return passthroughResult(input, [
          'OAuth token is not available. Verify the token endpoint and save the environment.',
        ])
      }
      const bearer = context.interpolate(token, context.variables)
      if (!bearer.trim()) {
        delete input.headers.authorization
        return passthroughResult(input, [
          'OAuth access token resolved to an empty value. Verify the token endpoint and save the environment.',
        ])
      }
      setHeader(input.headers, 'authorization', `Bearer ${bearer}`)
      return passthroughResult(input)
    }

    const username = input.config.username?.trim()
    if (!username) {
      return passthroughResult(input)
    }

    const user = context.interpolate(username, context.variables)
    const pass = context.interpolate(input.config.password ?? '', context.variables)
    const credentials = encodeBase64(`${user}:${pass}`)
    setHeader(input.headers, 'authorization', `Basic ${credentials}`)
    return passthroughResult(input)
  },
}
