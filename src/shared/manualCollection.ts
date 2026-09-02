import type { ApiAuthConfig, ApiEndpoint, HeaderOrQueryParam, HttpMethod } from './models'
import type { CollectionVariable, VariableExtractor } from './collectionVariables'
import { MANUAL_EXTRACT_KEY, MANUAL_VARIABLES_KEY } from './collectionVariables'
import {
  MANUAL_COLLECTION_FLAG,
  MANUAL_ORDER_KEY,
  endpointOrderKey,
  sortManualRequestsByOrder,
} from './manualCollectionOrder'

export { MANUAL_COLLECTION_FLAG, MANUAL_ORDER_KEY, endpointOrderKey, isManualCollection, sortManualRequestsByOrder } from './manualCollectionOrder'

export const MANUAL_HEADERS_KEY = 'x-apverify-headers'
export const MANUAL_AUTH_KEY = 'x-apverify-auth'

export { MANUAL_VARIABLES_KEY, MANUAL_EXTRACT_KEY } from './collectionVariables'
export type { CollectionVariable, VariableExtractor } from './collectionVariables'

export interface ManualRequest {
  name: string
  method: HttpMethod
  path: string
  description?: string
  queryParams: HeaderOrQueryParam[]
  headers: HeaderOrQueryParam[]
  body: string
  auth: ApiAuthConfig
  pathVariables?: Record<string, string>
  extractors?: VariableExtractor[]
}

export function extractPathVariableNames(path: string): string[] {
  const names: string[] = []
  const pattern = /\{([^}]+)\}/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(path)) !== null) {
    names.push(match[1])
  }
  return names
}

export function endpointToManualRequest(endpoint: ApiEndpoint): ManualRequest {
  const pathVariableNames = extractPathVariableNames(endpoint.path)
  const pathVariables: Record<string, string> = {}
  for (const name of pathVariableNames) {
    pathVariables[name] = endpoint.pathVariables?.[name] ?? ''
  }

  return {
    name: endpoint.name,
    method: endpoint.method,
    path: endpoint.path,
    description: '',
    queryParams: endpoint.queryParams.map((param) => ({ ...param })),
    headers:
      endpoint.headers.length > 0
        ? endpoint.headers.map((header) => ({ ...header }))
        : [{ key: 'Accept', value: 'application/json', enabled: true }],
    body: endpoint.body ?? '',
    auth: endpoint.authConfig,
    pathVariables: pathVariableNames.length > 0 ? pathVariables : undefined,
  }
}

export function manualRequestToEndpoint(
  projectId: string,
  endpointId: string,
  request: ManualRequest
): ApiEndpoint {
  const pathVariableNames = extractPathVariableNames(request.path)
  const pathVariables: Record<string, string> = {}
  for (const name of pathVariableNames) {
    pathVariables[name] = request.pathVariables?.[name] ?? ''
  }

  return {
    id: endpointId,
    projectId,
    name: request.name.trim() || `${request.method} ${request.path}`,
    path: request.path,
    method: request.method,
    headers: request.headers.map((header) => ({ ...header })),
    queryParams: request.queryParams.map((param) => ({ ...param })),
    body: request.body.trim() ? request.body : null,
    authConfig: request.auth,
    pathVariables: pathVariableNames.length > 0 ? pathVariables : undefined,
  }
}

export function buildManualCollectionFromEndpoints(
  name: string,
  endpoints: ApiEndpoint[],
  baseUrl?: string
): string {
  let content = createManualCollectionContent(name, baseUrl)
  const order: string[] = []

  for (const endpoint of endpoints) {
    const request = endpointToManualRequest(endpoint)
    content = addOrUpdateManualRequest(content, request)
    order.push(endpointOrderKey(endpoint.method, endpoint.path))
  }

  const spec = parseSpecObject(content)
  const info = (spec.info as Record<string, unknown>) || {}
  info[MANUAL_ORDER_KEY] = order
  spec.info = info

  return JSON.stringify(spec, null, 2)
}

const BODY_METHODS = new Set<HttpMethod>(['POST', 'PUT', 'PATCH', 'DELETE'])

function normalizePath(path: string): string {
  const trimmed = path.trim()
  if (!trimmed) return '/'

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const pathname = new URL(trimmed).pathname
      return pathname && pathname !== '/' ? pathname : '/'
    } catch {
      // fall through to relative normalization
    }
  }

  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

export function findManualOpenApiPathForValidation(
  parsedSpec: Record<string, unknown>,
  method: string,
  urlOrPath: string
): string {
  const pathname = urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')
    ? (() => {
        try {
          return new URL(urlOrPath).pathname
        } catch {
          return urlOrPath.split('?')[0]
        }
      })()
    : urlOrPath.split('?')[0]

  const normalizedPathname = normalizePath(pathname)
  const requests = extractManualRequests(parsedSpec)
  const upperMethod = method.toUpperCase()

  const exact = requests.find(
    (request) =>
      request.method.toUpperCase() === upperMethod && normalizePath(request.path) === normalizedPathname
  )
  if (exact) return exact.path

  const suffix = requests.find(
    (request) =>
      request.method.toUpperCase() === upperMethod &&
      (normalizedPathname.endsWith(normalizePath(request.path)) ||
        normalizedPathname.includes(normalizePath(request.path)))
  )
  return suffix?.path ?? normalizedPathname
}

function parseSpecObject(content: string): Record<string, unknown> {
  const trimmed = content.trim()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return JSON.parse(trimmed) as Record<string, unknown>
  }
  throw new Error('Manual collections must be stored as JSON.')
}

export function isManualSpecContent(content: unknown): boolean {
  return typeof content === 'string' && content.includes('"x-apverify-manual"')
}

export function createManualCollectionContent(name: string, baseUrl?: string): string {
  const spec: Record<string, unknown> = {
    openapi: '3.0.3',
    info: {
      title: name.trim() || 'Manual Collection',
      version: '1.0.0',
      description: 'Manually created API collection',
      [MANUAL_COLLECTION_FLAG]: true,
    },
    paths: {},
  }

  const trimmedBase = baseUrl?.trim()
  if (trimmedBase && trimmedBase !== '{{baseUrl}}' && !/\{\{[^}]+\}\}/.test(trimmedBase)) {
    spec.servers = [{ url: trimmedBase, description: 'Collection server override' }]
  }

  return JSON.stringify(spec, null, 2)
}

export function extractManualRequests(parsedSpec: Record<string, unknown>): ManualRequest[] {
  const paths = parsedSpec.paths as Record<string, Record<string, unknown>> | undefined
  if (!paths) return []

  const requests: ManualRequest[] = []
  const methods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head'] as const

  for (const [path, pathItem] of Object.entries(paths)) {
    if (!pathItem || typeof pathItem !== 'object') continue

    for (const method of methods) {
      const operation = pathItem[method] as Record<string, unknown> | undefined
      if (!operation) continue

      const parameters = Array.isArray(operation.parameters)
        ? (operation.parameters as Array<Record<string, unknown>>)
        : []
      const queryParams: HeaderOrQueryParam[] = parameters
        .filter((p) => p.in === 'query')
        .map((p) => ({
          key: String(p.name ?? ''),
          value: p.example !== undefined ? String(p.example) : '',
          enabled: true,
        }))

      const pathVariables: Record<string, string> = {}
      for (const param of parameters.filter((p) => p.in === 'path')) {
        const name = String(param.name ?? '')
        if (name) {
          pathVariables[name] = param.example !== undefined ? String(param.example) : ''
        }
      }

      let body = ''
      const requestBody = operation.requestBody as Record<string, unknown> | undefined
      const content = requestBody?.content as Record<string, Record<string, unknown>> | undefined
      const jsonContent = content?.['application/json']
      if (jsonContent?.example !== undefined) {
        body =
          typeof jsonContent.example === 'string'
            ? jsonContent.example
            : JSON.stringify(jsonContent.example, null, 2)
      }

      const headers = (operation[MANUAL_HEADERS_KEY] as HeaderOrQueryParam[] | undefined) ?? [
        { key: 'Accept', value: 'application/json', enabled: true },
      ]
      const auth = (operation[MANUAL_AUTH_KEY] as ApiAuthConfig | undefined) ?? { type: 'inherit' }
      const extractors = parseVariableExtractors(operation[MANUAL_EXTRACT_KEY])

      requests.push({
        name:
          (operation.summary as string | undefined) ||
          (operation.operationId as string | undefined) ||
          `${method.toUpperCase()} ${path}`,
        method: method.toUpperCase() as HttpMethod,
        path,
        description: (operation.description as string | undefined) || '',
        queryParams,
        headers,
        body,
        auth,
        pathVariables: Object.keys(pathVariables).length > 0 ? pathVariables : undefined,
        extractors: extractors.length > 0 ? extractors : undefined,
      })
    }
  }

  return sortManualRequestsByOrder(requests, parsedSpec) as ManualRequest[]
}

function readManualCollectionOrder(info: Record<string, unknown>): string[] {
  const order = info[MANUAL_ORDER_KEY]
  return Array.isArray(order) ? order.map((key) => String(key)) : []
}

function writeManualCollectionOrder(spec: Record<string, unknown>, order: string[]): void {
  const info = (spec.info as Record<string, unknown>) || {}
  info[MANUAL_ORDER_KEY] = order
  spec.info = info
}

export function updateManualCollectionOrder(content: string, order: string[]): string {
  const spec = parseSpecObject(content)
  const info = (spec.info as Record<string, unknown>) || {}
  info[MANUAL_COLLECTION_FLAG] = true
  writeManualCollectionOrder(spec, order)
  return JSON.stringify(spec, null, 2)
}

export function updateManualCollectionVariables(content: string, variables: CollectionVariable[]): string {
  const spec = parseSpecObject(content)
  const info = (spec.info as Record<string, unknown>) || {}
  info[MANUAL_COLLECTION_FLAG] = true
  info[MANUAL_VARIABLES_KEY] = variables.map((variable) => ({
    key: variable.key.trim(),
    value: variable.value,
    description: variable.description?.trim() || undefined,
    enabled: variable.enabled !== false,
  }))
  spec.info = info
  return JSON.stringify(spec, null, 2)
}

function parseVariableExtractors(raw: unknown): VariableExtractor[] {
  if (!Array.isArray(raw)) return []

  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const record = item as Record<string, unknown>
      const name = String(record.name ?? '').trim()
      const source = record.source === 'header' ? 'header' : record.source === 'body' ? 'body' : null
      const path = String(record.path ?? '').trim()
      if (!name || !source || !path) return null
      const extractor: VariableExtractor = {
        name,
        source,
        path,
        enabled: record.enabled !== false,
      }
      return extractor
    })
    .filter((item): item is VariableExtractor => item !== null)
}

function buildOperation(request: ManualRequest): Record<string, unknown> {
  const parameters = request.queryParams
    .filter((p) => p.key.trim())
    .map((p) => ({
      name: p.key.trim(),
      in: 'query',
      schema: { type: 'string' },
      example: p.value,
      required: false,
    }))

  const pathVariableNames = extractPathVariableNames(request.path)
  const pathVariables = request.pathVariables ?? {}
  for (const name of pathVariableNames) {
    parameters.push({
      name,
      in: 'path',
      schema: { type: 'string' },
      example: pathVariables[name] ?? '',
      required: true,
    })
  }

  const operation: Record<string, unknown> = {
    operationId: request.name.trim() || `${request.method} ${request.path}`,
    summary: request.name.trim() || `${request.method} ${request.path}`,
    description: request.description?.trim() || undefined,
    parameters,
    responses: {
      '200': { description: 'Successful response' },
      '201': { description: 'Resource created' },
      '2XX': { description: 'Successful response' },
    },
    [MANUAL_HEADERS_KEY]: request.headers,
    [MANUAL_AUTH_KEY]: request.auth,
  }

  if (request.extractors && request.extractors.length > 0) {
    operation[MANUAL_EXTRACT_KEY] = request.extractors.map((extractor) => ({
      name: extractor.name.trim(),
      source: extractor.source,
      path: extractor.path.trim(),
      enabled: extractor.enabled !== false,
    }))
  }

  if (BODY_METHODS.has(request.method) && request.body.trim()) {
    let example: unknown = request.body
    try {
      example = JSON.parse(request.body)
    } catch {
      // keep raw string example
    }
    operation.requestBody = {
      required: false,
      content: {
        'application/json': {
          schema: { type: 'object' },
          example,
        },
      },
    }
  }

  return operation
}

export function addOrUpdateManualRequest(
  content: string,
  request: ManualRequest,
  original?: { path: string; method: HttpMethod }
): string {
  const spec = parseSpecObject(content)
  const info = (spec.info as Record<string, unknown>) || {}
  info[MANUAL_COLLECTION_FLAG] = true
  spec.info = info

  const paths = (spec.paths as Record<string, Record<string, unknown>>) || {}
  const path = normalizePath(request.path)
  const method = request.method.toLowerCase()

  if (original) {
    const originalPath = normalizePath(original.path)
    const originalMethod = original.method.toLowerCase()
    const originalItem = paths[originalPath]
    if (originalItem && (originalMethod !== method || originalPath !== path)) {
      delete originalItem[originalMethod]
      if (Object.keys(originalItem).length === 0) {
        delete paths[originalPath]
      }
    }
  }

  const existingPathItem = paths[path]
  if (existingPathItem?.[method] && (!original || original.path !== path || original.method !== request.method)) {
    throw new Error(`A ${request.method} request already exists for ${path}.`)
  }

  paths[path] = {
    ...(existingPathItem || {}),
    [method]: buildOperation(request),
  }
  spec.paths = paths

  let order = readManualCollectionOrder(info)
  const nextKey = endpointOrderKey(request.method, path)
  if (original) {
    const previousKey = endpointOrderKey(original.method, normalizePath(original.path))
    if (previousKey !== nextKey) {
      order = order.map((key) => (key === previousKey ? nextKey : key))
    }
  }
  if (!order.includes(nextKey)) {
    order.push(nextKey)
  }
  writeManualCollectionOrder(spec, order)

  return JSON.stringify(spec, null, 2)
}

export function removeManualRequest(content: string, path: string, method: HttpMethod): string {
  const spec = parseSpecObject(content)
  const paths = (spec.paths as Record<string, Record<string, unknown>>) || {}
  const normalizedPath = normalizePath(path)
  const normalizedMethod = method.toLowerCase()

  const pathItem = paths[normalizedPath]
  if (pathItem) {
    delete pathItem[normalizedMethod]
    if (Object.keys(pathItem).length === 0) {
      delete paths[normalizedPath]
    }
  }

  spec.paths = paths

  const info = (spec.info as Record<string, unknown>) || {}
  const removedKey = endpointOrderKey(method, normalizedPath)
  writeManualCollectionOrder(
    spec,
    readManualCollectionOrder(info).filter((key) => key !== removedKey)
  )

  return JSON.stringify(spec, null, 2)
}

export function updateManualCollectionServer(content: string, baseUrl: string): string {
  const spec = parseSpecObject(content)
  const trimmed = baseUrl.trim()
  if (!trimmed || trimmed === '{{baseUrl}}' || /\{\{[^}]+\}\}/.test(trimmed)) {
    delete spec.servers
  } else {
    spec.servers = [{ url: trimmed, description: 'Collection server override' }]
  }
  return JSON.stringify(spec, null, 2)
}

export function findManualRequestForActiveRequest(
  parsedSpec: Record<string, unknown>,
  request: { method: string; url: string },
  activeManualRequestKey?: string | null
): ManualRequest | undefined {
  const requests = extractManualRequests(parsedSpec)

  if (activeManualRequestKey) {
    const byKey = requests.find((entry) => endpointOrderKey(entry.method, entry.path) === activeManualRequestKey)
    if (byKey) return byKey
  }

  const normalizedMethod = request.method.toUpperCase()
  const requestUrl = request.url.trim()

  return requests.find((entry) => {
    if (entry.method.toUpperCase() !== normalizedMethod) return false
    if (requestUrl === entry.path) return true
    if (requestUrl.endsWith(entry.path)) return true
    return requestUrl.includes(entry.path)
  })
}
