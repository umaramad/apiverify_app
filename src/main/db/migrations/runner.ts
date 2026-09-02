import { db } from '../database'
import { getLogger } from '../../../shared/logger'
import { MIGRATIONS } from './definitions'

const logger = getLogger().child('migrations')

function projectsTableExists(): boolean {
  const row = db
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'projects'`)
    .get()
  return row != null
}

/** Recover DBs created when migrations were read from the bundled main output directory. */
function repairBrokenMigrationState(): void {
  if (projectsTableExists()) return

  const applied = db.prepare('SELECT name FROM migrations').all() as Array<{ name: string }>
  if (applied.length === 0) return

  logger.warn('Schema missing but migrations recorded; resetting migration history')
  db.exec('DELETE FROM migrations')
}

export function runMigrations(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `)

  repairBrokenMigrationState()

  const executedMigrations = new Set(
    (db.prepare('SELECT name FROM migrations').all() as Array<{ name: string }>).map(
      (row) => row.name
    )
  )

  const insertMigration = db.prepare('INSERT INTO migrations (name) VALUES (?)')

  db.transaction(() => {
    for (const migration of MIGRATIONS) {
      if (executedMigrations.has(migration.name)) continue

      logger.info(`Running migration: ${migration.name}`)
      db.exec(migration.sql)
      insertMigration.run(migration.name)
    }
  })()
}
