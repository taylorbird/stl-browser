// api/src/routes.test.js
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createServer } from 'node:http';
import express from 'express';
import { initDb } from './db.js';
import { reindex } from './indexer.js';
import { createRoutes } from './routes.js';

function request(app, path, headers = {}) {
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const port = server.address().port;
      fetch(`http://localhost:${port}${path}`, { headers })
        .then(res => res.json().then(body => ({ status: res.status, body })))
        .then(result => { server.close(); resolve(result); })
        .catch(err => { server.close(); resolve({ status: 500, body: { error: err.message } }); });
    });
  });
}

function send(app, path, method, body, headers = {}) {
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const port = server.address().port;
      fetch(`http://localhost:${port}${path}`, {
        method,
        headers: body ? { 'Content-Type': 'application/json', ...headers } : headers,
        body: body ? JSON.stringify(body) : undefined,
      })
        .then(res => res.json().then(b => ({ status: res.status, body: b })))
        .then(result => { server.close(); resolve(result); })
        .catch(err => { server.close(); resolve({ status: 500, body: { error: err.message } }); });
    });
  });
}

// Proxy-auth identities (TinyAuth-style headers)
const ALICE = { 'remote-user': 'alice' };
const BOB = { 'remote-user': 'bob' };

describe('API routes', () => {
  let tmpDir, dataDir, db, app;

  before(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'stl-api-'));
    dataDir = join(tmpDir, 'data');

    mkdirSync(join(dataDir, 'CreatorA', '2025-01-10-alpha-model'), { recursive: true });
    writeFileSync(join(dataDir, 'CreatorA', '2025-01-10-alpha-model', 'metadata.md'),
      '---\ntitle: Alpha Model\ncreator: CreatorA\ndate: 2025-01-10\ntags: ["Tag1"]\n---\nAlpha description with PLA settings.');
    writeFileSync(join(dataDir, 'CreatorA', '2025-01-10-alpha-model', 'part.stl'), 'stl');
    writeFileSync(join(dataDir, 'CreatorA', '2025-01-10-alpha-model', 'photo.jpg'), 'jpg');

    mkdirSync(join(dataDir, 'CreatorB', '2025-03-20-beta-model'), { recursive: true });
    writeFileSync(join(dataDir, 'CreatorB', '2025-03-20-beta-model', 'metadata.md'),
      '---\ntitle: Beta Model\ncreator: CreatorB\ndate: 2025-03-20\ntags: ["Tag1", "Tag2"]\n---\nBeta description with PETG settings.');
    writeFileSync(join(dataDir, 'CreatorB', '2025-03-20-beta-model', 'model.stl'), 'stl');
    writeFileSync(join(dataDir, 'CreatorB', '2025-03-20-beta-model', 'thumb.png'), 'png');

    db = initDb(join(tmpDir, 'test.db'));
    reindex(db, dataDir);

    app = express();
    app.use(express.json());
    app.use(createRoutes(db, dataDir));
  });

  after(() => {
    db.close();
    rmSync(tmpDir, { recursive: true });
  });

  it('GET /api/models returns all models', async () => {
    const { status, body } = await request(app, '/api/models');
    assert.equal(status, 200);
    assert.equal(body.total, 2);
    assert.equal(body.models.length, 2);
  });

  it('GET /api/models?sort=date sorts by date desc', async () => {
    const { body } = await request(app, '/api/models?sort=date');
    assert.equal(body.models[0].title, 'Beta Model');
  });

  it('GET /api/models?creator=CreatorA filters by creator', async () => {
    const { body } = await request(app, '/api/models?creator=CreatorA');
    assert.equal(body.total, 1);
    assert.equal(body.models[0].creator, 'CreatorA');
  });

  it('GET /api/models?q=PLA searches with FTS', async () => {
    const { body } = await request(app, '/api/models?q=PLA');
    assert.equal(body.total, 1);
    assert.equal(body.models[0].title, 'Alpha Model');
  });

  it('GET /api/models?q=PL matches prefixes (live search)', async () => {
    const { body } = await request(app, '/api/models?q=PL');
    assert.equal(body.total, 1);
    assert.equal(body.models[0].title, 'Alpha Model');
  });

  it('GET /api/models?q with quotes/operators does not 500', async () => {
    const { status } = await request(app, `/api/models?q=${encodeURIComponent('kraken\'s "AND (')}`);
    assert.equal(status, 200);
  });

  it('GET /api/models?page=1&limit=1 paginates', async () => {
    const { body } = await request(app, '/api/models?page=1&limit=1');
    assert.equal(body.models.length, 1);
    assert.equal(body.total, 2);
    assert.equal(body.page, 1);
  });

  it('GET /api/models/:id returns single model', async () => {
    const list = await request(app, '/api/models');
    const id = list.body.models[0].id;
    const { status, body } = await request(app, `/api/models/${id}`);
    assert.equal(status, 200);
    assert.equal(body.id, id);
    assert.ok(Array.isArray(body.files));
  });

  it('GET /api/models/:id includes file sizes', async () => {
    const list = await request(app, '/api/models?creator=CreatorA');
    const id = list.body.models[0].id;
    const { body } = await request(app, `/api/models/${id}`);
    assert.ok(Array.isArray(body.fileDetails));
    const stl = body.fileDetails.find(f => f.name === 'part.stl');
    assert.equal(stl.size, 3); // fixture content is 'stl'
  });

  it('GET /api/creators returns unique creators', async () => {
    const { body } = await request(app, '/api/creators');
    const names = body.map(c => c.name).sort();
    assert.deepEqual(names, ['CreatorA', 'CreatorB']);
    assert.ok(body.every(c => typeof c.hasLogo === 'boolean'));
  });

  describe('favorites', () => {
    it('starts empty', async () => {
      const { status, body } = await request(app, '/api/favorites', ALICE);
      assert.equal(status, 200);
      assert.deepEqual(body.ids, []);
    });

    it('GET without auth returns empty list', async () => {
      const { status, body } = await request(app, '/api/favorites');
      assert.equal(status, 200);
      assert.deepEqual(body.ids, []);
    });

    it('PUT without auth is rejected', async () => {
      const { body: list } = await request(app, '/api/models?sort=title');
      const { status } = await send(app, `/api/favorites/${list.models[0].id}`, 'PUT');
      assert.equal(status, 401);
    });

    it('PUT adds a favorite for the requesting user only', async () => {
      const { body: list } = await request(app, '/api/models?sort=title');
      const id = list.models[0].id;
      const { status } = await send(app, `/api/favorites/${id}`, 'PUT', null, ALICE);
      assert.equal(status, 200);
      const { body: aliceFavs } = await request(app, '/api/favorites', ALICE);
      assert.deepEqual(aliceFavs.ids, [id]);
      const { body: bobFavs } = await request(app, '/api/favorites', BOB);
      assert.deepEqual(bobFavs.ids, []);
    });

    it('PUT is idempotent', async () => {
      const { body: list } = await request(app, '/api/models?sort=title');
      const id = list.models[0].id;
      await send(app, `/api/favorites/${id}`, 'PUT', null, ALICE);
      const { body } = await request(app, '/api/favorites', ALICE);
      assert.equal(body.ids.length, 1);
    });

    it('PUT 404s for unknown model', async () => {
      const { status } = await send(app, '/api/favorites/999999', 'PUT', null, ALICE);
      assert.equal(status, 404);
    });

    it("DELETE removes only the requesting user's favorite", async () => {
      const { body: list } = await request(app, '/api/models?sort=title');
      const id = list.models[0].id;
      await send(app, `/api/favorites/${id}`, 'PUT', null, BOB);
      await send(app, `/api/favorites/${id}`, 'DELETE', null, ALICE);
      const { body: aliceFavs } = await request(app, '/api/favorites', ALICE);
      assert.deepEqual(aliceFavs.ids, []);
      const { body: bobFavs } = await request(app, '/api/favorites', BOB);
      assert.deepEqual(bobFavs.ids, [id]);
      await send(app, `/api/favorites/${id}`, 'DELETE', null, BOB);
    });
  });

  describe('collections', () => {
    let collId, modelId;

    it('starts empty', async () => {
      const { status, body } = await request(app, '/api/collections', ALICE);
      assert.equal(status, 200);
      assert.deepEqual(body, []);
    });

    it('POST without auth is rejected', async () => {
      const { status } = await send(app, '/api/collections', 'POST', { name: 'Nope' });
      assert.equal(status, 401);
    });

    it('POST creates a collection visible only to its owner', async () => {
      const { status, body } = await send(app, '/api/collections', 'POST', { name: 'To print', hue: 28 }, ALICE);
      assert.equal(status, 200);
      assert.equal(body.name, 'To print');
      assert.equal(body.hue, 28);
      assert.ok(body.id);
      collId = body.id;
      const { body: bobColls } = await request(app, '/api/collections', BOB);
      assert.deepEqual(bobColls, []);
    });

    it('POST rejects empty name', async () => {
      const { status } = await send(app, '/api/collections', 'POST', { name: '  ' }, ALICE);
      assert.equal(status, 400);
    });

    it('PUT adds a model to a collection', async () => {
      const { body: list } = await request(app, '/api/models?sort=title');
      modelId = list.models[0].id;
      const { status } = await send(app, `/api/collections/${collId}/models/${modelId}`, 'PUT', null, ALICE);
      assert.equal(status, 200);
      const { body } = await request(app, '/api/collections', ALICE);
      assert.equal(body[0].count, 1);
    });

    it("another user cannot modify someone else's collection", async () => {
      const { status } = await send(app, `/api/collections/${collId}/models/${modelId}`, 'PUT', null, BOB);
      assert.equal(status, 404);
    });

    it('GET /api/models/:id/collections lists memberships for the requesting user', async () => {
      const { status, body } = await request(app, `/api/models/${modelId}/collections`, ALICE);
      assert.equal(status, 200);
      assert.deepEqual(body.ids, [collId]);
      const { body: bobView } = await request(app, `/api/models/${modelId}/collections`, BOB);
      assert.deepEqual(bobView.ids, []);
    });

    it('DELETE removes a model from a collection', async () => {
      await send(app, `/api/collections/${collId}/models/${modelId}`, 'DELETE', null, ALICE);
      const { body } = await request(app, '/api/collections', ALICE);
      assert.equal(body[0].count, 0);
    });

    it("another user cannot delete someone else's collection", async () => {
      await send(app, `/api/collections/${collId}`, 'DELETE', null, BOB);
      const { body } = await request(app, '/api/collections', ALICE);
      assert.equal(body.length, 1);
    });

    it('DELETE removes a collection and cascades membership rows', async () => {
      // Re-add membership so the cascade has something to clear
      await send(app, `/api/collections/${collId}/models/${modelId}`, 'PUT', null, ALICE);
      await send(app, `/api/collections/${collId}`, 'DELETE', null, ALICE);
      const { body } = await request(app, '/api/collections', ALICE);
      assert.deepEqual(body, []);
      const orphans = db.prepare('SELECT COUNT(*) n FROM collection_models WHERE collection_id = ?').get(collId);
      assert.equal(orphans.n, 0);
    });
  });

  describe('model list filters', () => {
    let extraId, favId, oldPubRecentAddId, recentPubOldAddId;

    before(() => {
      const today = new Date().toISOString().slice(0, 10);
      const now = new Date().toISOString();
      const ins = db.prepare(`
        INSERT INTO models (folder_path, title, creator, date, content, files, preview_filename, indexed_at, added_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      extraId = Number(ins.run(
        'CreatorA/2026-06-01-no-stl-model', 'No STL Model', 'CreatorA',
        today, '', '["photo.jpg"]', null, now, now
      ).lastInsertRowid);
      // Old publish date but added just now → should count as "recently added".
      oldPubRecentAddId = Number(ins.run(
        'CreatorA/old-pub-recent-add', 'Old Pub Recent Add', 'CreatorA',
        '2023-01-01', '', '["m.stl"]', null, now, now
      ).lastInsertRowid);
      // Recent publish date but added long ago → should NOT count as recently added.
      recentPubOldAddId = Number(ins.run(
        'CreatorA/recent-pub-old-add', 'Recent Pub Old Add', 'CreatorA',
        today, '', '["m.stl"]', null, now, '2023-01-01'
      ).lastInsertRowid);
    });

    after(() => {
      for (const id of [extraId, oldPubRecentAddId, recentPubOldAddId]) {
        if (id) db.prepare('DELETE FROM models WHERE id = ?').run(id);
      }
      if (favId) db.prepare('DELETE FROM favorites WHERE model_id = ?').run(favId);
    });

    it("favorites=1 returns only the requesting user's favorites", async () => {
      const { body: list } = await request(app, '/api/models?sort=title');
      favId = list.models[0].id;
      await send(app, `/api/favorites/${favId}`, 'PUT', null, ALICE);
      const { body } = await request(app, '/api/models?favorites=1', ALICE);
      assert.equal(body.total, 1);
      assert.equal(body.models[0].id, favId);
      const { body: bobView } = await request(app, '/api/models?favorites=1', BOB);
      assert.equal(bobView.total, 0);
    });

    it('missing=1 returns models with no .stl files', async () => {
      const { body } = await request(app, '/api/models?missing=1');
      assert.equal(body.total, 1);
      assert.equal(body.models[0].id, extraId);
    });

    it('recent=1 keys off added_at (add time), not publish date', async () => {
      const { body } = await request(app, '/api/models?recent=1');
      const ids = body.models.map((m) => m.id);
      assert.ok(ids.includes(oldPubRecentAddId), 'old publish date but recently added → included');
      assert.ok(!ids.includes(recentPubOldAddId), 'recent publish date but added long ago → excluded');
    });

    it('collection=<id> returns that collection\'s models for its owner only', async () => {
      const { body: coll } = await send(app, '/api/collections', 'POST', { name: 'Filter Test', hue: 150 }, ALICE);
      await send(app, `/api/collections/${coll.id}/models/${extraId}`, 'PUT', null, ALICE);
      const { body } = await request(app, `/api/models?collection=${coll.id}`, ALICE);
      assert.equal(body.total, 1);
      assert.equal(body.models[0].id, extraId);
      const { body: bobView } = await request(app, `/api/models?collection=${coll.id}`, BOB);
      assert.equal(bobView.total, 0);
      await send(app, `/api/collections/${coll.id}`, 'DELETE', null, ALICE);
    });
  });

  describe('counts', () => {
    it('GET /api/counts returns nav counts', async () => {
      const { status, body } = await request(app, '/api/counts', ALICE);
      assert.equal(status, 200);
      assert.equal(body.all, 2); // the two base fixtures
      assert.equal(typeof body.recent, 'number');
      assert.equal(typeof body.favorites, 'number');
      assert.equal(typeof body.missing, 'number');
    });

    it('favorites count is scoped to the requesting user', async () => {
      const { body: list } = await request(app, '/api/models?sort=title');
      const id = list.models[0].id;
      await send(app, `/api/favorites/${id}`, 'PUT', null, ALICE);
      const { body: alice } = await request(app, '/api/counts', ALICE);
      const { body: bob } = await request(app, '/api/counts', BOB);
      assert.equal(alice.favorites, 1);
      assert.equal(bob.favorites, 0);
      await send(app, `/api/favorites/${id}`, 'DELETE', null, ALICE);
    });

    it('GET /api/creators includes model counts', async () => {
      const { body } = await request(app, '/api/creators');
      const a = body.find(c => c.name === 'CreatorA');
      assert.equal(a.count, 1);
    });
  });

  describe('DEFAULT_USER single-user mode', () => {
    before(() => { process.env.DEFAULT_USER = 'solo'; });
    after(() => {
      delete process.env.DEFAULT_USER;
      db.prepare("DELETE FROM favorites WHERE user_id = 'solo'").run();
    });

    it('headerless writes act as the default user', async () => {
      const { body: list } = await request(app, '/api/models?sort=title');
      const id = list.models[0].id;
      const { status } = await send(app, `/api/favorites/${id}`, 'PUT');
      assert.equal(status, 200);
      const { body } = await request(app, '/api/favorites');
      assert.deepEqual(body.ids, [id]);
    });

    it('proxy headers still take precedence over DEFAULT_USER', async () => {
      const { body } = await request(app, '/api/favorites', ALICE);
      assert.deepEqual(body.ids, []);
    });
  });

  describe('creator weights', () => {
    it('GET returns empty weights for anonymous', async () => {
      const { status, body } = await request(app, '/api/settings/weights');
      assert.equal(status, 200);
      assert.deepEqual(body.weights, {});
    });

    it('PUT without auth is rejected', async () => {
      const { status } = await send(app, '/api/settings/weights', 'PUT', { creator: 'CreatorA', weight: 2 });
      assert.equal(status, 401);
    });

    it('PUT stores a weight per user', async () => {
      const { status } = await send(app, '/api/settings/weights', 'PUT', { creator: 'CreatorA', weight: 2 }, ALICE);
      assert.equal(status, 200);
      const { body: alice } = await request(app, '/api/settings/weights', ALICE);
      assert.deepEqual(alice.weights, { CreatorA: 2 });
      const { body: bob } = await request(app, '/api/settings/weights', BOB);
      assert.deepEqual(bob.weights, {});
    });

    it('PUT weight 1 resets to default (row removed)', async () => {
      await send(app, '/api/settings/weights', 'PUT', { creator: 'CreatorA', weight: 1 }, ALICE);
      const { body } = await request(app, '/api/settings/weights', ALICE);
      assert.deepEqual(body.weights, {});
    });

    it('PUT rejects invalid weight', async () => {
      const { status } = await send(app, '/api/settings/weights', 'PUT', { creator: 'CreatorA', weight: 'lots' }, ALICE);
      assert.equal(status, 400);
    });

    it('a near-zero weight pushes that creator to the end of shuffle', async () => {
      await send(app, '/api/settings/weights', 'PUT', { creator: 'CreatorA', weight: 0 }, ALICE);
      let creatorALast = 0;
      const seeds = 30;
      for (let seed = 1; seed <= seeds; seed++) {
        const { body } = await request(app, `/api/models?sort=random&seed=${seed}`, ALICE);
        if (body.models[body.models.length - 1].creator === 'CreatorA') creatorALast++;
      }
      // Hidden (0 → clamped 0.02) means CreatorA should sort last almost always
      assert.ok(creatorALast >= seeds - 3, `CreatorA last in only ${creatorALast}/${seeds} seeds`);
      await send(app, '/api/settings/weights', 'PUT', { creator: 'CreatorA', weight: 1 }, ALICE);
    });
  });
});

function sendForm(app, path, form, headers = {}) {
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const port = server.address().port;
      fetch(`http://localhost:${port}${path}`, { method: 'POST', body: form, headers })
        .then((res) => res.json().then((b) => ({ status: res.status, body: b })))
        .then((r) => { server.close(); resolve(r); })
        .catch((err) => { server.close(); resolve({ status: 500, body: { error: err.message } }); });
    });
  });
}

describe('Add Model endpoints', () => {
  let tmpDir, dataDir, db, app;

  before(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'stl-add-'));
    dataDir = join(tmpDir, 'data');
    mkdirSync(dataDir, { recursive: true });
    db = initDb(join(tmpDir, 'add.db'));
    app = express();
    app.use(express.json());
    app.use(createRoutes(db, dataDir));
  });

  after(() => {
    db.close();
    rmSync(tmpDir, { recursive: true });
  });

  it('POST /api/models creates a folder, writes files + metadata, and indexes it', async () => {
    const form = new FormData();
    form.set('title', 'My Dragon');
    form.set('creator', 'New Maker');
    form.set('description', 'A fierce dragon.');
    form.append('modelFiles', new File(['solid'], 'dragon.stl', { type: 'model/stl' }));
    form.append('images', new File(['imgdata'], 'render.jpg', { type: 'image/jpeg' }));

    const { status, body } = await sendForm(app, '/api/models', form, ALICE);
    assert.equal(status, 201);
    assert.ok(body.id > 0);
    assert.equal(body.folder_path, 'new-maker/my-dragon');

    assert.ok(existsSync(join(dataDir, 'new-maker', 'my-dragon', 'dragon.stl')));
    assert.ok(existsSync(join(dataDir, 'new-maker', 'my-dragon', 'render.jpg')));
    assert.ok(existsSync(join(dataDir, 'new-maker', 'my-dragon', 'metadata.md')));

    const row = db.prepare('SELECT * FROM models WHERE id = ?').get(body.id);
    assert.equal(row.title, 'My Dragon');
    assert.equal(row.creator, 'New Maker');
    assert.equal(row.preview_filename, 'render.jpg');
    assert.ok(JSON.parse(row.files).includes('dragon.stl'));
  });

  it('POST /api/models honors the chosen preview image', async () => {
    const form = new FormData();
    form.set('title', 'Preview Pick');
    form.set('creator', 'New Maker');
    form.set('preview', 'upload:second.png');
    form.append('modelFiles', new File(['solid'], 'p.stl', { type: 'model/stl' }));
    form.append('images', new File(['a'], 'first.jpg', { type: 'image/jpeg' }));
    form.append('images', new File(['b'], 'second.png', { type: 'image/png' }));
    const { body } = await sendForm(app, '/api/models', form, ALICE);
    const row = db.prepare('SELECT preview_filename FROM models WHERE id = ?').get(body.id);
    assert.equal(row.preview_filename, 'second.png');
  });

  it('POST /api/models suffixes the folder on title collision', async () => {
    const form = new FormData();
    form.set('title', 'My Dragon');
    form.set('creator', 'New Maker');
    form.append('modelFiles', new File(['solid'], 'd2.stl', { type: 'model/stl' }));
    const { status, body } = await sendForm(app, '/api/models', form, ALICE);
    assert.equal(status, 201);
    assert.equal(body.folder_path, 'new-maker/my-dragon-2');
  });

  it('POST /api/models honors an explicit creatorFolder for existing creators', async () => {
    const form = new FormData();
    form.set('title', 'Beta Thing');
    form.set('creator', 'Existing Creator');
    form.set('creatorFolder', 'ExistingCreator');
    form.append('modelFiles', new File(['solid'], 'b.stl', { type: 'model/stl' }));
    const { body } = await sendForm(app, '/api/models', form, ALICE);
    assert.equal(body.folder_path, 'ExistingCreator/beta-thing');
  });

  it('POST /api/models rejects anonymous writes with 401', async () => {
    const form = new FormData();
    form.set('title', 'No Auth');
    form.set('creator', 'Maker');
    form.append('modelFiles', new File(['solid'], 'x.stl', { type: 'model/stl' }));
    const { status } = await sendForm(app, '/api/models', form);
    assert.equal(status, 401);
  });

  it('POST /api/models requires at least one model file', async () => {
    const form = new FormData();
    form.set('title', 'No Files');
    form.set('creator', 'Maker');
    const { status } = await sendForm(app, '/api/models', form, ALICE);
    assert.equal(status, 400);
  });

  it('POST /api/models requires a title and creator', async () => {
    const form = new FormData();
    form.set('title', '');
    form.set('creator', '');
    form.append('modelFiles', new File(['solid'], 'x.stl', { type: 'model/stl' }));
    const { status } = await sendForm(app, '/api/models', form, ALICE);
    assert.equal(status, 400);
  });

  it('POST /api/models rejects model files with disallowed extensions', async () => {
    const form = new FormData();
    form.set('title', 'Sneaky');
    form.set('creator', 'Maker');
    form.append('modelFiles', new File(['#!/bin/sh'], 'evil.sh', { type: 'text/x-sh' }));
    const { status, body } = await sendForm(app, '/api/models', form, ALICE);
    assert.equal(status, 400);
    assert.match(body.error, /evil\.sh/);
    assert.ok(!existsSync(join(dataDir, 'maker', 'sneaky')));
  });

  it('POST /api/models rejects a disallowed file even alongside valid ones', async () => {
    const form = new FormData();
    form.set('title', 'Mixed Bag');
    form.set('creator', 'Maker');
    form.append('modelFiles', new File(['solid'], 'ok.stl', { type: 'model/stl' }));
    form.append('modelFiles', new File(['MZ'], 'payload.exe', { type: 'application/octet-stream' }));
    const { status } = await sendForm(app, '/api/models', form, ALICE);
    assert.equal(status, 400);
    assert.ok(!existsSync(join(dataDir, 'maker', 'mixed-bag')));
  });

  it('POST /api/models rejects non-image files in the images field', async () => {
    const form = new FormData();
    form.set('title', 'Bad Image');
    form.set('creator', 'Maker');
    form.append('modelFiles', new File(['solid'], 'ok.stl', { type: 'model/stl' }));
    form.append('images', new File(['<svg onload=alert(1)>'], 'xss.svg', { type: 'image/svg+xml' }));
    const { status } = await sendForm(app, '/api/models', form, ALICE);
    assert.equal(status, 400);
  });

  it('POST /api/models accepts every documented type, case-insensitively', async () => {
    const form = new FormData();
    form.set('title', 'Kitchen Sink');
    form.set('creator', 'Maker');
    for (const name of ['a.STL', 'b.3mf', 'c.obj', 'd.step', 'e.stp', 'f.zip', 'g.pdf']) {
      form.append('modelFiles', new File(['data'], name));
    }
    form.append('images', new File(['img'], 'photo.JPG', { type: 'image/jpeg' }));
    const { status } = await sendForm(app, '/api/models', form, ALICE);
    assert.equal(status, 201);
    assert.ok(existsSync(join(dataDir, 'maker', 'kitchen-sink', 'a.STL')));
    assert.ok(existsSync(join(dataDir, 'maker', 'kitchen-sink', 'g.pdf')));
  });

  it('POST /api/scrape-images returns candidate image URLs from a page', async () => {
    const html = '<meta property="og:image" content="https://cdn.example.com/x.jpg"><img src="/rel.png">';
    const srv = createServer((req, res) => {
      res.setHeader('content-type', 'text/html');
      res.end(html);
    });
    await new Promise((r) => srv.listen(0, r));
    const port = srv.address().port;
    const pageUrl = `http://localhost:${port}/model/1`;

    const { status, body } = await send(app, '/api/scrape-images', 'POST', { url: pageUrl }, ALICE);
    srv.close();
    assert.equal(status, 200);
    assert.ok(body.images.includes('https://cdn.example.com/x.jpg'));
    assert.ok(body.images.includes(`http://localhost:${port}/rel.png`));
  });

  it('POST /api/scrape-images rejects anonymous with 401', async () => {
    const { status } = await send(app, '/api/scrape-images', 'POST', { url: 'http://example.com' });
    assert.equal(status, 401);
  });

  it('POST /api/models saves a scraped image served as application/octet-stream', async () => {
    // Thangs' GCS-backed images return application/octet-stream, not image/*; the
    // .jpg extension must still let them through and be saved.
    const srv = createServer((req, res) => {
      res.setHeader('content-type', 'application/octet-stream');
      res.end(Buffer.from('fake-jpeg-bytes'));
    });
    await new Promise((r) => srv.listen(0, r));
    const imgUrl = `http://localhost:${srv.address().port}/uploads/1.jpg`;

    const form = new FormData();
    form.set('title', 'Octet Model');
    form.set('creator', 'New Maker');
    form.set('imageUrls', JSON.stringify([imgUrl]));
    form.set('preview', `url:${imgUrl}`);
    form.append('modelFiles', new File(['solid'], 'o.stl', { type: 'model/stl' }));

    const { status, body } = await sendForm(app, '/api/models', form, ALICE);
    srv.close();
    assert.equal(status, 201);
    assert.ok(existsSync(join(dataDir, body.folder_path, '1.jpg')), 'octet-stream image should be saved');
    const row = db.prepare('SELECT preview_filename FROM models WHERE id = ?').get(body.id);
    assert.equal(row.preview_filename, '1.jpg');
  });
});

describe('Add Model upload size cap (MAX_UPLOAD_MB)', () => {
  let tmpDir, db, app;

  before(() => {
    process.env.MAX_UPLOAD_MB = '1';
    tmpDir = mkdtempSync(join(tmpdir(), 'stl-cap-'));
    const dataDir = join(tmpDir, 'data');
    mkdirSync(dataDir, { recursive: true });
    db = initDb(join(tmpDir, 'cap.db'));
    app = express();
    app.use(express.json());
    app.use(createRoutes(db, dataDir));
  });

  after(() => {
    delete process.env.MAX_UPLOAD_MB;
    db.close();
    rmSync(tmpDir, { recursive: true });
  });

  it('rejects a file over the cap with 413', async () => {
    const form = new FormData();
    form.set('title', 'Too Big');
    form.set('creator', 'Maker');
    form.append('modelFiles', new File(['x'.repeat(1.5 * 1024 * 1024)], 'big.stl', { type: 'model/stl' }));
    const { status, body } = await sendForm(app, '/api/models', form, ALICE);
    assert.equal(status, 413);
    assert.match(body.error, /1 MB/);
  });

  it('accepts a file under the cap', async () => {
    const form = new FormData();
    form.set('title', 'Small Enough');
    form.set('creator', 'Maker');
    form.append('modelFiles', new File(['x'.repeat(100 * 1024)], 'small.stl', { type: 'model/stl' }));
    const { status } = await sendForm(app, '/api/models', form, ALICE);
    assert.equal(status, 201);
  });
});
