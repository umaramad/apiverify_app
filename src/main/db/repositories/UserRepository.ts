import { db } from '../database'
import type { User } from '../../../shared/models'

export class UserRepository {
  create(user: User): void {
    const stmt = db.prepare(`
      INSERT INTO users (id, name, email)
      VALUES (?, ?, ?)
    `)
    stmt.run(user.id, user.name, user.email)
  }

  update(id: string, name: string, email: string): User | null {
    const stmt = db.prepare(`
      UPDATE users
      SET name = ?, email = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)
    stmt.run(name, email, id)
    return this.findById(id)
  }

  findById(id: string): User | null {
    const stmt = db.prepare(`
      SELECT id, name, email, created_at as createdAt, updated_at as updatedAt
      FROM users
      WHERE id = ?
    `)
    return (stmt.get(id) as User | undefined) ?? null
  }

  findFirst(): User | null {
    const stmt = db.prepare(`
      SELECT id, name, email, created_at as createdAt, updated_at as updatedAt
      FROM users
      ORDER BY created_at ASC
      LIMIT 1
    `)
    return (stmt.get() as User | undefined) ?? null
  }

  delete(id: string): void {
    const stmt = db.prepare('DELETE FROM users WHERE id = ?')
    stmt.run(id)
  }
}
