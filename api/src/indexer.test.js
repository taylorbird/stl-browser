import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { initDb } from './db.js';
import { reindex } from './indexer.js';

describe('indexer', () => {
  let tmpDir, dataDir, db;

  before(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'stl-idx-'));
    dataDir = join(tmpDir, 'data');
    mkdirSync(join(dataDir, 'TestCreator', '2025-03-15-cool-vase'), { recursive: true });
    writeFileSync(join(dataDir, 'TestCreator', '2025-03-15-cool-vase', 'metadata.md'), [
      '---',
      'title: Cool Vase',
      'creator: TestCreator',
      'date: 2025-03-15',
      'patreon_url: "https://www.patreon.com/posts/123"',
      'post_id: 123',
      'tags: ["Membership Exclusive", "Vase"]',
      '---',
      '',
      '# Cool Vase',
      '',
      'A really cool vase for flowers.',
      '',
      '## Files',
      '- vase.stl',
      '- vase_large.stl',
      '- preview.jpg',
    ].join('\n'));
    writeFileSync(join(dataDir, 'TestCreator', '2025-03-15-cool-vase', 'vase.stl'), 'fake-stl');
    writeFileSync(join(dataDir, 'TestCreator', '2025-03-15-cool-vase', 'vase_large.stl'), 'fake-stl');
    writeFileSync(join(dataDir, 'TestCreator', '2025-03-15-cool-vase', 'preview.jpg'), 'fake-jpg');

    mkdirSync(join(dataDir, 'TestCreator', '2025-04-01-box'), { recursive: true });
    writeFileSync(join(dataDir, 'TestCreator', '2025-04-01-box', 'metadata.md'), [
      '---',
      'title: Box',
      'creator: TestCreator',
      'date: 2025-04-01',
      'tags: []',
      '---',
      '',
      'A simple box.',
    ].join('\n'));
    writeFileSync(join(dataDir, 'TestCreator', '2025-04-01-box', 'box.stl'), 'fake-stl');

    db = initDb(join(tmpDir, 'test.db'));
  });

  after(() => {
    db.close();
    rmSync(tmpDir, { recursive: true });
  });

  it('indexes all models from data directory', () => {
    const stats = reindex(db, dataDir);
    assert.equal(stats.indexed, 2);
    assert.equal(stats.errors, 0);
  });

  it('stores correct metadata', () => {
    const model = db.prepare('SELECT * FROM models WHERE title = ?').get('Cool Vase');
    assert.equal(model.creator, 'TestCreator');
    assert.equal(model.date, '2025-03-15');
    assert.equal(model.patreon_url, 'https://www.patreon.com/posts/123');
    assert.equal(model.post_id, 123);
    assert.ok(model.content.includes('A really cool vase'));
    assert.equal(model.preview_filename, 'preview.jpg');
  });

  it('stores files as JSON array excluding metadata.md', () => {
    const model = db.prepare('SELECT * FROM models WHERE title = ?').get('Cool Vase');
    const files = JSON.parse(model.files);
    assert.ok(files.includes('vase.stl'));
    assert.ok(files.includes('vase_large.stl'));
    assert.ok(files.includes('preview.jpg'));
    assert.ok(!files.includes('metadata.md'));
  });

  it('is idempotent on re-run', () => {
    const stats = reindex(db, dataDir);
    assert.equal(stats.indexed, 2);
    const count = db.prepare('SELECT COUNT(*) as n FROM models').get();
    assert.equal(count.n, 2);
  });

  it('FTS finds model by content', () => {
    const results = db.prepare("SELECT * FROM models_fts WHERE models_fts MATCH ?").all('flowers');
    assert.ok(results.length > 0);
  });

  it('detects stale models', () => {
    const stats = reindex(db, dataDir);
    assert.deepEqual(stats.stale, []);
  });
});
