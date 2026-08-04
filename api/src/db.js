import Database from 'better-sqlite3';

const DB_PATH = '/config/stl-browser.db';

export function initDb(path = DB_PATH) {
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Upgrade pre-multi-user tables (dev-only shape — never deployed with data).
  // Old favorites had no user_id; old collections had no owner. Drop and let
  // the CREATEs below rebuild them in the per-user shape.
  const favCols = db.prepare('PRAGMA table_info(favorites)').all();
  if (favCols.length > 0 && !favCols.some(c => c.name === 'user_id')) {
    db.exec('DROP TABLE favorites');
  }
  const collCols = db.prepare('PRAGMA table_info(collections)').all();
  if (collCols.length > 0 && !collCols.some(c => c.name === 'owner')) {
    db.exec('DROP TABLE collection_models; DROP TABLE collections;');
  }

  // Add added_at (first-seen time) to pre-existing models tables. "Recently added"
  // keys off this — set once on insert, preserved on re-index (see indexer.js) — so a
  // model added today appears even when its published `date` is old. Backfill existing
  // rows from their publish date (falling back to indexed_at) so the shelf's current
  // contents don't change; only newly added models get true add-time going forward.
  const modelCols = db.prepare('PRAGMA table_info(models)').all();
  if (modelCols.length > 0 && !modelCols.some(c => c.name === 'added_at')) {
    db.exec('ALTER TABLE models ADD COLUMN added_at TEXT');
    db.exec('UPDATE models SET added_at = COALESCE(date, indexed_at) WHERE added_at IS NULL');
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS models (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      folder_path TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      creator TEXT NOT NULL,
      date TEXT,
      patreon_url TEXT,
      post_id INTEGER,
      content TEXT,
      files TEXT DEFAULT '[]',
      preview_filename TEXT,
      indexed_at TEXT NOT NULL,
      added_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_models_creator ON models(creator);
    CREATE INDEX IF NOT EXISTS idx_models_date ON models(date);
    CREATE INDEX IF NOT EXISTS idx_models_added_at ON models(added_at);

    CREATE VIRTUAL TABLE IF NOT EXISTS models_fts USING fts5(
      title, creator, content,
      content=''
    );

    CREATE TABLE IF NOT EXISTS favorites (
      user_id TEXT NOT NULL,
      model_id INTEGER NOT NULL REFERENCES models(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      PRIMARY KEY (user_id, model_id)
    );

    CREATE TABLE IF NOT EXISTS collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner TEXT NOT NULL,
      name TEXT NOT NULL,
      hue INTEGER NOT NULL DEFAULT 28,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_collections_owner ON collections(owner);

    CREATE TABLE IF NOT EXISTS user_creator_weights (
      user_id TEXT NOT NULL,
      creator TEXT NOT NULL,
      weight REAL NOT NULL DEFAULT 1,
      PRIMARY KEY (user_id, creator)
    );

    CREATE TABLE IF NOT EXISTS collection_models (
      collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
      model_id INTEGER NOT NULL REFERENCES models(id) ON DELETE CASCADE,
      added_at TEXT NOT NULL,
      PRIMARY KEY (collection_id, model_id)
    );
  `);

  return db;
}
