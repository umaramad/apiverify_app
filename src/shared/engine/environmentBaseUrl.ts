import type { Environment } from '../models'
import { interpolateVariables } from '../utils/template'

function hasUnresolvedTemplate(value: string): boolean {
  return /\{\{[^}]+\}\}/.test(value)
}

export function isPlaceholderBaseUrl(value: string | undefined | null): boolean {
  const trimmed = (value ?? '').trim()
  if (!trimmed) return true
  if (trimmed === '{{baseUrl}}') return true
  return hasUnresolvedTemplate(trimmed)
}

function isAbsoluteUrl(value: string): boolean {
  return value.startsWith('http://') || value.startsWith('https://')
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/$/, '')
}

/**
 * Ensures environment variables are always available as a string map.
 * Some IPC/store paths may still provide JSON-encoded strings.
 */
export function normalizeEnvironmentVariables(
  variables: Environment['variables'] | string | null | undefined
): Record<string, string> {
  if (!variables) return {}

  if (typeof variables === 'string') {
    try {
      const parsed = JSON.parse(variables) as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return Object.fromEntries(
          Object.entries(parsed as Record<string, unknown>).map(([key, value]) => [key, String(value)])
        )
      }
    } catch {
      return {}
    }
    return {}
  }

  return Object.fromEntries(
    Object.entries(variables).map(([key, value]) => [key, String(value)])
  )
}

/**
 * Builds the variable map used for URL interpolation.
 * The environment Base URL field is treated as the canonical source for {{baseUrl}}.
 */
export function buildEffectiveEnvironmentVariables(environment: Environment): Record<string, string> {
  const variables = normalizeEnvironmentVariables(environment.variables)
  const interpolatedBaseUrl = interpolateVariables(environment.baseUrl ?? '', variables).trim()

  if (interpolatedBaseUrl && !hasUnresolvedTemplate(interpolatedBaseUrl)) {
    if (!variables.baseUrl) variables.baseUrl = interpolatedBaseUrl
    if (!variables.BASE_URL) variables.BASE_URL = interpolatedBaseUrl
    if (!variables.base_url) variables.base_url = interpolatedBaseUrl
  }

  return variables
}

/**
 * Resolves the effective base URL for a request using environment settings,
 * optional OpenAPI server URL, and environment variables (e.g. {{baseUrl}}).
 */
export function resolveEnvironmentBaseUrl(
  environment: Environment,
  specBaseUrl?: string
): string {
  const variables = buildEffectiveEnvironmentVariables(environment)
  const interpolatedEnvBaseUrl = interpolateVariables(environment.baseUrl ?? '', variables).trim()
  const interpolatedSpecBaseUrl = specBaseUrl
    ? interpolateVariables(specBaseUrl, variables).trim()
    : ''

  const candidates = [
    interpolatedEnvBaseUrl,
    interpolatedSpecBaseUrl,
    variables.baseUrl,
    variables.BASE_URL,
    variables.base_url,
  ]
    .map((value) => (value ?? '').trim())
    .filter(Boolean)

  for (const candidate of candidates) {
    if (hasUnresolvedTemplate(candidate)) continue
    if (isAbsoluteUrl(candidate)) {
      return trimTrailingSlash(candidate)
    }
  }

  const fallback = candidates.find((candidate) => !hasUnresolvedTemplate(candidate))
  return fallback ? trimTrailingSlash(fallback) : ''
}

export function getSpecServerBaseUrl(parsedSpec: Record<string, unknown> | null | undefined): string {
  const servers = parsedSpec?.servers as Array<{ url?: string }> | undefined
  if (!servers?.length) return ''
  return servers[0]?.url?.trim() ?? ''
}

/** Collection server URL only when the user explicitly set one (not {{baseUrl}} or empty). */
export function getExplicitCollectionServerUrl(
  parsedSpec: Record<string, unknown> | null | undefined
): string | undefined {
  const raw = getSpecServerBaseUrl(parsedSpec)
  if (!raw || isPlaceholderBaseUrl(raw)) return undefined
  return raw
}

export function joinEnvironmentBaseUrl(baseUrl: string, path: string): string {
  const trimmedPath = path.trim()
  if (!trimmedPath) return baseUrl.replace(/\/$/, '')
  if (trimmedPath.startsWith('http://') || trimmedPath.startsWith('https://')) {
    return trimmedPath
  }
  if (!baseUrl.trim()) return trimmedPath.startsWith('/') ? trimmedPath : `/${trimmedPath}`
  return `${baseUrl.replace(/\/$/, '')}/${trimmedPath.replace(/^\//, '')}`
}
