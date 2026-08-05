import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'

// ── Songs ─────────────────────────────────────────────────────────────────────
export const songs = sqliteTable('songs', {
  id:             integer('id').primaryKey({ autoIncrement: true }),
  title:          text('title').notNull(),
  artist:         text('artist').notNull().default(''),
  key:            text('key'),
  tempo:          text('tempo', { enum: ['slow', 'medium', 'fast'] }),
  ccliNumber:     text('ccli_number'),
  copyright:      text('copyright'),
  backgroundPath:  text('background_path'),
  themeId:         integer('theme_id'),
  styleOverrides:  text('style_overrides'),
  tags:           text('tags').notNull().default('[]'),
  // Stable cross-device identity for Sync Workspace packages — null until this song is first published or imported.
  syncUuid:       text('sync_uuid'),
  createdAt:      text('created_at').notNull().default("(datetime('now'))"),
  updatedAt:      text('updated_at').notNull().default("(datetime('now'))")
})

// ── Sections ──────────────────────────────────────────────────────────────────
export const sections = sqliteTable('sections', {
  id:         integer('id').primaryKey({ autoIncrement: true }),
  songId:     integer('song_id').notNull().references(() => songs.id, { onDelete: 'cascade' }),
  type:       text('type', {
                enum: ['verse', 'chorus', 'bridge', 'pre-chorus', 'outro', 'intro', 'tag', 'interlude']
              }).notNull(),
  label:      text('label').notNull(),
  lyrics:     text('lyrics').notNull().default(''),
  orderIndex: integer('order_index').notNull().default(0)
})

// ── Service dates ─────────────────────────────────────────────────────────────
export const serviceDates = sqliteTable('service_dates', {
  id:        integer('id').primaryKey({ autoIncrement: true }),
  date:      text('date').notNull().unique(),
  label:     text('label').notNull().default('Regular Sunday'),
  status:    text('status', { enum: ['empty', 'in-progress', 'ready'] }).notNull().default('empty'),
  notes:     text('notes'),
  // Stable cross-device identity for Sync Workspace packages — null until this service is first published or imported.
  syncUuid:  text('sync_uuid'),
  createdAt: text('created_at').notNull().default("(datetime('now'))"),
  updatedAt: text('updated_at').notNull().default("(datetime('now'))")
})

// ── Lineup items ──────────────────────────────────────────────────────────────
export const lineupItems = sqliteTable('lineup_items', {
  id:                     integer('id').primaryKey({ autoIncrement: true }),
  serviceDateId:          integer('service_date_id').notNull().references(() => serviceDates.id, { onDelete: 'cascade' }),
  songId:                 integer('song_id').references(() => songs.id),
  itemType:               text('item_type', { enum: ['song', 'scripture', 'media', 'media_collection', 'countdown', 'announcement', 'note', 'section', 'bible', 'music_player'] }).notNull().default('song'),
  orderIndex:             integer('order_index').notNull().default(0),
  selectedSections:       text('selected_sections').notNull().default('[]'),
  overrideThemeId:        integer('override_theme_id'),
  overrideBackgroundPath: text('override_background_path'),
  notes:                  text('notes'),
  title:                  text('title'),
  scriptureRef:           text('scripture_ref'),
  mediaPath:              text('media_path'),
  sectionOrder:           text('section_order'),
  itemStyle:              text('item_style'),
  imageScaleMode:         text('image_scale_mode', { enum: ['cover', 'contain', 'stretch'] }),
  // JSON: { items: string[]; autoAdvance: boolean; intervalSeconds: number; loop: boolean }
  mediaCollection:        text('media_collection'),
  // Folder this music player scans for audio files
  musicPlayerDir:         text('music_player_dir'),
})

// ── Themes ────────────────────────────────────────────────────────────────────
export const themes = sqliteTable('themes', {
  id:          integer('id').primaryKey({ autoIncrement: true }),
  name:        text('name').notNull(),
  type:        text('type', { enum: ['global', 'seasonal', 'per-song'] }).notNull().default('global'),
  isDefault:   integer('is_default', { mode: 'boolean' }).notNull().default(false),
  seasonStart: text('season_start'),
  seasonEnd:   text('season_end'),
  settings:    text('settings').notNull().default('{}'),
  createdAt:   text('created_at').notNull().default("(datetime('now'))")
})

// ── Song usage log ────────────────────────────────────────────────────────────
export const songUsage = sqliteTable('song_usage', {
  id:            integer('id').primaryKey({ autoIncrement: true }),
  songId:        integer('song_id').notNull().references(() => songs.id),
  serviceDateId: integer('service_date_id').notNull().references(() => serviceDates.id),
  usedAt:        text('used_at').notNull().default("(datetime('now'))")
})

// ── Sync Workspace: local import log ───────────────────────────────────────────
// Source of truth for "have I already imported this package" — prevents
// re-importing the same version twice and lets us detect when a newer
// version of an already-imported service is available.
export const syncImportLog = sqliteTable('sync_import_log', {
  id:                 integer('id').primaryKey({ autoIncrement: true }),
  syncUuid:           text('sync_uuid').notNull(),
  version:            integer('version').notNull(),
  packageFilename:    text('package_filename').notNull(),
  importedAt:         text('imported_at').notNull().default("(datetime('now'))"),
  sourceDeviceId:     text('source_device_id').notNull(),
  sourceDeviceName:   text('source_device_name').notNull(),
  checksum:           text('checksum').notNull(),
  localServiceDateId: integer('local_service_date_id').references(() => serviceDates.id)
})

// ── Sync Workspace: local asset dedup index ─────────────────────────────────────
// Maps a content checksum to the local managed-media file that already holds
// those bytes, so importing the same background/video referenced by multiple
// packages (or already present from a manual import) never duplicates it.
export const syncKnownAssets = sqliteTable('sync_known_assets', {
  checksum:     text('checksum').primaryKey(),
  absolutePath: text('absolute_path').notNull(),
  kind:         text('kind', { enum: ['image', 'audio', 'video'] }).notNull()
})