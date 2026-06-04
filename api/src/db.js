import Database from 'better-sqlite3';

const DB_PATH = '/config/stl-browser.db';

export function initDb(path = DB_PATH) {
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

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
      indexed_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_models_creator ON models(creator);
    CREATE INDEX IF NOT EXISTS idx_models_date ON models(date);

    CREATE VIRTUAL TABLE IF NOT EXISTS models_fts USING fts5(
      title, creator, content,
      content=''
    );

    CREATE TABLE IF NOT EXISTS favorites (
      model_id INTEGER PRIMARY KEY REFERENCES models(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      hue INTEGER NOT NULL DEFAULT 28,
      created_at TEXT NOT NULL
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
