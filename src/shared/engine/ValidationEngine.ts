import axios, { type AxiosResponse } from 'axios'
import type {
  ApiEndpoint,
  Environment,
  ValidationResult,
  ValidationRun,
} from '../models'
import { buildRequest, serializeHeaders, serializeRequestBody, getSpecServerBaseUrl } from './requestBuilder'
import { getSpecParametersForEndpoint } from './endpointExtractor'
import { validateResponse, isValidationPassed } from './responseValidator'
import { normalizeHttpError } from '../errors/normalize'
import type {
  EndpointValidationResult,
  HttpClient,
  HttpResponse,
  ValidationEngineInput,
  ValidationEngineOptions,
  ValidationEngineOutput,
} from './types'

const DEFAULT_TIMEOUT_MS = 15000

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function defaultHttpClient(
  request: { url: string; method: string; headers: Record<string, string>; body: unknown },
  options: { timeoutMs: number; signal?: AbortSignal }
): Promise<HttpResponse> {
  return axios({
    url: request.url,
    method: request.method,
    headers: request.headers,
    data: request.body,
    timeout: options.timeoutMs,
    signal: options.signal,
    validateStatus: () => true,
  }).then((response: AxiosResponse) => ({
    status: response.status,
    headers: normalizeHeaders(response.headers as Record<string, unknown>),
    data: response.data,
  }))
}

function normalizeHeaders(raw: Record<string, unknown>): Record<string, string> {
  const headers: Record<string, string> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined || value === null) continue
    headers[key.toLowerCase()] = Array.isArray(value) ? value.join(', ') : String(value)
  }
  return headers
}

function serializeResponseBody(data: unknown): string | null {
  if (data === null || data === undefined) return null
  if (typeof data === 'string') return data
  try {
    return JSON.stringify(data)
  } catch {
    return String(data)
  }
}

/**
 * Core REST API validation engine.
 * Framework-agnostic — runs in Node or browser without Electron/React dependencies.
 */
export class ValidationEngine {
  private httpClient: HttpClient

  constructor(httpClient?: HttpClient) {
    this.httpClient = httpClient ?? defaultHttpClient
  }

  /**
   * Validates all endpoints against the given environment and OpenAPI specification.
   */
  async run(input: ValidationEngineInput): Promise<ValidationEngineOutput> {
    const { project, environment, endpoints, parsedSpec, options } = input
    const results: EndpointValidationResult[] = []

    for (const endpoint of endpoints) {
      const result = await this.validateEndpoint(
        project.id,
        environment,
        endpoint,
        parsedSpec,
        options
      )
      results.push(result)
    }

    const passed = results.filter((r) => r.passed).length
    const totalTime = results.reduce((sum, r) => sum + (r.result.responseTimeMs ?? 0), 0)

    return {
      projectId: project.id,
      environmentId: environment.id,
      results,
      summary: {
        total: results.length,
        passed,
        failed: results.length - passed,
        avgResponseTimeMs: results.length > 0 ? Math.round(totalTime / results.length) : 0,
      },
    }
  }

  /**
   * Validates a single endpoint.
   */
  async validateEndpoint(
    projectId: string,
    environment: Environment,
    endpoint: ApiEndpoint,
    parsedSpec: Record<string, unknown> | null,
    options?: ValidationEngineOptions
  ): Promise<EndpointValidationResult> {
    const runId = generateId()
    const resultId = generateId()
    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS

    const specParameters = parsedSpec
      ? getSpecParametersForEndpoint(parsedSpec, endpoint.path, endpoint.method)
      : undefined

    const specBaseUrl = parsedSpec ? getSpecServerBaseUrl(parsedSpec) : undefined

    const builtRequest = buildRequest(environment, endpoint, { specParameters, specBaseUrl })

    const run: ValidationRun = {
      id: runId,
      projectId,
      url: builtRequest.url,
      method: builtRequest.method,
      headers: serializeHeaders(builtRequest.headers),
      body: serializeRequestBody(builtRequest.body),
    }

    const startTime = Date.now()
    let httpResponse: HttpResponse | null = null
    let requestError: string | undefined

    try {
      httpResponse = await this.httpClient(builtRequest, {
        timeoutMs,
        signal: options?.signal,
      })
    } catch (err) {
      const appError = normalizeHttpError(err)
      requestError = appError.message
    }

    const responseTimeMs = Date.now() - startTime
    const responseStatus = httpResponse?.status ?? 0
    const responseHeaders = httpResponse?.headers ?? {}
    const responseData = httpResponse?.data ?? null

    const validation = validateResponse(
      parsedSpec,
      builtRequest.url,
      endpoint.path,
      endpoint.method,
      responseStatus,
      responseData
    )

    if (requestError && validation.errors.length === 0) {
      validation.errors.push({
        id: generateId(),
        message: requestError,
        severity: 'high',
      })
    }

    const passed = !requestError && isValidationPassed(validation)

    const result: ValidationResult = {
      id: resultId,
      runId,
      responseStatus,
      responseHeaders: JSON.stringify(responseHeaders),
      responseBody: serializeResponseBody(responseData),
      validationErrors: validation.errors.length > 0 ? JSON.stringify(validation.errors) : null,
      responseTimeMs,
    }

    return {
      endpointId: endpoint.id,
      endpointName: endpoint.name,
      endpointPath: endpoint.path,
      method: endpoint.method,
      passed,
      run,
      result,
      validation,
      requestError,
    }
  }

  /** @deprecated Use run() with ValidationEngineInput instead */
  async runValidation(
    environment: Environment,
    endpoints: ApiEndpoint[],
    parsedSpec: Record<string, unknown> | null,
    options?: ValidationEngineOptions
  ): Promise<EndpointValidationResult[]> {
    const projectId = endpoints[0]?.projectId ?? 'unknown'
    const output = await this.run({
      project: { id: projectId, name: '', createdAt: new Date().toISOString() },
      environment,
      endpoints,
      parsedSpec,
      options,
    })
    return output.results
  }
}
