import type { ApiEndpoint, Environment } from '../../../shared/models'
import {
  buildRequest,
  serializeRequestBody,
  getSpecServerBaseUrl
} from '../../../shared/engine/requestBuilder'
import { getSpecParametersForEndpoint } from '../../../shared/engine/endpointExtractor'

function shellQuote(value: string): string {
  if (value.length === 0) return "''"
  return `'${value.replace(/'/g, "'\\''")}'`
}

export function buildCurlCommand(
  environment: Environment,
  endpoint: ApiEndpoint,
  parsedSpec?: Record<string, unknown> | null
): string {
  const builtRequest = buildRequest(environment, endpoint, {
    specBaseUrl: parsedSpec ? getSpecServerBaseUrl(parsedSpec) : undefined,
    specParameters: parsedSpec
      ? getSpecParametersForEndpoint(parsedSpec, endpoint.path, endpoint.method)
      : undefined
  })

  const parts = [`curl --request ${builtRequest.method} ${shellQuote(builtRequest.url)}`]
  Object.entries(builtRequest.headers)
    .sort(([left], [right]) => left.localeCompare(right))
    .forEach(([key, value]) => {
      parts.push(`--header ${shellQuote(`${key}: ${value}`)}`)
    })

  const body = serializeRequestBody(builtRequest.body)
  if (body !== null) {
    parts.push(`--data-raw ${shellQuote(body)}`)
  }

  return parts.map((part, index) => (index === 0 ? part : `  ${part}`)).join(' \\\n')
}

export function buildCurlCommands(
  environment: Environment,
  endpoints: ApiEndpoint[],
  parsedSpec?: Record<string, unknown> | null
): string {
  return endpoints
    .map((endpoint) => buildCurlCommand(environment, endpoint, parsedSpec))
    .join('\n\n')
}
