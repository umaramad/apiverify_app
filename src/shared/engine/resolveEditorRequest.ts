import { AuthManager } from '../auth'
import type { ApiAuthConfig, HeaderOrQueryParam } from '../models'
import { interpolateVariables } from '../utils/template'
import { joinEnvironmentBaseUrl, resolveEnvironmentBaseUrl } from './environmentBaseUrl'

export interface EditorRequestInput {
  url: string
  method: string
  headers: Array<{ key: string; value: string; enabled: boolean }>
  queryParams: Array<{ key: string; value: string; enabled: boolean }>
  body: string
  auth: ApiAuthConfig
}

export interface ResolvedEditorRequest {
  url: string
  method: string
  headers: Record<string, string>
  body: string | null
  variables: Record<string, string>
}

export interface ResolveEditorRequestOptions {
  variables: Record<string, string>
  baseUrl: string
  defaultHeaders: HeaderOrQueryParam[]
  envAuth: ApiAuthConfig | null
  isManualCollection: boolean
  specBaseUrl?: string
}

export function resolveEditorRequest(
  request: EditorRequestInput,
  options: ResolveEditorRequestOptions
): ResolvedEditorRequest {
  const { variables, baseUrl, defaultHeaders, envAuth, isManualCollection, specBaseUrl } = options

  const environmentForUrl = {
    id: '',
    projectId: '',
    name: '',
    variables,
    type: 'Custom' as const,
    baseUrl,
    defaultHeaders,
    authConfig: envAuth ?? { type: 'none' as const },
    isActive: true,
  }

  const resolvedBaseUrl = resolveEnvironmentBaseUrl(
    environmentForUrl,
    isManualCollection ? specBaseUrl : undefined
  )

  let rawUrl = request.url.trim()
  if (isManualCollection) {
    if (!rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
      rawUrl = joinEnvironmentBaseUrl(resolvedBaseUrl, rawUrl)
    }
  } else if (resolvedBaseUrl && !rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
    rawUrl = joinEnvironmentBaseUrl(resolvedBaseUrl, rawUrl)
  }

  let resolvedUrl = interpolateVariables(rawUrl, variables)
  const enabledQueryParams = request.queryParams.filter((q) => q.enabled && q.key)
  if (enabledQueryParams.length > 0) {
    const queryString = enabledQueryParams
      .map(
        (q) =>
          `${encodeURIComponent(interpolateVariables(q.key, variables))}=${encodeURIComponent(interpolateVariables(q.value, variables))}`
      )
      .join('&')
    resolvedUrl += (resolvedUrl.includes('?') ? '&' : '?') + queryString
  }

  const headers: Record<string, string> = {}
  defaultHeaders
    .filter((h) => h.enabled && h.key)
    .forEach((h) => {
      headers[interpolateVariables(h.key, variables).toLowerCase()] = interpolateVariables(h.value, variables)
    })

  request.headers
    .filter((h) => h.enabled && h.key)
    .forEach((h) => {
      headers[interpolateVariables(h.key, variables).toLowerCase()] = interpolateVariables(h.value, variables)
    })

  const resolvedAuth = AuthManager.resolveAuth(request.auth, envAuth)
  if (resolvedAuth && resolvedAuth.config.type !== 'none') {
    delete headers.authorization
  }

  resolvedUrl = AuthManager.applyAuth(
    request.auth,
    envAuth,
    headers,
    resolvedUrl,
    variables,
    interpolateVariables,
    { method: request.method, body: request.body }
  )

  let resolvedBody: string | null = null
  if (request.method !== 'GET' && request.body) {
    const interpolatedBody = interpolateVariables(request.body, variables)
    try {
      resolvedBody = JSON.stringify(JSON.parse(interpolatedBody), null, 2)
    } catch {
      resolvedBody = interpolatedBody
    }
  }

  return {
    url: resolvedUrl,
    method: request.method,
    headers,
    body: resolvedBody,
    variables,
  }
}
