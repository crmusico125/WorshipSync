import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import * as schema from './schema'

const DB_FILENAME = 'worshipsync.db'

function getDbPath(): string {
  // In dev, store next to the project. In production, store in userData.
  if (process.env.NODE_ENV === 'development') {
    return join(process.cwd(), DB_FILENAME)
  }
  return join(app.getPath('userData'), DB_FILENAME)
}

// Create the SQLite connection — synchronous, fast, no setup needed
const sqlite = new Database(getDbPath())

// Enable WAL mode for better concurrent read performance
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

console.log('[db] database opened at:', getDbPath())

// Drizzle ORM instance — typed queries against our schema
export const db = drizzle(sqlite, { schema })

// Export raw sqlite instance for migrations
export { sqlite }