/**
 * Generates test values for OpenAPI path parameters and JSON schemas.
 */

export interface OpenAPIParameter {
  name: string
  in?: string
  required?: boolean
  example?: unknown
  examples?: Record<string, { value?: unknown }>
  schema?: Record<string, unknown>
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return '00000000-0000-4000-8000-000000000001'
}

export function valueFromSchema(schema: Record<string, unknown> | undefined): string {
  if (!schema) return 'test'

  if (schema.example !== undefined) return String(schema.example)
  if (schema.default !== undefined) return String(schema.default)

  const type = schema.type as string | undefined
  const format = schema.format as string | undefined

  switch (type) {
    case 'string':
      if (format === 'uuid') return generateId()
      if (format === 'date-time') return new Date().toISOString()
      if (format === 'date') return '2024-01-01'
      if (format === 'email') return 'test@example.com'
      return 'test'
    case 'integer':
    case 'number':
      return '1'
    case 'boolean':
      return 'true'
    default:
      if (schema.enum && Array.isArray(schema.enum) && schema.enum.length > 0) {
        return String(schema.enum[0])
      }
      return 'test'
  }
}

export function valueFromParameter(param: OpenAPIParameter): string {
  if (param.example !== undefined) return String(param.example)

  const firstExample = param.examples && Object.values(param.examples)[0]
  if (firstExample?.value !== undefined) return String(firstExample.value)

  return valueFromSchema(param.schema)
}

export function heuristicPathValue(paramName: string): string {
  const lower = paramName.toLowerCase()
  if (lower === 'id' || lower.endsWith('_id') || lower.endsWith('id')) return '1'
  if (lower.includes('uuid')) return generateId()
  if (lower.includes('email')) return 'test@example.com'
  if (lower.includes('date')) return new Date().toISOString()
  if (lower.includes('name')) return 'test'
  if (lower.includes('slug')) return 'test-slug'
  return 'test'
}

/**
 * Resolves OpenAPI path template placeholders with test values.
 * Priority: endpoint pathVariables → environment variables → spec parameters → heuristics.
 */
export function resolvePathVariables(
  path: string,
  environmentVariables: Record<string, string>,
  pathVariables: Record<string, string> | undefined,
  specParameters: OpenAPIParameter[] | undefined
): string {
  const paramByName = new Map(specParameters?.map((p) => [p.name, p]) ?? [])

  return path.replace(/\{([^}]+)\}/g, (_, rawName: string) => {
    const name = rawName.trim()

    if (pathVariables?.[name] !== undefined) return pathVariables[name]
    if (environmentVariables[name] !== undefined) return environmentVariables[name]

    const specParam = paramByName.get(name)
    if (specParam) return valueFromParameter(specParam)

    return heuristicPathValue(name)
  })
}

export function generateMockFromSchema(schema: Record<string, unknown> | undefined): unknown {
  if (!schema) return null
  if (schema.example !== undefined) return schema.example
  if (schema.default !== undefined) return schema.default

  switch (schema.type) {
    case 'string':
      return schema.format === 'date-time' ? new Date().toISOString() : 'string'
    case 'number':
    case 'integer':
      return 0
    case 'boolean':
      return true
    case 'array':
      return [generateMockFromSchema((schema.items as Record<string, unknown>) || {})]
    case 'object': {
      const obj: Record<string, unknown> = {}
      const props = (schema.properties as Record<string, Record<string, unknown>>) || {}
      for (const key of Object.keys(props)) {
        obj[key] = generateMockFromSchema(props[key])
      }
      return obj
    }
    default:
      if (schema.properties) {
        return generateMockFromSchema({ type: 'object', properties: schema.properties })
      }
      return null
  }
}

export function generateMockRequestBody(schema: Record<string, unknown> | undefined): string | null {
  if (!schema) return null
  try {
    return JSON.stringify(generateMockFromSchema(schema), null, 2)
  } catch {
    return null
  }
}
