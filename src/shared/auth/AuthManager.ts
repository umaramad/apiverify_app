import type { ApiAuthConfig, AuthType } from '../models'
import type {
  AuthApplyInput,
  AuthApplyResult,
  AuthContext,
  AuthStrategy,
  InterpolateFn,
  ResolvedAuth,
} from './types'
import { builtInAuthStrategies } from './strategies'

const strategyRegistry = new Map<Exclude<AuthType, 'inherit'>, AuthStrategy>()

for (const strategy of builtInAuthStrategies) {
  strategyRegistry.set(strategy.type, strategy)
}

/**
 * Central authentication manager for REST API requests.
 *
 * Resolves request vs environment auth, then delegates to pluggable strategies.
 * OAuth 2.0 and AWS Signature V4 strategies are registered as no-op placeholders.
 */
export class AuthManager {
  /** Register or replace an auth strategy (e.g. when OAuth2 is implemented). */
  static registerStrategy(strategy: AuthStrategy): void {
    strategyRegistry.set(strategy.type, strategy)
  }

  static getStrategy(type: Exclude<AuthType, 'inherit'>): AuthStrategy | undefined {
    return strategyRegistry.get(type)
  }

  static getRegisteredTypes(): Exclude<AuthType, 'inherit'>[] {
    return [...strategyRegistry.keys()]
  }

  /**
   * Resolves which auth config applies: request-level overrides environment when not `inherit`.
   */
  static resolveAuth(
    requestAuth: ApiAuthConfig,
    envAuth: ApiAuthConfig | null | undefined
  ): ResolvedAuth | null {
    if (requestAuth.type === 'inherit') {
      if (!envAuth || envAuth.type === 'inherit') {
        return null
      }
      return { config: envAuth as ApiAuthConfig & { type: Exclude<AuthType, 'inherit'> }, source: 'environment' }
    }

    if (requestAuth.type === 'none') {
      return { config: requestAuth as ApiAuthConfig & { type: 'none' }, source: 'request' }
    }

    return {
      config: requestAuth as ApiAuthConfig & { type: Exclude<AuthType, 'inherit'> },
      source: 'request',
    }
  }

  /**
   * Applies authentication to headers and URL.
   * Returns the full result including any warnings from placeholder strategies.
   */
  static apply(
    requestAuth: ApiAuthConfig,
    envAuth: ApiAuthConfig | null | undefined,
    headers: Record<string, string>,
    url: string,
    variables: Record<string, string>,
    interpolateFn: InterpolateFn,
    options: { method?: string; body?: unknown } = {}
  ): AuthApplyResult {
    const resolved = AuthManager.resolveAuth(requestAuth, envAuth)

    if (!resolved) {
      return { url, headers, warnings: [] }
    }

    const strategy = strategyRegistry.get(resolved.config.type)
    if (!strategy) {
      return {
        url,
        headers,
        warnings: [`Unsupported auth type: ${resolved.config.type}`],
      }
    }

    const context: AuthContext = { variables, interpolate: interpolateFn }
    const input: AuthApplyInput = {
      config: resolved.config,
      headers,
      url,
      method: options.method,
      body: options.body,
    }

    return strategy.apply(input, context)
  }

  /**
   * Backward-compatible API used by the request builder and manual request editor.
   * Mutates `headers` in place and returns the updated URL.
   */
  static applyAuth(
    requestAuth: ApiAuthConfig,
    envAuth: ApiAuthConfig | null | undefined,
    headers: Record<string, string>,
    currentUrl: string,
    variables: Record<string, string>,
    interpolateFn: InterpolateFn,
    options: { method?: string; body?: unknown } = {}
  ): string {
    const result = AuthManager.apply(
      requestAuth,
      envAuth,
      headers,
      currentUrl,
      variables,
      interpolateFn,
      options
    )

    return result.url
  }
}
