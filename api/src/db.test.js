import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { initDb } from './db.js';

describe('database', () => {
  let tmpDir;
  let db;

  before(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'stl-test-'));
    db = initDb(join(tmpDir, 'test.db'));
  });

  after(() => {
    db.close();
    rmSync(tmpDir, { recursive: true });
  });

  it('creates models table', () => {
    const info = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='models'").get();
    assert.equal(info.name, 'models');
  });

  it('creates FTS index', () => {
    const info = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='models_fts'").get();
    assert.equal(info.name, 'models_fts');
  });

  it('can insert and query a model', () => {
    db.prepare(`INSERT INTO models (folder_path, title, creator, date, content, files, preview_filename, indexed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
      'TestCreator/2025-01-01-test-model', 'Test Model', 'TestCreator',
      '2025-01-01', 'A test model', '["file.stl"]', 'preview.jpg', new Date().toISOString()
    );
    const row = db.prepare('SELECT * FROM models WHERE folder_path = ?').get('TestCreator/2025-01-01-test-model');
    assert.equal(row.title, 'Test Model');
    assert.equal(row.creator, 'TestCreator');
  });

  it('enforces unique folder_path', () => {
    assert.throws(() => {
      db.prepare(`INSERT INTO models (folder_path, title, creator, date, content, files, preview_filename, indexed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
        'TestCreator/2025-01-01-test-model', 'Duplicate', 'TestCreator',
        '2025-01-01', '', '[]', null, new Date().toISOString()
      );
    });
  });

  it('FTS search works', () => {
    const row = db.prepare('SELECT id FROM models WHERE folder_path = ?').get('TestCreator/2025-01-01-test-model');
    db.prepare('INSERT INTO models_fts(rowid, title, creator, content) VALUES (?, ?, ?, ?)').run(
      row.id, 'Test Model', 'TestCreator', 'A test model'
    );
    const results = db.prepare("SELECT * FROM models_fts WHERE models_fts MATCH ?").all('test');
    assert.ok(results.length > 0);
  });
});
