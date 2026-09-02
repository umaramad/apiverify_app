import type { ApiEndpoint, HttpMethod } from './models'

export const MANUAL_COLLECTION_FLAG = 'x-apverify-manual'
export const MANUAL_ORDER_KEY = 'x-apverify-order'

interface OrderableRequest {
  method: HttpMethod
  path: string
}

function normalizePath(path: string): string {
  const trimmed = path.trim()
  if (!trimmed) return '/'
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

export function endpointOrderKey(method: HttpMethod, path: string): string {
  return `${method}:${normalizePath(path)}`
}

export function isManualCollection(parsedSpec: Record<string, unknown> | null | undefined): boolean {
  if (!parsedSpec?.info || typeof parsedSpec.info !== 'object') return false
  return (parsedSpec.info as Record<string, unknown>)[MANUAL_COLLECTION_FLAG] === true
}

export function sortEndpointsByManualOrder(
  endpoints: ApiEndpoint[],
  parsedSpec: Record<string, unknown>
): ApiEndpoint[] {
  if (!isManualCollection(parsedSpec)) return endpoints

  const order = (parsedSpec.info as Record<string, unknown> | undefined)?.[MANUAL_ORDER_KEY]
  if (!Array.isArray(order) || order.length === 0) return endpoints

  const orderIndex = new Map(order.map((key, index) => [String(key), index]))
  return [...endpoints].sort((left, right) => {
    const leftIndex = orderIndex.get(endpointOrderKey(left.method, left.path)) ?? Number.MAX_SAFE_INTEGER
    const rightIndex = orderIndex.get(endpointOrderKey(right.method, right.path)) ?? Number.MAX_SAFE_INTEGER
    return leftIndex - rightIndex
  })
}

export function sortManualRequestsByOrder(
  requests: OrderableRequest[],
  parsedSpec: Record<string, unknown>
): OrderableRequest[] {
  if (!isManualCollection(parsedSpec)) return requests

  const order = (parsedSpec.info as Record<string, unknown> | undefined)?.[MANUAL_ORDER_KEY]
  if (!Array.isArray(order) || order.length === 0) return requests

  const orderIndex = new Map(order.map((key, index) => [String(key), index]))
  return [...requests].sort((left, right) => {
    const leftIndex =
      orderIndex.get(endpointOrderKey(left.method, left.path)) ?? Number.MAX_SAFE_INTEGER
    const rightIndex =
      orderIndex.get(endpointOrderKey(right.method, right.path)) ?? Number.MAX_SAFE_INTEGER
    return leftIndex - rightIndex
  })
}
