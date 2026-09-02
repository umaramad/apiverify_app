import type { ValidationReport, ValidationReportEndpoint } from '../../../shared/reports'
import { parseEndpointResult, type ValidationRunSession } from './validationResults'

function buildFailureReasons(parsed: ReturnType<typeof parseEndpointResult>): string[] {
  const reasons: string[] = []
  if (parsed.skipReason && parsed.status !== 'passed') {
    reasons.push(parsed.skipReason)
  }
  for (const err of parsed.errors) {
    if (!err.keyword || parsed.status === 'failed') {
      reasons.push(err.message)
    }
  }
  return [...new Set(reasons)]
}

export function buildValidationReport(
  session: ValidationRunSession,
  projectName: string,
  environmentName: string
): ValidationReport {
  const endpoints: ValidationReportEndpoint[] = session.entries.map((entry) => {
    const parsed = parseEndpointResult(entry)
    const schemaErrors = parsed.errors
      .filter((e) => e.keyword)
      .map((e) => ({
        path: e.path,
        keyword: e.keyword,
        message: e.message,
        severity: e.severity,
      }))

    return {
      method: entry.method,
      url: entry.url,
      endpointLabel: parsed.endpointLabel,
      status: parsed.status,
      actualStatus: parsed.actualStatus,
      expectedStatusCodes: parsed.expectedStatusCodes,
      responseTimeMs: parsed.responseTimeMs,
      failureReasons: buildFailureReasons(parsed),
      schemaErrors,
      skipReason: parsed.skipReason,
    }
  })

  return {
    projectName,
    environmentName,
    runDate: session.startedAt,
    generatedAt: new Date().toISOString(),
    summary: {
      totalApis: session.summary.total,
      passed: session.summary.passed,
      failed: session.summary.failed,
      skipped: session.summary.skipped,
      avgResponseTimeMs: session.summary.avgResponseTimeMs,
    },
    endpoints,
  }
}

export function downloadReport(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export const REPORT_MIME_TYPES = {
  html: 'text/html;charset=utf-8',
  json: 'application/json;charset=utf-8',
  csv: 'text/csv;charset=utf-8',
} as const
