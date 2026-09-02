import { db } from '../database'
import { ValidationResult } from '../../../shared/models'

export class ValidationResultRepository {
  create(result: ValidationResult): void {
    const stmt = db.prepare(`
      INSERT INTO validation_results (id, run_id, response_status, response_headers, response_body, validation_errors, response_time_ms)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(
      result.id,
      result.runId,
      result.responseStatus,
      result.responseHeaders,
      result.responseBody,
      result.validationErrors,
      result.responseTimeMs ?? null
    )
  }

  findByRunId(runId: string): ValidationResult | null {
    const stmt = db.prepare(`
      SELECT id, run_id as runId, response_status as responseStatus, response_headers as responseHeaders,
             response_body as responseBody, validation_errors as validationErrors,
             response_time_ms as responseTimeMs, created_at as createdAt
      FROM validation_results WHERE run_id = ?
    `)
    return stmt.get(runId) as ValidationResult | null
  }
}
