import initialSchema from './001-initial-schema.sql?raw'
import environmentFields from './002-environment-fields.sql?raw'
import responseTime from './003-response-time.sql?raw'
import users from './004-users.sql?raw'
import projectUserId from './005-project-user-id.sql?raw'
import validationSchedules from './006-validation-schedules.sql?raw'
import scheduleRecurrence from './007-schedule-recurrence.sql?raw'
import validationRunSource from './008-validation-run-source.sql?raw'
import validationRunBatch from './009-validation-run-batch.sql?raw'
import appSettings from './010-app-settings.sql?raw'

export interface MigrationDefinition {
  name: string
  sql: string
}

/** Ordered migrations bundled at build time (filesystem paths are unavailable in the main bundle). */
export const MIGRATIONS: MigrationDefinition[] = [
  { name: '001-initial-schema.sql', sql: initialSchema },
  { name: '002-environment-fields.sql', sql: environmentFields },
  { name: '003-response-time.sql', sql: responseTime },
  { name: '004-users.sql', sql: users },
  { name: '005-project-user-id.sql', sql: projectUserId },
  { name: '006-validation-schedules.sql', sql: validationSchedules },
  { name: '007-schedule-recurrence.sql', sql: scheduleRecurrence },
  { name: '008-validation-run-source.sql', sql: validationRunSource },
  { name: '009-validation-run-batch.sql', sql: validationRunBatch },
  { name: '010-app-settings.sql', sql: appSettings },
]
