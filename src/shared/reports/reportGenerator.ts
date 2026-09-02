import type { ValidationReport, ReportFormat } from './types'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function formatRunDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'medium' })
  } catch {
    return iso
  }
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'passed':
      return 'badge-pass'
    case 'failed':
      return 'badge-fail'
    default:
      return 'badge-skip'
  }
}

export function generateJsonReport(report: ValidationReport): string {
  return JSON.stringify(report, null, 2)
}

export function generateCsvReport(report: ValidationReport): string {
  const headers = [
    'Method',
    'Endpoint',
    'URL',
    'Status',
    'HTTP Status',
    'Expected Status',
    'Response Time (ms)',
    'Failure Reasons',
  ]

  const rows = report.endpoints.map((ep) => [
    ep.method,
    ep.endpointLabel,
    ep.url,
    ep.status,
    String(ep.actualStatus || ''),
    ep.expectedStatusCodes.join('; '),
    String(ep.responseTimeMs),
    ep.failureReasons.join(' | ') || ep.skipReason || '',
  ])

  return [headers, ...rows].map((row) => row.map((cell) => escapeCsvField(cell)).join(',')).join('\n')
}

export function generateHtmlReport(report: ValidationReport): string {
  const runDateFormatted = formatRunDate(report.runDate)
  const generatedFormatted = formatRunDate(report.generatedAt)
  const passRate =
    report.summary.totalApis > 0
      ? Math.round((report.summary.passed / report.summary.totalApis) * 100)
      : 0

  const endpointRows = report.endpoints
    .map((ep) => {
      const failureHtml =
        ep.failureReasons.length > 0 || ep.schemaErrors.length > 0
          ? `<ul class="failures">${[
              ...ep.failureReasons.map((r) => `<li>${escapeHtml(r)}</li>`),
              ...ep.schemaErrors.map(
                (e) =>
                  `<li><code>${escapeHtml(e.path || '/')}</code> [${escapeHtml(e.keyword || 'schema')}] ${escapeHtml(e.message)}</li>`
              ),
            ].join('')}</ul>`
          : '<span class="muted">—</span>'

      return `<tr class="row-${ep.status}">
        <td><span class="badge ${statusBadgeClass(ep.status)}">${escapeHtml(ep.status)}</span></td>
        <td><code>${escapeHtml(ep.method)}</code></td>
        <td>${escapeHtml(ep.endpointLabel)}</td>
        <td class="url">${escapeHtml(ep.url)}</td>
        <td>${ep.actualStatus || '—'}</td>
        <td>${ep.expectedStatusCodes.length ? escapeHtml(ep.expectedStatusCodes.join(', ')) : '—'}</td>
        <td>${ep.responseTimeMs}ms</td>
        <td>${failureHtml}</td>
      </tr>`
    })
    .join('\n')

  const failedEndpoints = report.endpoints.filter((ep) => ep.status === 'failed')

  const failureDetailSection =
    failedEndpoints.length > 0
      ? `<section class="section">
          <h2>Detailed Failure Reasons</h2>
          ${failedEndpoints
            .map(
              (ep) => `<article class="failure-card">
              <h3>${escapeHtml(ep.endpointLabel)}</h3>
              <p class="meta">${escapeHtml(ep.method)} · HTTP ${ep.actualStatus} · ${ep.responseTimeMs}ms</p>
              <p class="url">${escapeHtml(ep.url)}</p>
              ${
                ep.expectedStatusCodes.length
                  ? `<p><strong>Expected status:</strong> ${escapeHtml(ep.expectedStatusCodes.join(', '))}</p>`
                  : ''
              }
              <ul>${[
                ...ep.failureReasons.map((r) => `<li>${escapeHtml(r)}</li>`),
                ...ep.schemaErrors.map(
                  (e) =>
                    `<li><strong>${escapeHtml(e.path || '/')} (${escapeHtml(e.keyword || 'schema')}):</strong> ${escapeHtml(e.message)}</li>`
                ),
              ].join('')}</ul>
            </article>`
            )
            .join('')}
        </section>`
      : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Validation Report — ${escapeHtml(report.projectName)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 32px; background: #f8fafc; color: #0f172a; line-height: 1.5; }
    .container { max-width: 1100px; margin: 0 auto; }
    h1 { font-size: 1.75rem; margin: 0 0 8px; }
    h2 { font-size: 1.15rem; margin: 0 0 16px; }
    h3 { font-size: 1rem; margin: 0 0 8px; }
    .subtitle { color: #64748b; margin-bottom: 24px; }
    .meta-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .meta-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; }
    .meta-card label { display: block; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; font-weight: 700; margin-bottom: 4px; }
    .meta-card value { display: block; font-size: 1rem; font-weight: 700; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 32px; }
    .stat { background: #fff; border-radius: 10px; padding: 20px; border: 1px solid #e2e8f0; text-align: center; }
    .stat .num { font-size: 1.75rem; font-weight: 800; }
    .stat.pass .num { color: #10b981; }
    .stat.fail .num { color: #ef4444; }
    .stat.skip .num { color: #f59e0b; }
    .stat.latency .num { color: #3b82f6; font-size: 1.35rem; }
    .stat label { font-size: 0.8rem; color: #64748b; font-weight: 600; }
    .section { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
    th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
    th { background: #f1f5f9; font-weight: 700; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; color: #475569; }
    tr.row-failed { background: #fef2f2; }
    tr.row-skipped { background: #fffbeb; }
    .url { font-family: monospace; font-size: 0.78rem; word-break: break-all; color: #475569; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; }
    .badge-pass { background: #d1fae5; color: #065f46; }
    .badge-fail { background: #fee2e2; color: #991b1b; }
    .badge-skip { background: #fef3c7; color: #92400e; }
    .failures { margin: 0; padding-left: 18px; color: #b91c1c; }
    .failures li { margin-bottom: 4px; }
    .muted { color: #94a3b8; }
    .failure-card { border: 1px solid #fecaca; background: #fff5f5; border-radius: 8px; padding: 16px; margin-bottom: 12px; }
    .failure-card .meta { color: #64748b; font-size: 0.85rem; margin: 0 0 4px; }
    footer { text-align: center; color: #94a3b8; font-size: 0.8rem; margin-top: 32px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>API Validation Report</h1>
    <p class="subtitle">Generated by APIVerify · ${escapeHtml(generatedFormatted)}</p>

    <div class="meta-grid">
      <div class="meta-card"><label>Project</label><value>${escapeHtml(report.projectName)}</value></div>
      <div class="meta-card"><label>Environment</label><value>${escapeHtml(report.environmentName)}</value></div>
      <div class="meta-card"><label>Run Date</label><value>${escapeHtml(runDateFormatted)}</value></div>
      <div class="meta-card"><label>Pass Rate</label><value>${passRate}%</value></div>
    </div>

    <div class="stats">
      <div class="stat"><div class="num">${report.summary.totalApis}</div><label>Total APIs</label></div>
      <div class="stat pass"><div class="num">${report.summary.passed}</div><label>Passed</label></div>
      <div class="stat fail"><div class="num">${report.summary.failed}</div><label>Failed</label></div>
      <div class="stat skip"><div class="num">${report.summary.skipped}</div><label>Skipped</label></div>
      <div class="stat latency"><div class="num">${report.summary.avgResponseTimeMs}ms</div><label>Avg Response Time</label></div>
    </div>

    <section class="section">
      <h2>Endpoint Results</h2>
      <table>
        <thead>
          <tr>
            <th>Status</th>
            <th>Method</th>
            <th>Endpoint</th>
            <th>URL</th>
            <th>HTTP</th>
            <th>Expected</th>
            <th>Time</th>
            <th>Failures</th>
          </tr>
        </thead>
        <tbody>
          ${endpointRows}
        </tbody>
      </table>
    </section>

    ${failureDetailSection}

    <footer>APIVerify REST API Validation Report</footer>
  </div>
</body>
</html>`
}

export function generateReport(report: ValidationReport, format: 'html' | 'json' | 'csv'): string {
  switch (format) {
    case 'html':
      return generateHtmlReport(report)
    case 'json':
      return generateJsonReport(report)
    case 'csv':
      return generateCsvReport(report)
  }
}

export function buildReportFilename(report: ValidationReport, format: ReportFormat): string {
  const slug = report.projectName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  const date = report.runDate.slice(0, 10)
  return `validation-report-${slug || 'project'}-${date}.${format}`
}
