import { db } from '../database'
import { ValidationRun, ValidationRunSource } from '../../../shared/models'

const MAX_BATCHES = 100

function normalizeRunSource(value: unknown): ValidationRunSource {
  return value === 'scheduler' ? 'scheduler' : 'manual'
}

export class ValidationRunRepository {
  create(run: ValidationRun): void {
    const runSource = normalizeRunSource(run.runSource)
    const stmt = db.prepare(`
      INSERT INTO validation_runs (id, project_id, url, method, headers, body, run_source, batch_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(
      run.id,
      run.projectId,
      run.url,
      run.method,
      run.headers,
      run.body,
      runSource,
      run.batchId ?? null
    )
  }

  findByProjectId(projectId: string): any[] {
    const stmt = db.prepare(`
      WITH recent_batches AS (
        SELECT COALESCE(batch_id, id) AS batch_key, MAX(created_at) AS max_created
        FROM validation_runs
        WHERE project_id = ?
        GROUP BY batch_key
        ORDER BY max_created DESC
        LIMIT ?
      )
      SELECT 
        r.id, r.project_id as projectId, r.url, r.method, r.headers, r.body,
        r.run_source as runSource, r.batch_id as batchId, r.created_at as createdAt,
        res.id as resultId, res.response_status as responseStatus,
        res.validation_errors as validationErrors,
        res.response_time_ms as responseTimeMs
      FROM validation_runs r
      INNER JOIN recent_batches rb ON COALESCE(r.batch_id, r.id) = rb.batch_key
      LEFT JOIN validation_results res ON r.id = res.run_id
      WHERE r.project_id = ? 
      ORDER BY r.created_at DESC
    `)
    const rows = stmt.all(projectId, MAX_BATCHES, projectId) as any[]
    return rows.map((row) => ({
      id: row.id,
      projectId: row.projectId,
      url: row.url,
      method: row.method,
      headers: row.headers,
      body: row.body,
      runSource: normalizeRunSource(row.runSource),
      batchId: row.batchId ?? undefined,
      createdAt: row.createdAt,
      validationResult: row.resultId
        ? {
            id: row.resultId,
            runId: row.id,
            responseStatus: row.responseStatus,
            validationErrors: row.validationErrors,
            responseTimeMs: row.responseTimeMs,
          }
        : undefined,
    }))
  }

  deleteByProjectId(projectId: string): void {
    const stmt = db.prepare('DELETE FROM validation_runs WHERE project_id = ?')
    stmt.run(projectId)
  }

  deleteByIds(runIds: string[]): void {
    if (runIds.length === 0) return
    const placeholders = runIds.map(() => '?').join(', ')
    const stmt = db.prepare(`DELETE FROM validation_runs WHERE id IN (${placeholders})`)
    stmt.run(...runIds)
  }
}
