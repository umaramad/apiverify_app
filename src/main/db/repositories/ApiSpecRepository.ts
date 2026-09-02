import { db } from '../database'
import { ApiSpec } from '../../../shared/models'

export class ApiSpecRepository {
  create(spec: ApiSpec): void {
    const stmt = db.prepare('INSERT OR REPLACE INTO api_specs (id, project_id, name, content) VALUES (?, ?, ?, ?)')
    stmt.run(spec.id, spec.projectId, spec.name, spec.content)
  }

  findByProjectId(projectId: string): ApiSpec[] {
    const stmt = db.prepare('SELECT id, project_id as projectId, name, content, created_at as createdAt FROM api_specs WHERE project_id = ? ORDER BY created_at DESC')
    return stmt.all(projectId) as ApiSpec[]
  }

  findById(id: string): ApiSpec | null {
    const stmt = db.prepare(
      'SELECT id, project_id as projectId, name, content, created_at as createdAt FROM api_specs WHERE id = ?'
    )
    return (stmt.get(id) as ApiSpec | undefined) ?? null
  }

  delete(id: string): void {
    const stmt = db.prepare('DELETE FROM api_specs WHERE id = ?')
    stmt.run(id)
  }
}
