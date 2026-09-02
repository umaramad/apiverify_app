import type { ApiEndpoint, Environment } from '../models'
import { interpolateVariables } from '../utils/template'
import { AuthManager } from '../auth'
import type { BuiltRequest } from './types'
import { resolvePathVariables, type OpenAPIParameter } from './testValues'
import { resolveEnvironmentBaseUrl, buildEffectiveEnvironmentVariables, isPlaceholderBaseUrl } from './environmentBaseUrl'

export {
  getSpecServerBaseUrl,
  getExplicitCollectionServerUrl,
  joinEnvironmentBaseUrl,
  resolveEnvironmentBaseUrl,
  buildEffectiveEnvironmentVariables,
  normalizeEnvironmentVariables,
  isPlaceholderBaseUrl,
} from './environmentBaseUrl'

interface BuildRequestOptions {
  specParameters?: OpenAPIParameter[]
  specBaseUrl?: string
  runtimeVariables?: Record<string, string>
  variableMap?: Record<string, string>
}

function joinUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/$/, '')
  const relative = path.startsWith('/') ? path : `/${path}`
  return `${base}${relative}`
}

function isAbsoluteUrl(value: string): boolean {
  return value.startsWith('http://') || value.startsWith('https://')
}

/**
 * Builds a fully resolved HTTP request from an endpoint and environment.
 */
export function buildRequest(
  environment: Environment,
  endpoint: ApiEndpoint,
  options: BuildRequestOptions = {}
): BuiltRequest {
  let path = endpoint.path
  const variables = options.variableMap
    ? { ...options.variableMap }
    : {
        ...buildEffectiveEnvironmentVariables(environment),
        ...(options.runtimeVariables ?? {}),
      }

  const resolvedBaseUrl = resolveEnvironmentBaseUrl(
    environment,
    options.specBaseUrl && !isPlaceholderBaseUrl(options.specBaseUrl) ? options.specBaseUrl : undefined
  )

  if (resolvedBaseUrl && !isAbsoluteUrl(path)) {
    path = joinUrl(resolvedBaseUrl, path)
  }

  path = resolvePathVariables(
    path,
    variables,
    endpoint.pathVariables,
    options.specParameters
  )

  path = interpolateVariables(path, variables)

  const enabledQueryParams = endpoint.queryParams.filter((q) => q.enabled && q.key)
  if (enabledQueryParams.length > 0) {
    const queryString = enabledQueryParams
      .map(
        (q) =>
          `${encodeURIComponent(interpolateVariables(q.key, variables))}=${encodeURIComponent(interpolateVariables(q.value, variables))}`
      )
      .join('&')
    path += (path.includes('?') ? '&' : '?') + queryString
  }

  const headers: Record<string, string> = {};

  (environment.defaultHeaders ?? [])
    .filter((h) => h.enabled && h.key)
    .forEach((h) => {
      headers[interpolateVariables(h.key, variables).toLowerCase()] =
        interpolateVariables(h.value, variables)
    });

  (endpoint.headers ?? [])
    .filter((h) => h.enabled && h.key)
    .forEach((h) => {
      headers[interpolateVariables(h.key, variables).toLowerCase()] =
        interpolateVariables(h.value, variables)
    });

  // Drop stale Authorization from default headers so environment/request auth wins.
  const resolvedAuth = AuthManager.resolveAuth(endpoint.authConfig, environment.authConfig)
  if (resolvedAuth && resolvedAuth.config.type !== 'none') {
    delete headers.authorization
  }

  const url = AuthManager.applyAuth(
    endpoint.authConfig,
    environment.authConfig,
    headers,
    path,
    variables,
    interpolateVariables,
    { method: endpoint.method, body: endpoint.body }
  )

  let body: unknown = null
  if (endpoint.method !== 'GET' && endpoint.method !== 'HEAD' && endpoint.body) {
    const interpolatedBody = interpolateVariables(endpoint.body, variables)
    try {
      body = JSON.parse(interpolatedBody)
    } catch {
      body = interpolatedBody
    }
  }

  return {
    url,
    method: endpoint.method,
    headers,
    body,
  }
}

export function serializeRequestBody(body: unknown): string | null {
  if (body === null || body === undefined) return null
  if (typeof body === 'string') return body
  return JSON.stringify(body)
}

export function serializeHeaders(headers: Record<string, string>): string {
  return JSON.stringify(headers)
}
