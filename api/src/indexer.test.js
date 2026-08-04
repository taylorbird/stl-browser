import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { initDb } from './db.js';
import { reindex, indexModelFolder } from './indexer.js';

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

  it('indexes folders without metadata.md, deriving metadata from the folder name', () => {
    mkdirSync(join(dataDir, 'PlainCreator', '2026-02-14-dragon-bust'), { recursive: true });
    writeFileSync(join(dataDir, 'PlainCreator', '2026-02-14-dragon-bust', 'dragon.stl'), 'fake-stl');
    writeFileSync(join(dataDir, 'PlainCreator', '2026-02-14-dragon-bust', 'photo.jpg'), 'fake-jpg');
    mkdirSync(join(dataDir, 'PlainCreator', 'phone_stand'), { recursive: true });
    writeFileSync(join(dataDir, 'PlainCreator', 'phone_stand', 'stand.stl'), 'fake-stl');

    const stats = reindex(db, dataDir);
    assert.equal(stats.errors, 0);
    assert.equal(stats.indexed, 4);

    const dragon = db.prepare("SELECT * FROM models WHERE folder_path = 'PlainCreator/2026-02-14-dragon-bust'").get();
    assert.equal(dragon.title, 'dragon bust');
    assert.equal(dragon.creator, 'PlainCreator');
    assert.equal(dragon.date, '2026-02-14');
    assert.equal(dragon.preview_filename, 'photo.jpg');

    const stand = db.prepare("SELECT * FROM models WHERE folder_path = 'PlainCreator/phone_stand'").get();
    assert.equal(stand.title, 'phone stand');
    assert.equal(stand.date, null);

    rmSync(join(dataDir, 'PlainCreator'), { recursive: true });
    reindex(db, dataDir); // restore baseline; stale rows reported, not auto-deleted
    db.prepare("DELETE FROM models WHERE folder_path LIKE 'PlainCreator/%'").run();
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

describe('indexModelFolder (single-folder index)', () => {
  let tmpDir, dataDir, db;

  before(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'stl-one-'));
    dataDir = join(tmpDir, 'data');
    mkdirSync(join(dataDir, 'Maker', 'dragon-bust'), { recursive: true });
    writeFileSync(join(dataDir, 'Maker', 'dragon-bust', 'metadata.md'), [
      '---', 'title: Dragon Bust', 'creator: Maker', 'date: 2026-06-09', '---',
      '', 'A fierce dragon bust.',
    ].join('\n'));
    writeFileSync(join(dataDir, 'Maker', 'dragon-bust', 'dragon.stl'), 'fake-stl');
    writeFileSync(join(dataDir, 'Maker', 'dragon-bust', 'render.jpg'), 'fake-jpg');
    db = initDb(join(tmpDir, 'one.db'));
  });

  after(() => {
    db.close();
    rmSync(tmpDir, { recursive: true });
  });

  it('indexes a single folder and returns its model id', () => {
    const id = indexModelFolder(db, dataDir, 'Maker/dragon-bust');
    assert.ok(Number.isInteger(id) && id > 0);
    const row = db.prepare('SELECT * FROM models WHERE id = ?').get(id);
    assert.equal(row.title, 'Dragon Bust');
    assert.equal(row.creator, 'Maker');
    assert.equal(row.preview_filename, 'render.jpg');
    assert.ok(JSON.parse(row.files).includes('dragon.stl'));
  });

  it('makes the new model findable via FTS', () => {
    const hits = db.prepare('SELECT rowid FROM models_fts WHERE models_fts MATCH ?').all('dragon');
    assert.ok(hits.length > 0);
  });

  it('is idempotent — re-indexing updates in place, no duplicate row', () => {
    const id1 = indexModelFolder(db, dataDir, 'Maker/dragon-bust');
    const id2 = indexModelFolder(db, dataDir, 'Maker/dragon-bust');
    assert.equal(id1, id2);
    const count = db.prepare("SELECT COUNT(*) AS n FROM models WHERE folder_path = 'Maker/dragon-bust'").get();
    assert.equal(count.n, 1);
  });

  it('sets added_at on insert and preserves it across re-index', () => {
    const id = indexModelFolder(db, dataDir, 'Maker/dragon-bust');
    const first = db.prepare('SELECT added_at, date FROM models WHERE id = ?').get(id);
    assert.ok(first.added_at, 'added_at is set on insert');
    // added_at is the add time (a full timestamp), not the publish date.
    assert.notEqual(first.added_at, first.date);
    assert.match(first.added_at, /^\d{4}-\d{2}-\d{2}T/);

    indexModelFolder(db, dataDir, 'Maker/dragon-bust'); // re-index (full reindex runs every startup)
    const second = db.prepare('SELECT added_at FROM models WHERE id = ?').get(id);
    assert.equal(second.added_at, first.added_at, 'added_at survives re-indexing');
  });

  it('honors an explicit preview: from metadata over first-image-found', () => {
    mkdirSync(join(dataDir, 'Maker', 'two-shots'), { recursive: true });
    writeFileSync(join(dataDir, 'Maker', 'two-shots', 'metadata.md'), [
      '---', 'title: Two Shots', 'creator: Maker', 'preview: b.jpg', '---', '', 'desc',
    ].join('\n'));
    writeFileSync(join(dataDir, 'Maker', 'two-shots', 'a.jpg'), 'jpgA');
    writeFileSync(join(dataDir, 'Maker', 'two-shots', 'b.jpg'), 'jpgB');
    const id = indexModelFolder(db, dataDir, 'Maker/two-shots');
    const row = db.prepare('SELECT preview_filename FROM models WHERE id = ?').get(id);
    assert.equal(row.preview_filename, 'b.jpg');
  });

  it('falls back to first image when preview: names a missing file', () => {
    mkdirSync(join(dataDir, 'Maker', 'bad-preview'), { recursive: true });
    writeFileSync(join(dataDir, 'Maker', 'bad-preview', 'metadata.md'), [
      '---', 'title: Bad Preview', 'creator: Maker', 'preview: nope.jpg', '---', '', 'desc',
    ].join('\n'));
    writeFileSync(join(dataDir, 'Maker', 'bad-preview', 'only.png'), 'png');
    const id = indexModelFolder(db, dataDir, 'Maker/bad-preview');
    const row = db.prepare('SELECT preview_filename FROM models WHERE id = ?').get(id);
    assert.equal(row.preview_filename, 'only.png');
  });
});
