import type { ApiEndpoint, ApiAuthConfig, HttpMethod, HeaderOrQueryParam } from '../models'
import { generateMockRequestBody, type OpenAPIParameter } from './testValues'
import { sortEndpointsByManualOrder } from '../manualCollectionOrder'

const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD']

export interface ExtractEndpointsOptions {
  methods?: HttpMethod[]
  includeDeprecated?: boolean
}

function resolveRequestBodyFromJsonContent(
  jsonContent: Record<string, unknown> | undefined
): string | null {
  if (!jsonContent) return null

  // Prefer explicit examples (manual collections and documented samples).
  if (jsonContent.example !== undefined) {
    return typeof jsonContent.example === 'string'
      ? jsonContent.example
      : JSON.stringify(jsonContent.example, null, 2)
  }

  const examples = jsonContent.examples as Record<string, { value?: unknown }> | undefined
  if (examples) {
    const first = Object.values(examples)[0]
    if (first?.value !== undefined) {
      return typeof first.value === 'string'
        ? first.value
        : JSON.stringify(first.value, null, 2)
    }
  }

  if (jsonContent.schema) {
    return generateMockRequestBody(jsonContent.schema as Record<string, unknown>)
  }

  return null
}

/**
 * Extracts executable ApiEndpoint records from a dereferenced OpenAPI specification.
 */
export function extractEndpointsFromSpec(
  projectId: string,
  parsedSpec: Record<string, unknown>,
  options: ExtractEndpointsOptions = {}
): ApiEndpoint[] {
  const paths = parsedSpec.paths as Record<string, Record<string, unknown>> | undefined
  if (!paths) return []

  const allowedMethods = new Set(
    (options.methods ?? HTTP_METHODS).map((m) => m.toLowerCase())
  )
  const endpoints: ApiEndpoint[] = []

  for (const [path, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== 'object') continue

    const sharedParameters = Array.isArray(pathItem.parameters)
      ? (pathItem.parameters as OpenAPIParameter[])
      : []

    for (const method of allowedMethods) {
      const operation = pathItem[method] as Record<string, unknown> | undefined
      if (!operation) continue

      if (operation.deprecated === true && !options.includeDeprecated) continue

      const operationId = operation.operationId as string | undefined
      const summary = operation.summary as string | undefined
      const name = operationId || summary || `${method.toUpperCase()} ${path}`

      const operationParameters = Array.isArray(operation.parameters)
        ? (operation.parameters as OpenAPIParameter[])
        : []
      const allParameters = [...sharedParameters, ...operationParameters]

      const queryParams = allParameters
        .filter((p) => p.in === 'query')
        .map((p) => ({
          key: p.name,
          value: p.example !== undefined ? String(p.example) : '',
          enabled: true, // always include; `required` is a validation constraint, not an enablement flag
        }))

      const pathVariables: Record<string, string> = {}
      for (const p of allParameters.filter((param) => param.in === 'path')) {
        if (p.example !== undefined) {
          pathVariables[p.name] = String(p.example)
        }
      }

      let body: string | null = null
      const requestBody = operation.requestBody as Record<string, unknown> | undefined
      const content = requestBody?.content as Record<string, Record<string, unknown>> | undefined
      const jsonContent = content?.['application/json']
      body = resolveRequestBodyFromJsonContent(jsonContent)

      const manualHeaders = operation['x-apverify-headers'] as HeaderOrQueryParam[] | undefined
      const manualAuth = operation['x-apverify-auth'] as ApiAuthConfig | undefined

      endpoints.push({
        id: `${projectId}-${method}-${path}`.replace(/[^a-zA-Z0-9-_]/g, '_'),
        projectId,
        name,
        path,
        method: method.toUpperCase() as HttpMethod,
        headers: manualHeaders ?? [],
        queryParams,
        body,
        authConfig: manualAuth ?? ({ type: 'inherit' } as ApiAuthConfig),
        pathVariables: Object.keys(pathVariables).length > 0 ? pathVariables : undefined,
      })
    }
  }

  return sortEndpointsByManualOrder(endpoints, parsedSpec)
}

export function getSpecParametersForEndpoint(
  parsedSpec: Record<string, unknown> | null,
  specPath: string,
  method: HttpMethod
): OpenAPIParameter[] {
  if (!parsedSpec?.paths) return []

  const paths = parsedSpec.paths as Record<string, Record<string, unknown>>
  const pathItem = paths[specPath]
  if (!pathItem) return []

  const shared = (pathItem.parameters as OpenAPIParameter[]) || []
  const operation = pathItem[method.toLowerCase()] as Record<string, unknown> | undefined
  const operationParams = (operation?.parameters as OpenAPIParameter[]) || []

  return [...shared, ...operationParams]
}
