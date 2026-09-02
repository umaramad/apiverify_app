import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

let dbPath = ':memory:'

try {
  const { app } = require('electron')
  if (app && typeof app.getPath === 'function') {
    const userDataPath = app.getPath('userData')
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true })
    }
    dbPath = path.join(userDataPath, 'rest_api_validator.db')
  }
} catch (e) {
  // Fallback for non-electron environments (e.g. tests)
  dbPath = process.env.NODE_ENV === 'test' ? ':memory:' : 'dev_rest_api_validator.db'
}

export const db = new Database(dbPath)
db.pragma('foreign_keys = ON')
