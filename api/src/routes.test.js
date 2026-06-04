// api/src/routes.test.js
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
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

  it('GET /api/models sorts by date desc by default', async () => {
    const { body } = await request(app, '/api/models');
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
    let extraId, favId;

    before(() => {
      const today = new Date().toISOString().slice(0, 10);
      const { lastInsertRowid } = db.prepare(`
        INSERT INTO models (folder_path, title, creator, date, content, files, preview_filename, indexed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
        'CreatorA/2026-06-01-no-stl-model', 'No STL Model', 'CreatorA',
        today, '', '["photo.jpg"]', null, new Date().toISOString()
      );
      extraId = Number(lastInsertRowid);
    });

    after(() => {
      db.prepare('DELETE FROM models WHERE id = ?').run(extraId);
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

    it('recent=1 returns models dated within 30 days', async () => {
      const { body } = await request(app, '/api/models?recent=1');
      assert.equal(body.total, 1);
      assert.equal(body.models[0].id, extraId);
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
});
