import { sqlite, db } from '../../../db/index'
import { runMigrations } from '../../../db/migrate'
import { lineupItems, sections, serviceDates, songs, syncImportLog, syncKnownAssets, themes } from '../../../db/schema'

let migrated = false

/** Ensures the schema (including sync_uuid columns + sync tables) exists — runMigrations() is idempotent. */
export function ensureMigrated(): void {
  if (migrated) return
  runMigrations()
  migrated = true
}

/** Wipes every table these tests touch — needed because db/index.ts opens one shared connection per test file, not per test case. */
export function resetTables(): void {
  sqlite.exec(`
    DELETE FROM sync_known_assets;
    DELETE FROM sync_import_log;
    DELETE FROM lineup_items;
    DELETE FROM sections;
    DELETE FROM songs;
    DELETE FROM service_dates;
    DELETE FROM themes;
  `)
}

export { db, songs, sections, serviceDates, lineupItems, themes, syncImportLog, syncKnownAssets }
