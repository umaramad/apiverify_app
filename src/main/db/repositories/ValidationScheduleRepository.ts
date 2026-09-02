import { db } from '../database'
import type { SaveValidationScheduleInput, ValidationSchedule, ValidationScheduleStatus } from '../../../shared/models/scheduler'
import { computeRecurrenceEndsAt } from '../../../shared/scheduler/recurrence'

function mapRow(row: Record<string, unknown>): ValidationSchedule {
  let endpointIds: string[] = []
  try {
    const parsed = JSON.parse(String(row.endpointIds ?? '[]'))
    endpointIds = Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    endpointIds = []
  }

  const recurrenceType = (row.recurrenceType as ValidationSchedule['recurrenceType']) ?? 'once'

  return {
    id: row.id as string,
    userId: (row.userId as string | null) ?? null,
    projectId: row.projectId as string,
    environmentId: row.environmentId as string,
    specId: row.specId as string,
    name: row.name as string,
    endpointIds,
    scheduledAt: row.scheduledAt as string,
    recurrenceType,
    recurrenceEndsAt: (row.recurrenceEndsAt as string | null) ?? null,
    status: row.status as ValidationScheduleStatus,
    lastError: (row.lastError as string | null) ?? null,
    executedAt: (row.executedAt as string | null) ?? null,
    createdAt: row.createdAt as string | undefined,
  }
}

const SCHEDULE_SELECT = `
  SELECT
    id,
    user_id as userId,
    project_id as projectId,
    environment_id as environmentId,
    spec_id as specId,
    name,
    endpoint_ids as endpointIds,
    scheduled_at as scheduledAt,
    recurrence_type as recurrenceType,
    recurrence_ends_at as recurrenceEndsAt,
    status,
    last_error as lastError,
    executed_at as executedAt,
    created_at as createdAt
  FROM validation_schedules
`

export class ValidationScheduleRepository {
  save(input: SaveValidationScheduleInput): void {
    const recurrenceType = input.recurrenceType ?? 'once'
    const recurrenceEndsAt =
      recurrenceType === 'once'
        ? null
        : computeRecurrenceEndsAt(new Date(input.scheduledAt))

    const stmt = db.prepare(`
      INSERT INTO validation_schedules (
        id, user_id, project_id, environment_id, spec_id, name, endpoint_ids,
        scheduled_at, recurrence_type, recurrence_ends_at, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
      ON CONFLICT(id) DO UPDATE SET
        project_id = excluded.project_id,
        environment_id = excluded.environment_id,
        spec_id = excluded.spec_id,
        name = excluded.name,
        endpoint_ids = excluded.endpoint_ids,
        scheduled_at = excluded.scheduled_at,
        recurrence_type = excluded.recurrence_type,
        recurrence_ends_at = excluded.recurrence_ends_at,
        status = 'pending',
        last_error = NULL,
        executed_at = NULL
    `)
    stmt.run(
      input.id,
      input.userId ?? null,
      input.projectId,
      input.environmentId,
      input.specId,
      input.name,
      JSON.stringify(input.endpointIds),
      input.scheduledAt,
      recurrenceType,
      recurrenceEndsAt
    )
  }

  findByUserId(userId: string): ValidationSchedule[] {
    const stmt = db.prepare(`${SCHEDULE_SELECT} WHERE user_id = ? ORDER BY scheduled_at ASC`)
    return (stmt.all(userId) as Record<string, unknown>[]).map(mapRow)
  }

  findById(id: string): ValidationSchedule | null {
    const stmt = db.prepare(`${SCHEDULE_SELECT} WHERE id = ?`)
    const row = stmt.get(id) as Record<string, unknown> | undefined
    return row ? mapRow(row) : null
  }

  findDuePending(nowIso: string): ValidationSchedule[] {
    const stmt = db.prepare(`
      ${SCHEDULE_SELECT}
      WHERE status = 'pending' AND scheduled_at <= ?
      ORDER BY scheduled_at ASC
    `)
    return (stmt.all(nowIso) as Record<string, unknown>[]).map(mapRow)
  }

  updateStatus(
    id: string,
    status: ValidationScheduleStatus,
    options?: { lastError?: string | null; executedAt?: string | null }
  ): ValidationSchedule | null {
    const stmt = db.prepare(`
      UPDATE validation_schedules
      SET status = ?, last_error = ?, executed_at = ?
      WHERE id = ?
    `)
    stmt.run(
      status,
      options?.lastError ?? null,
      options?.executedAt ?? null,
      id
    )
    return this.findById(id)
  }

  rescheduleNextRun(id: string, nextScheduledAt: string): ValidationSchedule | null {
    const stmt = db.prepare(`
      UPDATE validation_schedules
      SET scheduled_at = ?, status = 'pending', last_error = NULL, executed_at = ?
      WHERE id = ?
    `)
    stmt.run(nextScheduledAt, new Date().toISOString(), id)
    return this.findById(id)
  }

  delete(id: string): void {
    const stmt = db.prepare('DELETE FROM validation_schedules WHERE id = ?')
    stmt.run(id)
  }
}
