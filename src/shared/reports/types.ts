export type ReportEndpointStatus = 'passed' | 'failed' | 'skipped'

export interface ValidationReportSchemaError {
  path?: string
  keyword?: string
  message: string
  severity?: string
}

export interface ValidationReportEndpoint {
  method: string
  url: string
  endpointLabel: string
  status: ReportEndpointStatus
  actualStatus: number
  expectedStatusCodes: string[]
  responseTimeMs: number
  failureReasons: string[]
  schemaErrors: ValidationReportSchemaError[]
  skipReason?: string
}

export interface ValidationReport {
  projectName: string
  environmentName: string
  runDate: string
  generatedAt: string
  summary: {
    totalApis: number
    passed: number
    failed: number
    skipped: number
    avgResponseTimeMs: number
  }
  endpoints: ValidationReportEndpoint[]
}

export type ReportFormat = 'html' | 'json' | 'csv'
