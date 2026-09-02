import type { ApiAuthConfig, HttpMethod } from './index'

export type ValidationConsoleLogLevel = 'info' | 'request' | 'response' | 'error' | 'success' | 'warn'

export interface ValidationConsoleLogEntry {
  id: string
  timestamp: string
  level: ValidationConsoleLogLevel
  message: string
  detail?: string
}

export interface ValidationRunProgressResult {
  endpointId: string
  endpointName: string
  endpointPath: string
  method: HttpMethod
  passed: boolean
  responseStatus: number
  responseTimeMs: number
  requestError?: string
}

export interface ValidationRunProgressEvent {
  type: 'started' | 'progress' | 'complete' | 'cancelled' | 'error' | 'log'
  current?: number
  total?: number
  result?: ValidationRunProgressResult
  log?: ValidationConsoleLogEntry
  summary?: {
    total: number
    passed: number
    failed: number
    avgResponseTimeMs: number
  }
  error?: string
}

export interface StartValidationRunInput {
  project: { id: string; name: string }
  environment: {
    id: string
    projectId: string
    name: string
    variables: Record<string, string>
    type: string
    baseUrl: string
    defaultHeaders: Array<{ key: string; value: string; enabled: boolean }>
    authConfig: ApiAuthConfig
    isActive: boolean
  }
  endpoints: Array<{
    id: string
    projectId: string
    name: string
    path: string
    method: HttpMethod
    headers: Array<{ key: string; value: string; enabled: boolean }>
    queryParams: Array<{ key: string; value: string; enabled: boolean }>
    body: string | null
    authConfig: ApiAuthConfig
    pathVariables?: Record<string, string>
  }>
  parsedSpec: Record<string, unknown> | null
  timeoutMs?: number
  runSource?: 'manual' | 'scheduler'
}

export interface StartValidationRunOutput {
  cancelled: boolean
  summary: {
    total: number
    passed: number
    failed: number
    avgResponseTimeMs: number
  }
}
