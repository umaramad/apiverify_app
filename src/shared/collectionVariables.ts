import type { Environment } from './models'
import { interpolateVariables } from './utils/template'
import { buildEffectiveEnvironmentVariables, isPlaceholderBaseUrl } from './engine/environmentBaseUrl'

export const MANUAL_VARIABLES_KEY = 'x-apverify-variables'
export const MANUAL_EXTRACT_KEY = 'x-apverify-extract'

export interface CollectionVariable {
  key: string
  value: string
  description?: string
  enabled?: boolean
}

export interface VariableExtractor {
  name: string
  source: 'header' | 'body'
  path: string
  enabled?: boolean
}

export interface CollectionHttpResponse {
  status: number
  headers: Record<string, string>
  data: unknown
}

export function extractCollectionVariables(parsedSpec: Record<string, unknown> | null | undefined): CollectionVariable[] {
  if (!parsedSpec?.info || typeof parsedSpec.info !== 'object') return []

  const raw = (parsedSpec.info as Record<string, unknown>)[MANUAL_VARIABLES_KEY]
  if (!Array.isArray(raw)) return []

  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const record = item as Record<string, unknown>
      const key = String(record.key ?? '').trim()
      if (!key) return null
      const variable: CollectionVariable = {
        key,
        value: String(record.value ?? ''),
        description: record.description ? String(record.description) : undefined,
        enabled: record.enabled !== false,
      }
      return variable
    })
    .filter((item): item is CollectionVariable => item !== null)
}

export function buildCollectionVariableMap(
  environment: Environment,
  collectionVariables: CollectionVariable[],
  runtimeVariables: Record<string, string> = {},
  specBaseUrl?: string
): Record<string, string> {
  const merged = buildEffectiveEnvironmentVariables(environment)

  if (specBaseUrl && !isPlaceholderBaseUrl(specBaseUrl)) {
    const resolvedSpecBaseUrl = interpolateVariables(specBaseUrl, merged).trim()
    if (resolvedSpecBaseUrl && !merged.baseUrl && !isPlaceholderBaseUrl(resolvedSpecBaseUrl)) {
      merged.baseUrl = resolvedSpecBaseUrl
    }
  }

  for (const variable of collectionVariables) {
    if (variable.enabled === false || !variable.key.trim()) continue
    merged[variable.key.trim()] = interpolateVariables(variable.value, merged)
  }

  for (const [key, value] of Object.entries(runtimeVariables)) {
    if (!key.trim()) continue
    merged[key.trim()] = value
  }

  return merged
}

export function extractJsonPath(data: unknown, path: string): string | undefined {
  if (!path.trim()) return undefined

  let normalized = path.trim()
  if (normalized.startsWith('$.')) normalized = normalized.slice(2)
  if (normalized.startsWith('$')) normalized = normalized.slice(1)
  if (normalized.startsWith('.')) normalized = normalized.slice(1)

  const parts = normalized.split(/\.|\[|\]/).filter(Boolean)
  let current: unknown = data

  for (const part of parts) {
    if (current === null || current === undefined) return undefined

    if (Array.isArray(current)) {
      const index = Number(part)
      if (Number.isNaN(index)) return undefined
      current = current[index]
      continue
    }

    if (typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }

  if (current === null || current === undefined) return undefined
  if (typeof current === 'string') return current
  if (typeof current === 'number' || typeof current === 'boolean') return String(current)
  return JSON.stringify(current)
}

function normalizeHeaderLookup(headers: Record<string, string>, headerName: string): string | undefined {
  const target = headerName.trim().toLowerCase()
  if (!target) return undefined

  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target) {
      return value
    }
  }

  return undefined
}

export function applyVariableExtractors(
  extractors: VariableExtractor[],
  response: CollectionHttpResponse,
  variables: Record<string, string>
): Record<string, string> {
  const next = { ...variables }

  for (const extractor of extractors) {
    if (extractor.enabled === false || !extractor.name.trim()) continue

    let extracted: string | undefined
    if (extractor.source === 'header') {
      extracted = normalizeHeaderLookup(response.headers, extractor.path)
    } else {
      extracted = extractJsonPath(response.data, extractor.path)
    }

    if (extracted !== undefined) {
      next[extractor.name.trim()] = extracted
    }
  }

  return next
}

/** Values extracted from a response for configured post-variable mappings. */
export function getExtractedVariableValues(
  extractors: VariableExtractor[],
  response: CollectionHttpResponse
): Record<string, string> {
  return applyVariableExtractors(extractors, response, {})
}
