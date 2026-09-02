import { db } from '../database'
import { Environment } from '../../../shared/models'

function mapEnvironmentRow(row: Record<string, unknown>): Environment {
  return {
    id: row.id as string,
    projectId: row.projectId as string,
    name: row.name as string,
    isActive: Boolean(row.isActive),
    type: row.type as Environment['type'],
    baseUrl: (row.baseUrl as string) || '',
    createdAt: row.createdAt as string | undefined,
    variables:
      typeof row.variables === 'string' ? JSON.parse(row.variables) : (row.variables as Record<string, string>),
    defaultHeaders:
      typeof row.defaultHeaders === 'string'
        ? JSON.parse(row.defaultHeaders)
        : (row.defaultHeaders as Environment['defaultHeaders']),
    authConfig:
      typeof row.authConfig === 'string'
        ? JSON.parse(row.authConfig)
        : (row.authConfig as Environment['authConfig']),
  }
}

export class EnvironmentRepository {
  create(env: Environment): void {
    const stmt = db.prepare(
      'INSERT OR REPLACE INTO environments (id, project_id, name, variables, is_active, type, base_url, default_headers, auth_config) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )
    stmt.run(
      env.id,
      env.projectId,
      env.name,
      typeof env.variables === 'string' ? env.variables : JSON.stringify(env.variables),
      env.isActive ? 1 : 0,
      env.type || 'Custom',
      env.baseUrl || '',
      typeof env.defaultHeaders === 'string'
        ? env.defaultHeaders
        : JSON.stringify(env.defaultHeaders || []),
      typeof env.authConfig === 'string'
        ? env.authConfig
        : JSON.stringify(env.authConfig || { type: 'none' })
    )
  }

  findByProjectId(projectId: string): Environment[] {
    const stmt = db.prepare(
      'SELECT id, project_id as projectId, name, variables, is_active as isActive, type, base_url as baseUrl, default_headers as defaultHeaders, auth_config as authConfig, created_at as createdAt FROM environments WHERE project_id = ? ORDER BY created_at DESC'
    )
    return (stmt.all(projectId) as Record<string, unknown>[]).map(mapEnvironmentRow)
  }

  findById(id: string): Environment | null {
    const stmt = db.prepare(
      'SELECT id, project_id as projectId, name, variables, is_active as isActive, type, base_url as baseUrl, default_headers as defaultHeaders, auth_config as authConfig, created_at as createdAt FROM environments WHERE id = ?'
    )
    const row = stmt.get(id) as Record<string, unknown> | undefined
    return row ? mapEnvironmentRow(row) : null
  }

  delete(id: string): void {
    const stmt = db.prepare('DELETE FROM environments WHERE id = ?')
    stmt.run(id)
  }

  setActive(projectId: string, activeId: string | null): void {
    const resetStmt = db.prepare('UPDATE environments SET is_active = 0 WHERE project_id = ?')
    resetStmt.run(projectId)
    if (activeId) {
      const setStmt = db.prepare('UPDATE environments SET is_active = 1 WHERE id = ?')
      setStmt.run(activeId)
    }
  }
}
