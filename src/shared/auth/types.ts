import type { ApiAuthConfig, AuthType } from '../models'

export type InterpolateFn = (template: string, variables: Record<string, string>) => string

export interface AuthContext {
  variables: Record<string, string>
  interpolate: InterpolateFn
}

export interface AuthApplyInput {
  config: ApiAuthConfig
  headers: Record<string, string>
  url: string
  /** Reserved for OAuth2 / AWS Signature V4 signing. */
  method?: string
  /** Reserved for AWS Signature V4 request body canonicalization. */
  body?: unknown
}

export interface AuthApplyResult {
  url: string
  headers: Record<string, string>
  /** Non-fatal messages (e.g. unimplemented auth types). */
  warnings: string[]
}

/** Built-in and future auth handlers (oauth2, aws). */
export interface AuthStrategy {
  readonly type: Exclude<AuthType, 'inherit'>
  isConfigured(config: ApiAuthConfig): boolean
  apply(input: AuthApplyInput, context: AuthContext): AuthApplyResult
}

export interface ResolvedAuth {
  config: ApiAuthConfig & { type: Exclude<AuthType, 'inherit'> }
  source: 'request' | 'environment'
}
