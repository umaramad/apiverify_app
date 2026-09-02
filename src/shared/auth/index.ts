export { AuthManager } from './AuthManager'
export type {
  AuthApplyInput,
  AuthApplyResult,
  AuthContext,
  AuthStrategy,
  InterpolateFn,
  ResolvedAuth,
} from './types'
export { builtInAuthStrategies } from './strategies'
export {
  authConfigWithNewToken,
  formatOAuthTokenExpiryDisplay,
  formatTokenDuration,
  formatTokenExpiryTimestamp,
  getOAuthTokenExpiryInfo,
  isOAuthTokenExpired,
  usesClientCredentialsToken,
  TOKEN_REFRESH_BUFFER_MS,
} from './oauthClientCredentials'
export { prepareEnvironmentAuth } from './prepareEnvironmentAuth'
export type { OAuthTokenFetcher, PrepareEnvironmentAuthResult } from './prepareEnvironmentAuth'
export {
  noneStrategy,
  basicStrategy,
  bearerStrategy,
  apiKeyStrategy,
  customHeadersStrategy,
  oauth2Strategy,
  awsSignatureV4Strategy,
} from './strategies'
