import { db } from '../database'
import { Project } from '../../../shared/models'

function mapProjectRow(row: Record<string, unknown>): Project {
  return {
    id: row.id as string,
    name: row.name as string,
    userId: (row.userId as string | null) ?? undefined,
    createdAt: row.createdAt as string,
  }
}

export class ProjectRepository {
  create(project: Project): void {
    const stmt = db.prepare('INSERT INTO projects (id, name, user_id) VALUES (?, ?, ?)')
    stmt.run(project.id, project.name, project.userId ?? null)
  }

  update(id: string, name: string): void {
    const stmt = db.prepare('UPDATE projects SET name = ? WHERE id = ?')
    stmt.run(name, id)
  }

  findAll(): Project[] {
    const stmt = db.prepare(`
      SELECT id, name, user_id as userId, created_at as createdAt
      FROM projects
      ORDER BY created_at DESC
    `)
    return (stmt.all() as Record<string, unknown>[]).map(mapProjectRow)
  }

  findById(id: string): Project | null {
    const stmt = db.prepare(`
      SELECT id, name, user_id as userId, created_at as createdAt
      FROM projects
      WHERE id = ?
    `)
    const row = stmt.get(id) as Record<string, unknown> | undefined
    return row ? mapProjectRow(row) : null
  }

  findByUserId(userId: string): Project[] {
    const stmt = db.prepare(`
      SELECT id, name, user_id as userId, created_at as createdAt
      FROM projects
      WHERE user_id = ?
      ORDER BY created_at DESC
    `)
    return (stmt.all(userId) as Record<string, unknown>[]).map(mapProjectRow)
  }

  assignOrphansToUser(userId: string): void {
    const stmt = db.prepare(`
      UPDATE projects
      SET user_id = ?
      WHERE user_id IS NULL
    `)
    stmt.run(userId)
  }

  delete(id: string): void {
    const stmt = db.prepare('DELETE FROM projects WHERE id = ?')
    stmt.run(id)
  }
}
