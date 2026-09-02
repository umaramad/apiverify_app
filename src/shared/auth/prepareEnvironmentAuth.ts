import type { ApiAuthConfig, Environment } from '../models'
import {
  authConfigWithNewToken,
  isOAuthTokenExpired,
  usesClientCredentialsToken,
} from './oauthClientCredentials'

export type OAuthTokenFetcher = (input: {
  tokenUrl: string
  clientId: string
  clientSecret: string
}) => Promise<{ accessToken?: string; expiresIn?: number; error?: string }>

export interface PrepareEnvironmentAuthResult {
  environment: Environment
  warnings: string[]
  authConfigChanged: boolean
}

/**
 * Ensures environment auth is ready for outbound API calls.
 * Refreshes OAuth client-credentials tokens when missing or expired.
 */
export async function prepareEnvironmentAuth(
  environment: Environment,
  fetchOAuthToken?: OAuthTokenFetcher
): Promise<PrepareEnvironmentAuthResult> {
  const authConfig = environment.authConfig

  if (!usesClientCredentialsToken(authConfig)) {
    return { environment, warnings: [], authConfigChanged: false }
  }

  if (!isOAuthTokenExpired(authConfig)) {
    return { environment, warnings: [], authConfigChanged: false }
  }

  if (!fetchOAuthToken) {
    return {
      environment,
      warnings: ['OAuth access token is expired or missing and could not be refreshed.'],
      authConfigChanged: false,
    }
  }

  const tokenUrl = authConfig.tokenUrl!.trim()
  const clientId = authConfig.username?.trim() ?? ''
  const clientSecret = authConfig.password ?? ''

  if (!clientId) {
    return {
      environment,
      warnings: ['OAuth client ID is required to refresh the access token.'],
      authConfigChanged: false,
    }
  }

  const result = await fetchOAuthToken({ tokenUrl, clientId, clientSecret })
  if (!result.accessToken) {
    return {
      environment,
      warnings: [result.error ?? 'Failed to refresh OAuth access token.'],
      authConfigChanged: false,
    }
  }

  const updatedAuth: ApiAuthConfig = authConfigWithNewToken(
    authConfig,
    result.accessToken,
    result.expiresIn
  )

  return {
    environment: { ...environment, authConfig: updatedAuth },
    warnings: [],
    authConfigChanged: true,
  }
}
