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
      song_id                 INTEGER REFERENCES songs(id),
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

  // ── Migration: make song_id nullable + add item_type column ─────────────
  try {
    const cols = sqlite.prepare("PRAGMA table_info(lineup_items)").all() as { name: string; notnull: number }[]
    const songIdCol = cols.find(c => c.name === 'song_id')
    const hasItemType = cols.some(c => c.name === 'item_type')

    if (songIdCol && songIdCol.notnull === 1) {
      // Recreate table to make song_id nullable and add item_type
      sqlite.exec(`
        CREATE TABLE lineup_items_new (
          id                       INTEGER PRIMARY KEY AUTOINCREMENT,
          service_date_id          INTEGER NOT NULL REFERENCES service_dates(id) ON DELETE CASCADE,
          song_id                  INTEGER REFERENCES songs(id),
          item_type                TEXT NOT NULL DEFAULT 'song',
          order_index              INTEGER NOT NULL DEFAULT 0,
          selected_sections        TEXT NOT NULL DEFAULT '[]',
          override_theme_id        INTEGER,
          override_background_path TEXT
        );
        INSERT INTO lineup_items_new (id, service_date_id, song_id, item_type, order_index, selected_sections, override_theme_id, override_background_path)
          SELECT id, service_date_id, song_id, ${hasItemType ? 'item_type' : "'song'"}, order_index, selected_sections, override_theme_id, override_background_path
          FROM lineup_items;
        DROP TABLE lineup_items;
        ALTER TABLE lineup_items_new RENAME TO lineup_items;
        CREATE INDEX IF NOT EXISTS idx_lineup_service_date ON lineup_items(service_date_id);
        CREATE INDEX IF NOT EXISTS idx_lineup_song ON lineup_items(song_id);
      `)
      console.log('[db] migration: recreated lineup_items with nullable song_id and item_type')
    } else if (!hasItemType) {
      sqlite.exec(`ALTER TABLE lineup_items ADD COLUMN item_type TEXT NOT NULL DEFAULT 'song'`)
      console.log('[db] migration: added item_type column to lineup_items')
    }
  } catch (e) {
    console.error('[db] migration error (lineup_items):', e)
  }

  // ── Migration: add notes column to lineup_items ──────────────────────────
  try {
    const cols2 = sqlite.prepare("PRAGMA table_info(lineup_items)").all() as { name: string }[]
    if (!cols2.some(c => c.name === 'notes')) {
      sqlite.exec(`ALTER TABLE lineup_items ADD COLUMN notes TEXT`)
      console.log('[db] migration: added notes column to lineup_items')
    }
  } catch (e) {
    console.error('[db] migration error (lineup_items notes):', e)
  }

  // ── Migration: first-class lineup item types (title, scripture_ref, media_path) ──
  try {
    const cols3 = sqlite.prepare("PRAGMA table_info(lineup_items)").all() as { name: string }[]
    const hasTitle       = cols3.some(c => c.name === 'title')
    const hasScriptureRef = cols3.some(c => c.name === 'scripture_ref')
    const hasMediaPath   = cols3.some(c => c.name === 'media_path')

    if (!hasTitle)        sqlite.exec(`ALTER TABLE lineup_items ADD COLUMN title TEXT`)
    if (!hasScriptureRef) sqlite.exec(`ALTER TABLE lineup_items ADD COLUMN scripture_ref TEXT`)
    if (!hasMediaPath)    sqlite.exec(`ALTER TABLE lineup_items ADD COLUMN media_path TEXT`)

    if (!hasTitle || !hasScriptureRef || !hasMediaPath) {
      console.log('[db] migration: added title/scripture_ref/media_path columns to lineup_items')

      // Migrate fake Scripture songs → scripture lineup items
      const scriptureItems = sqlite.prepare(`
        SELECT li.id, li.song_id, s.title
        FROM lineup_items li
        JOIN songs s ON s.id = li.song_id
        WHERE s.artist = 'Scripture'
      `).all() as { id: number; song_id: number; title: string }[]

      const getSections = sqlite.prepare(`SELECT label, lyrics, order_index FROM sections WHERE song_id = ? ORDER BY order_index`)
      const updateScripture = sqlite.prepare(`
        UPDATE lineup_items SET item_type = 'scripture', title = ?, scripture_ref = ?, song_id = NULL WHERE id = ?
      `)
      for (const row of scriptureItems) {
        const secs = getSections.all(row.song_id) as { label: string; lyrics: string; order_index: number }[]
        const verses = secs.map(s => ({ label: s.label, text: s.lyrics }))
        updateScripture.run(row.title, JSON.stringify({ verses }), row.id)
      }
      if (scriptureItems.length > 0)
        console.log(`[db] migration: converted ${scriptureItems.length} scripture fake-songs to lineup items`)

      // Migrate fake Media songs → media lineup items
      const mediaItems = sqlite.prepare(`
        SELECT li.id, li.song_id, s.title, s.background_path
        FROM lineup_items li
        JOIN songs s ON s.id = li.song_id
        WHERE s.artist = 'Media'
      `).all() as { id: number; song_id: number; title: string; background_path: string | null }[]

      const updateMedia = sqlite.prepare(`
        UPDATE lineup_items SET item_type = 'media', title = ?, media_path = ?, song_id = NULL WHERE id = ?
      `)
      for (const row of mediaItems) {
        updateMedia.run(row.title, row.background_path, row.id)
      }
      if (mediaItems.length > 0)
        console.log(`[db] migration: converted ${mediaItems.length} media fake-songs to lineup items`)

    }

    // Always clean up any remaining fake Scripture/Media songs (idempotent)
    const deleted = sqlite.prepare(`DELETE FROM songs WHERE artist IN ('Scripture', 'Media')`).run()
    if (deleted.changes > 0)
      console.log(`[db] migration: cleaned up ${deleted.changes} orphaned Scripture/Media fake songs`)
  } catch (e) {
    console.error('[db] migration error (lineup_items first-class types):', e)
  }

  console.log('[db] migrations complete')
}