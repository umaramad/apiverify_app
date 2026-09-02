import { appErrorFromCode } from '../../shared/errors/normalize'
import type {
  ApiAuthConfig,
  ApiSpec,
  Environment,
  HeaderOrQueryParam,
  HttpMethod,
  Project,
  User,
  ValidationResult,
  ValidationRun,
} from '../../shared/models'
import type { SaveValidationScheduleInput } from '../../shared/models/scheduler'
import { isScheduleDateAllowed, SCHEDULE_MAX_DAYS_AHEAD } from '../../shared/scheduler/recurrence'
import type { ExportConfigurationInput } from '../../shared/models/export'
import type { ProxySettings } from '../../shared/models/proxySettings'
import type { StartValidationRunInput } from '../../shared/models/validationRunner'
import type { RequestData } from '../services/http.service'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const HTTP_METHODS = new Set<HttpMethod>([
  'GET',
  'POST',
  'PUT',
  'DELETE',
  'PATCH',
  'OPTIONS',
  'HEAD',
])

const RECURRENCE_TYPES = new Set(['once', 'daily', 'weekly'])
const RUN_SOURCES = new Set(['manual', 'scheduler'])

const AUTH_TYPES = new Set([
  'inherit',
  'none',
  'bearer',
  'basic',
  'apiKey',
  'custom',
  'oauth2',
  'aws',
])

const ENV_TYPES = new Set(['DEV', 'QA', 'UAT', 'PROD', 'Custom'])

const MAX_NAME_LEN = 256
const MAX_URL_LEN = 8192
const MAX_BODY_LEN = 1_000_000
const MAX_SPEC_CONTENT_LEN = 5_000_000
const MAX_HEADERS = 100
const MAX_HEADER_LEN = 8192
const MAX_ENDPOINTS = 500
const MAX_TIMEOUT_MS = 120_000
const MAX_ENDPOINT_ID_LEN = 512
const ENDPOINT_ID_RE = /^[a-zA-Z0-9-_]+$/

function validationError(message: string): never {
  throw appErrorFromCode('VALIDATION', message, { retryable: false })
}

export function assertUuid(value: unknown, field: string): string {
  if (typeof value !== 'string' || !UUID_RE.test(value)) {
    validationError(`Invalid ${field}.`)
  }
  return value
}

export function assertOptionalUuid(value: unknown, field: string): string | null {
  if (value === null || value === undefined) return null
  return assertUuid(value, field)
}

function assertEndpointId(value: unknown, field: string): string {
  if (
    typeof value !== 'string' ||
    !value ||
    value.length > MAX_ENDPOINT_ID_LEN ||
    !ENDPOINT_ID_RE.test(value)
  ) {
    validationError(`Invalid ${field}.`)
  }
  return value
}

export function assertString(
  value: unknown,
  field: string,
  maxLen = MAX_NAME_LEN
): string {
  if (typeof value !== 'string') validationError(`Invalid ${field}.`)
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > maxLen) validationError(`Invalid ${field}.`)
  return trimmed
}

export function assertOptionalString(
  value: unknown,
  field: string,
  maxLen = MAX_BODY_LEN
): string | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') validationError(`Invalid ${field}.`)
  if (value.length > maxLen) validationError(`${field} is too large.`)
  return value
}

function assertHeaderOrQueryParams(value: unknown, field: string): HeaderOrQueryParam[] {
  if (!Array.isArray(value)) validationError(`Invalid ${field}.`)
  if (value.length > MAX_HEADERS) validationError(`Too many ${field} entries.`)
  return value.map((item, i) => {
    if (!item || typeof item !== 'object') validationError(`Invalid ${field}[${i}].`)
    const row = item as Record<string, unknown>
    return {
      key: assertString(row.key, `${field}[${i}].key`, 512),
      value: assertOptionalString(row.value, `${field}[${i}].value`, MAX_HEADER_LEN) ?? '',
      enabled: row.enabled !== false,
    }
  })
}

function assertAuthConfig(value: unknown): ApiAuthConfig {
  if (!value || typeof value !== 'object') validationError('Invalid auth configuration.')
  const auth = value as Record<string, unknown>
  const type = auth.type
  if (typeof type !== 'string' || !AUTH_TYPES.has(type)) {
    validationError('Invalid auth type.')
  }
  return auth as unknown as ApiAuthConfig
}

const MAX_EMAIL_LEN = 320
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function assertEmail(value: unknown, field: string): string {
  const email = assertString(value, field, MAX_EMAIL_LEN).toLowerCase()
  if (!EMAIL_RE.test(email)) {
    validationError(`Invalid ${field}.`)
  }
  return email
}

export function validateProjectInput(value: unknown): Project {
  if (!value || typeof value !== 'object') validationError('Invalid project.')
  const p = value as Record<string, unknown>
  return {
    id: assertUuid(p.id, 'project id'),
    name: assertString(p.name, 'project name'),
    userId: p.userId === undefined ? undefined : assertUuid(p.userId, 'user id'),
    createdAt: typeof p.createdAt === 'string' ? p.createdAt : new Date().toISOString(),
  }
}

export function validateProjectUpdate(id: unknown, name: unknown): { id: string; name: string } {
  return {
    id: assertUuid(id, 'project id'),
    name: assertString(name, 'project name'),
  }
}

export function validateUserInput(value: unknown): User {
  if (!value || typeof value !== 'object') validationError('Invalid user profile.')
  const u = value as Record<string, unknown>
  return {
    id: assertUuid(u.id, 'user id'),
    name: assertString(u.name, 'name'),
    email: assertEmail(u.email, 'email'),
  }
}

export function validateUserUpdate(id: unknown, name: unknown, email: unknown): User {
  return {
    id: assertUuid(id, 'user id'),
    name: assertString(name, 'name'),
    email: assertEmail(email, 'email'),
  }
}

export function validateApiSpecInput(value: unknown): ApiSpec {
  if (!value || typeof value !== 'object') validationError('Invalid API specification.')
  const s = value as Record<string, unknown>
  return {
    id: assertUuid(s.id, 'spec id'),
    projectId: assertUuid(s.projectId, 'project id'),
    name: assertString(s.name, 'spec name'),
    content: assertOptionalString(s.content, 'spec content', MAX_SPEC_CONTENT_LEN) ?? '',
  }
}

export function validateEnvironmentInput(value: unknown): Environment {
  if (!value || typeof value !== 'object') validationError('Invalid environment.')
  const e = value as Record<string, unknown>
  const type = e.type
  if (typeof type !== 'string' || !ENV_TYPES.has(type)) {
    validationError('Invalid environment type.')
  }
  const variables =
    e.variables && typeof e.variables === 'object' && !Array.isArray(e.variables)
      ? (e.variables as Record<string, string>)
      : {}

  return {
    id: assertUuid(e.id, 'environment id'),
    projectId: assertUuid(e.projectId, 'project id'),
    name: assertString(e.name, 'environment name'),
    variables,
    type: type as Environment['type'],
    baseUrl: assertOptionalString(e.baseUrl, 'base URL', MAX_URL_LEN) ?? '',
    defaultHeaders: assertHeaderOrQueryParams(e.defaultHeaders ?? [], 'defaultHeaders'),
    authConfig: assertAuthConfig(e.authConfig ?? { type: 'none' }),
    isActive: e.isActive === true,
  }
}

export function validateValidationRunInput(value: unknown): ValidationRun {
  if (!value || typeof value !== 'object') validationError('Invalid validation run.')
  const r = value as Record<string, unknown>
  const runSourceRaw =
    r.runSource === undefined || r.runSource === null ? 'manual' : assertString(r.runSource, 'run source', 16)
  if (!RUN_SOURCES.has(runSourceRaw)) {
    validationError('Invalid run source.')
  }
  const batchIdRaw = r.batchId
  const batchId =
    batchIdRaw === undefined || batchIdRaw === null
      ? undefined
      : assertUuid(batchIdRaw, 'batch id')
  return {
    id: assertUuid(r.id, 'run id'),
    projectId: assertUuid(r.projectId, 'project id'),
    url: assertString(r.url, 'url', MAX_URL_LEN),
    method: assertHttpMethod(r.method),
    headers: assertOptionalString(r.headers, 'headers', MAX_BODY_LEN) ?? '{}',
    body: assertOptionalString(r.body, 'body', MAX_BODY_LEN),
    runSource: runSourceRaw as ValidationRun['runSource'],
    batchId,
  }
}

export function validateValidationResultInput(value: unknown): ValidationResult {
  if (!value || typeof value !== 'object') validationError('Invalid validation result.')
  const r = value as Record<string, unknown>
  const status = r.responseStatus
  if (typeof status !== 'number' || status < 0 || status > 999) {
    validationError('Invalid response status.')
  }
  return {
    id: assertUuid(r.id, 'result id'),
    runId: assertUuid(r.runId, 'run id'),
    responseStatus: status,
    responseHeaders: assertOptionalString(r.responseHeaders, 'response headers', MAX_BODY_LEN) ?? '{}',
    responseBody: assertOptionalString(r.responseBody, 'response body', MAX_BODY_LEN),
    validationErrors: assertOptionalString(r.validationErrors, 'validation errors', MAX_BODY_LEN),
    responseTimeMs:
      typeof r.responseTimeMs === 'number' && r.responseTimeMs >= 0 ? r.responseTimeMs : undefined,
  }
}

export function validateParseSpecContent(value: unknown): string {
  const content = assertOptionalString(value, 'specification content', MAX_SPEC_CONTENT_LEN)
  if (!content?.trim()) validationError('Specification content is required.')
  return content
}

export function validateHttpRequestInput(value: unknown): RequestData {
  if (!value || typeof value !== 'object') validationError('Invalid request.')
  const r = value as Record<string, unknown>
  const url = assertString(r.url, 'url', MAX_URL_LEN)
  assertSafeHttpUrl(url)

  const timeout =
    typeof r.timeout === 'number' && r.timeout > 0
      ? Math.min(r.timeout, MAX_TIMEOUT_MS)
      : undefined

  const headers: Record<string, string> = {}
  if (r.headers && typeof r.headers === 'object' && !Array.isArray(r.headers)) {
    const entries = Object.entries(r.headers as Record<string, unknown>)
    if (entries.length > MAX_HEADERS) validationError('Too many request headers.')
    for (const [key, val] of entries) {
      if (typeof val !== 'string' || val.length > MAX_HEADER_LEN) {
        validationError('Invalid request header value.')
      }
      headers[key.toLowerCase().slice(0, 512)] = val
    }
  }

  return {
    url,
    method: assertHttpMethod(r.method),
    headers,
    data: r.data ?? null,
    timeout,
  }
}

export function assertSafeHttpUrl(url: string): void {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    validationError('Request URL is invalid.')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    validationError('Only http and https URLs are allowed.')
  }
  if (parsed.username || parsed.password) {
    validationError('Credentials must not be embedded in the URL.')
  }
}

function assertHttpMethod(value: unknown): string {
  const method = typeof value === 'string' ? value.toUpperCase() : ''
  if (!HTTP_METHODS.has(method as HttpMethod)) {
    validationError('Invalid HTTP method.')
  }
  return method
}

export function validateScheduleInput(value: unknown): SaveValidationScheduleInput {
  if (!value || typeof value !== 'object') validationError('Invalid schedule.')
  const s = value as Record<string, unknown>

  if (!Array.isArray(s.endpointIds) || s.endpointIds.length === 0) {
    validationError('Select at least one API endpoint for the schedule.')
  }
  if (s.endpointIds.length > MAX_ENDPOINTS) validationError('Too many endpoints selected.')

  const scheduledAt = assertString(s.scheduledAt, 'scheduled date and time', 64)
  const scheduledTime = Date.parse(scheduledAt)
  if (Number.isNaN(scheduledTime)) {
    validationError('Invalid scheduled date and time.')
  }
  if (!isScheduleDateAllowed(new Date(scheduledTime))) {
    validationError(
      `Schedule must be in the future and within the next ${SCHEDULE_MAX_DAYS_AHEAD} days.`
    )
  }

  const recurrenceRaw =
    s.recurrenceType === undefined || s.recurrenceType === null
      ? 'once'
      : assertString(s.recurrenceType, 'recurrence type', 16)
  if (!RECURRENCE_TYPES.has(recurrenceRaw)) {
    validationError('Invalid recurrence type.')
  }

  return {
    id: assertUuid(s.id, 'schedule id'),
    userId: s.userId === undefined || s.userId === null ? null : assertUuid(s.userId, 'user id'),
    projectId: assertUuid(s.projectId, 'project id'),
    environmentId: assertUuid(s.environmentId, 'environment id'),
    specId: assertUuid(s.specId, 'spec id'),
    name: assertString(s.name, 'schedule name'),
    endpointIds: s.endpointIds.map((endpointId, index) =>
      assertEndpointId(endpointId, `endpoint id[${index}]`)
    ),
    scheduledAt: new Date(scheduledTime).toISOString(),
    recurrenceType: recurrenceRaw as SaveValidationScheduleInput['recurrenceType'],
  }
}

export function validateExportConfigurationInput(value: unknown): ExportConfigurationInput {
  if (!value || typeof value !== 'object') validationError('Invalid export request.')
  const input = value as Record<string, unknown>
  const scope = assertString(input.scope, 'export scope', 32)

  switch (scope) {
    case 'all-workspaces':
      return { scope, userId: assertUuid(input.userId, 'user id') }
    case 'workspace':
    case 'environments':
    case 'specs':
      return { scope, projectId: assertUuid(input.projectId, 'project id') } as ExportConfigurationInput
    case 'environment':
      return { scope, environmentId: assertUuid(input.environmentId, 'environment id') }
    case 'spec':
      return { scope, specId: assertUuid(input.specId, 'spec id') }
    default:
      validationError('Invalid export scope.')
  }
}

export function validateValidationRunStartInput(value: unknown): StartValidationRunInput {
  if (!value || typeof value !== 'object') validationError('Invalid validation run input.')
  const input = value as Record<string, unknown>

  if (!input.project || typeof input.project !== 'object') {
    validationError('Invalid project.')
  }
  const project = input.project as Record<string, unknown>

  if (!input.environment || typeof input.environment !== 'object') {
    validationError('Invalid environment.')
  }

  if (!Array.isArray(input.endpoints)) validationError('Invalid endpoints list.')
  if (input.endpoints.length === 0) validationError('Select at least one endpoint.')
  if (input.endpoints.length > MAX_ENDPOINTS) validationError('Too many endpoints selected.')

  const parsedSpec =
    input.parsedSpec === null || input.parsedSpec === undefined
      ? null
      : typeof input.parsedSpec === 'object'
        ? (input.parsedSpec as Record<string, unknown>)
        : validationError('Invalid OpenAPI specification.')

  const timeoutMs =
    typeof input.timeoutMs === 'number' && input.timeoutMs > 0
      ? Math.min(input.timeoutMs, MAX_TIMEOUT_MS)
      : undefined

  const runSourceRaw =
    input.runSource === undefined || input.runSource === null
      ? 'manual'
      : assertString(input.runSource, 'run source', 16)
  if (!RUN_SOURCES.has(runSourceRaw)) {
    validationError('Invalid run source.')
  }

  return {
    project: {
      id: assertUuid(project.id, 'project id'),
      name: assertString(project.name, 'project name'),
    },
    environment: validateEnvironmentInput(input.environment) as StartValidationRunInput['environment'],
    endpoints: input.endpoints as StartValidationRunInput['endpoints'],
    parsedSpec,
    timeoutMs,
    runSource: runSourceRaw as StartValidationRunInput['runSource'],
  }
}

export function validateVerifyOAuthTokenInput(value: unknown): {
  tokenUrl: string
  clientId: string
  clientSecret: string
} {
  if (!value || typeof value !== 'object') validationError('Invalid token verification request.')
  const input = value as Record<string, unknown>
  return {
    tokenUrl: assertString(input.tokenUrl, 'token URL', MAX_URL_LEN),
    clientId: assertString(input.clientId, 'client id', MAX_HEADER_LEN),
    clientSecret: assertOptionalString(input.clientSecret, 'client secret', MAX_HEADER_LEN) ?? '',
  }
}

export function validateValidateResponseArgs(
  specContent: unknown,
  path: unknown,
  method: unknown,
  status: unknown,
  responseData: unknown
): {
  specContent: string | Record<string, unknown>
  path: string
  method: string
  status: number
  responseData: unknown
} {
  let spec: string | Record<string, unknown>
  if (typeof specContent === 'string') {
    if (specContent.length > MAX_SPEC_CONTENT_LEN) validationError('Specification is too large.')
    spec = specContent
  } else if (specContent && typeof specContent === 'object') {
    spec = specContent as Record<string, unknown>
  } else {
    validationError('Invalid specification.')
  }

  const statusCode = typeof status === 'number' ? status : Number(status)
  if (!Number.isFinite(statusCode) || statusCode < 0 || statusCode > 999) {
    validationError('Invalid status code.')
  }

  return {
    specContent: spec,
    path: assertString(path, 'path', MAX_URL_LEN),
    method: assertHttpMethod(method),
    status: statusCode,
    responseData,
  }
}

export function validateDeleteValidationRunsInput(value: unknown): string[] {
  if (!Array.isArray(value)) validationError('Invalid validation run ids.')
  if (value.length === 0) validationError('At least one validation run id is required.')
  if (value.length > MAX_ENDPOINTS) validationError('Too many validation run ids.')
  return value.map((id, index) => assertUuid(id, `run id[${index}]`))
}

export function validateProxySettingsInput(value: unknown): ProxySettings {
  if (!value || typeof value !== 'object') validationError('Invalid proxy settings.')
  const input = value as Record<string, unknown>

  const enabled = input.enabled === true
  const host = assertOptionalString(input.host, 'proxy host', 512) ?? ''
  const portRaw = input.port
  const port =
    typeof portRaw === 'number' && portRaw > 0 && portRaw <= 65535
      ? Math.trunc(portRaw)
      : typeof portRaw === 'string' && portRaw.trim()
        ? Math.min(Math.max(Number.parseInt(portRaw, 10) || 8080, 1), 65535)
        : 8080

  if (enabled && !host.trim()) {
    validationError('Proxy host is required when proxy is enabled.')
  }

  return {
    enabled,
    host: host.trim(),
    port,
    username: assertOptionalString(input.username, 'proxy username', 256) ?? '',
    password: assertOptionalString(input.password, 'proxy password', 512) ?? '',
    bypassLocal: input.bypassLocal !== false,
  }
}
