import type {
  ApiEndpoint,
  Environment,
  HttpMethod,
  Project,
  ValidationError,
  ValidationResult,
  ValidationRun,
} from '../models'

export interface ValidationEngineOptions {
  /** Request timeout in milliseconds. Default: 15000 */
  timeoutMs?: number
  /** AbortSignal for cancelling in-flight requests */
  signal?: AbortSignal
}

export interface ValidationEngineInput {
  project: Project
  environment: Environment
  endpoints: ApiEndpoint[]
  /** Dereferenced OpenAPI specification object */
  parsedSpec: Record<string, unknown> | null
  options?: ValidationEngineOptions
}

export interface BuiltRequest {
  url: string
  method: HttpMethod
  headers: Record<string, string>
  body: unknown
}

export interface HttpResponse {
  status: number
  headers: Record<string, string>
  data: unknown
}

export type HttpClient = (
  request: BuiltRequest,
  options: { timeoutMs: number; signal?: AbortSignal }
) => Promise<HttpResponse>

export interface ResponseValidationOutcome {
  statusCodeValid: boolean
  schemaValid: boolean
  expectedStatusCodes: string[]
  matchedStatusCode: string | null
  errors: ValidationError[]
  /** True when schema validation was not applicable (e.g. 204 No Content) */
  skippedSchema: boolean
  skipReason?: string
}

/**
 * Structured result for a single endpoint validation execution.
 */
export interface EndpointValidationResult {
  endpointId: string
  endpointName: string
  endpointPath: string
  method: HttpMethod
  passed: boolean
  run: ValidationRun
  result: ValidationResult
  validation: ResponseValidationOutcome
  /** Set when the HTTP request itself failed (network error, timeout, etc.) */
  requestError?: string
}

export interface ValidationEngineOutput {
  projectId: string
  environmentId: string
  results: EndpointValidationResult[]
  summary: {
    total: number
    passed: number
    failed: number
    avgResponseTimeMs: number
  }
}
