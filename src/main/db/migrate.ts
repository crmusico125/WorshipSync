import { sqlite } from './index'

// We use raw SQL for migrations in Commit 2 — simple and no extra tooling needed.
// In a later commit we can swap to drizzle-kit migrations if needed.

export function runMigrations(): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS songs (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      title            TEXT NOT NULL,
      artist           TEXT NOT NULL DEFAULT '',
      key              TEXT,
      tempo            TEXT CHECK(tempo IN ('slow','medium','fast')),
      ccli_number      TEXT,
      background_path  TEXT,
      theme_id         INTEGER,
      tags             TEXT NOT NULL DEFAULT '[]',
      created_at       TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sections (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      song_id     INTEGER NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
      type        TEXT NOT NULL CHECK(type IN ('verse','chorus','bridge','pre-chorus','outro','intro','tag','interlude')),
      label       TEXT NOT NULL,
      lyrics      TEXT NOT NULL DEFAULT '',
      order_index INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS service_dates (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      date       TEXT NOT NULL UNIQUE,
      label      TEXT NOT NULL DEFAULT 'Regular Sunday',
      status     TEXT NOT NULL DEFAULT 'empty' CHECK(status IN ('empty','in-progress','ready')),
      notes      TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS lineup_items (
      id                      INTEGER PRIMARY KEY AUTOINCREMENT,
      service_date_id         INTEGER NOT NULL REFERENCES service_dates(id) ON DELETE CASCADE,
      song_id                 INTEGER NOT NULL REFERENCES songs(id),
      order_index             INTEGER NOT NULL DEFAULT 0,
      selected_sections       TEXT NOT NULL DEFAULT '[]',
      override_theme_id       INTEGER,
      override_background_path TEXT
    );

    CREATE TABLE IF NOT EXISTS themes (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      name         TEXT NOT NULL,
      type         TEXT NOT NULL DEFAULT 'global' CHECK(type IN ('global','seasonal','per-song')),
      is_default   INTEGER NOT NULL DEFAULT 0,
      season_start TEXT,
      season_end   TEXT,
      settings     TEXT NOT NULL DEFAULT '{}',
      created_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS song_usage (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      song_id         INTEGER NOT NULL REFERENCES songs(id),
      service_date_id INTEGER NOT NULL REFERENCES service_dates(id),
      used_at         TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_sections_song_id     ON sections(song_id);
    CREATE INDEX IF NOT EXISTS idx_lineup_service_date  ON lineup_items(service_date_id);
    CREATE INDEX IF NOT EXISTS idx_lineup_song          ON lineup_items(song_id);
    CREATE INDEX IF NOT EXISTS idx_usage_song           ON song_usage(song_id);
    CREATE INDEX IF NOT EXISTS idx_usage_date           ON song_usage(service_date_id);
  `)

  console.log('[db] migrations complete')
}