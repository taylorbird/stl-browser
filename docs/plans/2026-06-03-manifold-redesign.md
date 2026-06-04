# MANIFOLD Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current STL Browser UI with the MANIFOLD design (docs/design_handoff_manifold/) — a sidebar app shell with nav/collections/creators, featured bento hero, and refined-dark model grid — wired to real data, with new backend support for favorites and collections.

**Architecture:** Backend-first: add `favorites`/`collections`/`collection_models` tables and endpoints to the existing Express + better-sqlite3 API (TDD, node:test). Then rebuild the frontend shell: design tokens go into Tailwind v4 `@theme` so utilities like `bg-panel`/`text-dim` exist; `App.jsx` becomes a fixed-viewport flex shell (sidebar + scrolling main) owning view/favorites/collections state; `BrowsePage` is rebuilt to the handoff layout reusing the existing infinite-scroll + seeded-random-sort mechanics.

**Tech Stack:** Express 5, better-sqlite3, node:test (API) · React 19, Vite 6, Tailwind v4 (`@theme` tokens), daisyui (spinner only), framer-motion (existing LoadingImage), react-router 7.

**Design references (source of truth):**
- `docs/design_handoff_manifold/README.md` — spec, tokens, behavior
- `docs/design_handoff_manifold/manifold.css` — exact styling values
- `docs/design_handoff_manifold/screen.js` + `sidebars.js` — structure (sidebar variant `stdSection`)

**Agreed scope decisions (from Taylor, 2026-06-03):**
- Favorites: **backend (SQLite)**, not localStorage
- Collections: **full** — backend + sidebar UI + create dialog + add/remove from model detail page
- Tag filter row: **omitted** (no tag data; Phase 3)
- Rollout: **replace outright** — old Header/SearchBar/creator-chips deleted

**Documented deviations from the handoff (decided during planning):**
- "Recently added" = `date >= date('now','-30 day')` (post date; prototype's "24" was mock data)
- The mono amber `noun` overlay on featured cards is omitted (we have no noun/tag data)
- Card Download button downloads **all** of the model's `.stl` files (no zip endpoint exists; sequential anchor clicks)
- Creator rows use the **real logo** in the 24px tile when `hasLogo`, falling back to the design's monogram initials
- Infinite scroll only — the old Pages toggle is dropped (the design has no pagination UI); grid-range shows "1–{loaded} of {total}"
- Featured bento shows only on the All-models view with no active search

**Operational notes for the executor:**
- Dev servers are already running: API as background task (plain `node`, **no watch — restart it after every backend change**) with `DATA_DIR=/Volumes/projects/3dprint/models-new DB_PATH=/Users/tbird/dev/3dprint/stl-browser.db` and the Node 23.6.1 binary at `/Users/tbird/Library/Application Support/fnm/node-versions/v23.6.1/installation/bin/node` (better-sqlite3 is compiled for Node 23; plain `node` is v22 and fails). Vite is at http://localhost:5173.
- Run API tests from `/Users/tbird/dev/3dprint/api` with `npm test`. 18 tests pass before this plan starts; keep them passing.
- Schema changes are purely additive (`CREATE TABLE IF NOT EXISTS`) — no DB deletion needed.
- Per Taylor's global rules: no `cd X && cmd` chaining; use absolute paths / separate Bash calls.

---

## Task 1: DB schema — favorites + collections tables

**Files:**
- Modify: `api/src/db.js`
- Test: `api/src/db.test.js`

**Step 1: Write the failing tests** — append inside the existing `describe('database', ...)` block in `api/src/db.test.js`:

```js
  it('creates favorites table', () => {
    const info = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='favorites'").get();
    assert.equal(info.name, 'favorites');
  });

  it('creates collections tables', () => {
    const c = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='collections'").get();
    const cm = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='collection_models'").get();
    assert.equal(c.name, 'collections');
    assert.equal(cm.name, 'collection_models');
  });

  it('cascades favorites and collection_models when a model is deleted', () => {
    db.prepare(`INSERT INTO models (folder_path, title, creator, date, content, files, preview_filename, indexed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
      'TestCreator/2025-02-02-cascade', 'Cascade Model', 'TestCreator',
      '2025-02-02', '', '[]', null, new Date().toISOString()
    );
    const { id } = db.prepare("SELECT id FROM models WHERE folder_path = 'TestCreator/2025-02-02-cascade'").get();
    db.prepare('INSERT INTO favorites (model_id, created_at) VALUES (?, ?)').run(id, new Date().toISOString());
    const { lastInsertRowid: collId } = db.prepare(
      'INSERT INTO collections (name, hue, created_at) VALUES (?, ?, ?)'
    ).run('Test Coll', 28, new Date().toISOString());
    db.prepare('INSERT INTO collection_models (collection_id, model_id, added_at) VALUES (?, ?, ?)')
      .run(collId, id, new Date().toISOString());

    db.prepare('DELETE FROM models WHERE id = ?').run(id);

    assert.equal(db.prepare('SELECT COUNT(*) n FROM favorites WHERE model_id = ?').get(id).n, 0);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM collection_models WHERE model_id = ?').get(id).n, 0);
    db.prepare('DELETE FROM collections WHERE id = ?').run(collId);
  });
```

**Step 2: Run tests to verify they fail**

Run (in `/Users/tbird/dev/3dprint/api`): `npm test`
Expected: 3 new tests FAIL ("no such table: favorites" / "collections").

**Step 3: Implement** — in `api/src/db.js`, append to the `db.exec(...)` SQL string (after the FTS table):

```sql
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
```

(`foreign_keys = ON` is already pragma'd in `initDb` — cascade works.)

**Step 4: Run tests to verify they pass** — `npm test`, expect 21/21 PASS.

**Step 5: Commit**

```bash
git add api/src/db.js api/src/db.test.js
git commit -m "feat(api): add favorites and collections tables"
```

---

## Task 2: Favorites endpoints

**Files:**
- Modify: `api/src/routes.js`
- Test: `api/src/routes.test.js`

**Step 1: Add a mutation helper + failing tests.** In `api/src/routes.test.js`, add next to the existing `request()` helper:

```js
function send(app, path, method, body) {
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const port = server.address().port;
      fetch(`http://localhost:${port}${path}`, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined,
      })
        .then(res => res.json().then(b => ({ status: res.status, body: b })))
        .then(result => { server.close(); resolve(result); })
        .catch(err => { server.close(); resolve({ status: 500, body: { error: err.message } }); });
    });
  });
}
```

Then a new describe block (inside `describe('API routes', ...)` so it shares `app`/`db`):

```js
  describe('favorites', () => {
    it('starts empty', async () => {
      const { status, body } = await request(app, '/api/favorites');
      assert.equal(status, 200);
      assert.deepEqual(body.ids, []);
    });

    it('PUT adds a favorite', async () => {
      const { body: list } = await request(app, '/api/models');
      const id = list.models[0].id;
      const { status } = await send(app, `/api/favorites/${id}`, 'PUT');
      assert.equal(status, 200);
      const { body } = await request(app, '/api/favorites');
      assert.deepEqual(body.ids, [id]);
    });

    it('PUT is idempotent', async () => {
      const { body: list } = await request(app, '/api/models');
      const id = list.models[0].id;
      await send(app, `/api/favorites/${id}`, 'PUT');
      const { body } = await request(app, '/api/favorites');
      assert.equal(body.ids.length, 1);
    });

    it('PUT 404s for unknown model', async () => {
      const { status } = await send(app, '/api/favorites/999999', 'PUT');
      assert.equal(status, 404);
    });

    it('DELETE removes a favorite', async () => {
      const { body: list } = await request(app, '/api/models');
      const id = list.models[0].id;
      await send(app, `/api/favorites/${id}`, 'DELETE');
      const { body } = await request(app, '/api/favorites');
      assert.deepEqual(body.ids, []);
    });
  });
```

**Step 2: Run** `npm test` — new tests FAIL (404 HTML / route missing).

**Step 3: Implement** — in `api/src/routes.js`, before `return router;`:

```js
  // ── Favorites ──
  const listFavorites = db.prepare('SELECT model_id FROM favorites ORDER BY created_at DESC');
  const insertFavorite = db.prepare('INSERT OR IGNORE INTO favorites (model_id, created_at) VALUES (?, ?)');
  const deleteFavorite = db.prepare('DELETE FROM favorites WHERE model_id = ?');

  router.get('/api/favorites', (req, res) => {
    res.json({ ids: listFavorites.all().map(r => r.model_id) });
  });

  router.put('/api/favorites/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    if (!getModelById.get(id)) return res.status(404).json({ error: 'Model not found' });
    insertFavorite.run(id, new Date().toISOString());
    res.json({ favorited: true });
  });

  router.delete('/api/favorites/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    deleteFavorite.run(id);
    res.json({ favorited: false });
  });
```

**Step 4: Run** `npm test` — all PASS.

**Step 5: Commit** — `git add api/src/routes.js api/src/routes.test.js` · `git commit -m "feat(api): favorites endpoints"`

---

## Task 3: Collections endpoints

**Files:**
- Modify: `api/src/routes.js`
- Test: `api/src/routes.test.js`

**Step 1: Failing tests** (same pattern, new describe block):

```js
  describe('collections', () => {
    let collId, modelId;

    it('starts empty', async () => {
      const { status, body } = await request(app, '/api/collections');
      assert.equal(status, 200);
      assert.deepEqual(body, []);
    });

    it('POST creates a collection', async () => {
      const { status, body } = await send(app, '/api/collections', 'POST', { name: 'To print', hue: 28 });
      assert.equal(status, 200);
      assert.equal(body.name, 'To print');
      assert.equal(body.hue, 28);
      assert.ok(body.id);
      collId = body.id;
    });

    it('POST rejects empty name', async () => {
      const { status } = await send(app, '/api/collections', 'POST', { name: '  ' });
      assert.equal(status, 400);
    });

    it('PUT adds a model to a collection', async () => {
      const { body: list } = await request(app, '/api/models');
      modelId = list.models[0].id;
      const { status } = await send(app, `/api/collections/${collId}/models/${modelId}`, 'PUT');
      assert.equal(status, 200);
      const { body } = await request(app, '/api/collections');
      assert.equal(body[0].count, 1);
    });

    it('DELETE removes a model from a collection', async () => {
      await send(app, `/api/collections/${collId}/models/${modelId}`, 'DELETE');
      const { body } = await request(app, '/api/collections');
      assert.equal(body[0].count, 0);
    });

    it('DELETE removes a collection', async () => {
      await send(app, `/api/collections/${collId}`, 'DELETE');
      const { body } = await request(app, '/api/collections');
      assert.deepEqual(body, []);
    });
  });
```

**Step 2: Run** `npm test` — FAIL.

**Step 3: Implement** — in `api/src/routes.js`:

```js
  // ── Collections ──
  const listCollections = db.prepare(`
    SELECT c.id, c.name, c.hue, COUNT(cm.model_id) AS count
    FROM collections c
    LEFT JOIN collection_models cm ON cm.collection_id = c.id
    GROUP BY c.id ORDER BY c.created_at
  `);
  const insertCollection = db.prepare('INSERT INTO collections (name, hue, created_at) VALUES (?, ?, ?)');
  const getCollection = db.prepare('SELECT * FROM collections WHERE id = ?');
  const deleteCollection = db.prepare('DELETE FROM collections WHERE id = ?');
  const insertCollectionModel = db.prepare(
    'INSERT OR IGNORE INTO collection_models (collection_id, model_id, added_at) VALUES (?, ?, ?)'
  );
  const deleteCollectionModel = db.prepare(
    'DELETE FROM collection_models WHERE collection_id = ? AND model_id = ?'
  );
  const listCollectionsForModel = db.prepare(
    'SELECT collection_id FROM collection_models WHERE model_id = ?'
  );

  router.get('/api/collections', (req, res) => {
    res.json(listCollections.all());
  });

  router.post('/api/collections', (req, res) => {
    const name = (req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: 'name required' });
    const hue = Number.isInteger(req.body?.hue) ? ((req.body.hue % 360) + 360) % 360 : 28;
    const { lastInsertRowid } = insertCollection.run(name, hue, new Date().toISOString());
    res.json({ id: lastInsertRowid, name, hue, count: 0 });
  });

  router.delete('/api/collections/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    deleteCollection.run(id);
    res.json({ deleted: true });
  });

  router.put('/api/collections/:id/models/:modelId', (req, res) => {
    const id = parseInt(req.params.id, 10);
    const modelId = parseInt(req.params.modelId, 10);
    if (isNaN(id) || isNaN(modelId)) return res.status(400).json({ error: 'Invalid id' });
    if (!getCollection.get(id)) return res.status(404).json({ error: 'Collection not found' });
    if (!getModelById.get(modelId)) return res.status(404).json({ error: 'Model not found' });
    insertCollectionModel.run(id, modelId, new Date().toISOString());
    res.json({ added: true });
  });

  router.delete('/api/collections/:id/models/:modelId', (req, res) => {
    const id = parseInt(req.params.id, 10);
    const modelId = parseInt(req.params.modelId, 10);
    if (isNaN(id) || isNaN(modelId)) return res.status(400).json({ error: 'Invalid id' });
    deleteCollectionModel.run(id, modelId);
    res.json({ added: false });
  });

  // Which collections contain this model (for the detail page)
  router.get('/api/models/:id/collections', (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    res.json({ ids: listCollectionsForModel.all(id).map(r => r.collection_id) });
  });
```

Note: `app.use(express.json())` is already mounted at `api/src/index.js:17` — `req.body` works.

**Step 4: Run** `npm test` — all PASS.

**Step 5: Commit** — `git commit -m "feat(api): collections CRUD + membership endpoints"`

---

## Task 4: Model list filters (favorites / missing / recent / collection)

**Files:**
- Modify: `api/src/routes.js` (GET `/api/models`)
- Test: `api/src/routes.test.js`

**Step 1: Failing tests.** New describe block. Fixture: insert one extra model directly (no STL files, recent date), clean it up after, so existing `total: 2` assertions stay valid:

```js
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

    it('favorites=1 returns only favorited models', async () => {
      const { body: list } = await request(app, '/api/models?sort=title');
      favId = list.models[0].id;
      await send(app, `/api/favorites/${favId}`, 'PUT');
      const { body } = await request(app, '/api/models?favorites=1');
      assert.equal(body.total, 1);
      assert.equal(body.models[0].id, favId);
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

    it('collection=<id> returns that collection\'s models', async () => {
      const { body: coll } = await send(app, '/api/collections', 'POST', { name: 'Filter Test', hue: 150 });
      await send(app, `/api/collections/${coll.id}/models/${extraId}`, 'PUT');
      const { body } = await request(app, `/api/models?collection=${coll.id}`);
      assert.equal(body.total, 1);
      assert.equal(body.models[0].id, extraId);
      await send(app, `/api/collections/${coll.id}`, 'DELETE');
    });
  });
```

**Step 2: Run** `npm test` — 4 FAIL.

**Step 3: Implement** — in GET `/api/models` in `api/src/routes.js`, after the existing `if (creator)` block:

```js
    if (req.query.favorites === '1') {
      conditions.push('m.id IN (SELECT model_id FROM favorites)');
    }
    if (req.query.missing === '1') {
      conditions.push("lower(m.files) NOT LIKE '%.stl%'");
    }
    if (req.query.recent === '1') {
      conditions.push("m.date >= date('now','-30 day')");
    }
    const collectionId = parseInt(req.query.collection, 10);
    if (!isNaN(collectionId)) {
      conditions.push('m.id IN (SELECT model_id FROM collection_models WHERE collection_id = ?)');
      params.push(collectionId);
    }
```

(Count query and page query already share `conditions`/`params` — no other change.)

**Step 4: Run** `npm test` — all PASS.

**Step 5: Commit** — `git commit -m "feat(api): favorites/missing/recent/collection filters on model list"`

---

## Task 5: Sidebar counts — `/api/counts` + creator model counts

**Files:**
- Modify: `api/src/routes.js`
- Test: `api/src/routes.test.js`

**Step 1: Failing tests:**

```js
  describe('counts', () => {
    it('GET /api/counts returns nav counts', async () => {
      const { status, body } = await request(app, '/api/counts');
      assert.equal(status, 200);
      assert.equal(body.all, 2);          // the two base fixtures
      assert.equal(typeof body.recent, 'number');
      assert.equal(typeof body.favorites, 'number');
      assert.equal(typeof body.missing, 'number');
    });

    it('GET /api/creators includes model counts', async () => {
      const { body } = await request(app, '/api/creators');
      const a = body.find(c => c.name === 'CreatorA');
      assert.equal(a.count, 1);
    });
  });
```

**Step 2: Run** — FAIL.

**Step 3: Implement.** Replace the `getAllCreators` statement:

```js
  const getAllCreators = db.prepare(`
    SELECT creator, substr(folder_path, 1, instr(folder_path, '/') - 1) as folder, COUNT(*) as count
    FROM models GROUP BY creator, folder ORDER BY creator
  `);
```

…and include it in the response mapping in GET `/api/creators`: `count: r.count`.

Add the counts route:

```js
  const countAll = db.prepare('SELECT COUNT(*) n FROM models');
  const countRecent = db.prepare("SELECT COUNT(*) n FROM models WHERE date >= date('now','-30 day')");
  const countFavorites = db.prepare('SELECT COUNT(*) n FROM favorites');
  const countMissing = db.prepare("SELECT COUNT(*) n FROM models WHERE lower(files) NOT LIKE '%.stl%'");

  router.get('/api/counts', (req, res) => {
    res.json({
      all: countAll.get().n,
      recent: countRecent.get().n,
      favorites: countFavorites.get().n,
      missing: countMissing.get().n,
    });
  });
```

**Step 4: Run** `npm test` — all PASS. **Restart the background API process now** (kill the old task, relaunch with the same env/binary) so the frontend tasks have the new endpoints.

**Step 5: Commit** — `git commit -m "feat(api): counts endpoint and per-creator model counts"`

---

## Task 6: Frontend foundation — fonts, design tokens, API client

**Files:**
- Modify: `web/index.html`, `web/src/index.css`, `web/src/api.js`

**Step 1: `web/index.html`** — swap fonts + title, move body styling to CSS:

```html
<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Space+Mono:wght@400;700&family=Archivo:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <title>MANIFOLD — 3D print library</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>
```

**Step 2: `web/src/index.css`** — full replacement (tokens from the handoff Design Tokens table):

```css
@import "tailwindcss";
@plugin "daisyui" {
  themes: dark;
}

@theme {
  --font-sans: 'Archivo', sans-serif;
  --font-display: 'Space Grotesk', sans-serif;
  --font-heading: 'Space Grotesk', sans-serif; /* legacy alias used by ModelDetailPage */
  --font-mono: 'Space Mono', monospace;

  --color-canvas: #0b0c10;
  --color-panel: rgba(255, 255, 255, 0.045);
  --color-panel2: rgba(255, 255, 255, 0.025);
  --color-ink: #f3f4f7;
  --color-dim: rgba(243, 244, 247, 0.52);
  --color-faint: rgba(243, 244, 247, 0.32);
  --color-line: rgba(255, 255, 255, 0.09);
  --color-line2: rgba(255, 255, 255, 0.05);
  --color-accent: #e7b15a;
  --color-accent-ink: #1c1505;
  --color-accent-dim: rgba(231, 177, 90, 0.16);
}

body {
  margin: 0;
  background: var(--color-canvas);
  color: var(--color-ink);
  font-family: var(--font-sans);
}

/* main column scrollbar (handoff: 10px, line thumb, canvas border) */
.main-scroll::-webkit-scrollbar { width: 10px; }
.main-scroll::-webkit-scrollbar-thumb {
  background: var(--color-line);
  border-radius: 6px;
  border: 3px solid var(--color-canvas);
}

/* sidebar creators list scrollbar (handoff: 8px) */
.sidebar-scroll::-webkit-scrollbar { width: 8px; }
.sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
.sidebar-scroll::-webkit-scrollbar-thumb {
  background: var(--color-line);
  border-radius: 5px;
  border: 2px solid var(--color-canvas);
}
```

**Step 3: `web/src/api.js`** — append client functions:

```js
export async function fetchFavorites() {
  const res = await fetch(`${BASE}/favorites`);
  return res.json();
}

export async function setFavorite(id, on) {
  const res = await fetch(`${BASE}/favorites/${id}`, { method: on ? 'PUT' : 'DELETE' });
  return res.json();
}

export async function fetchCollections() {
  const res = await fetch(`${BASE}/collections`);
  return res.json();
}

export async function createCollection(name, hue) {
  const res = await fetch(`${BASE}/collections`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, hue }),
  });
  return res.json();
}

export async function setModelInCollection(collectionId, modelId, on) {
  const res = await fetch(`${BASE}/collections/${collectionId}/models/${modelId}`, {
    method: on ? 'PUT' : 'DELETE',
  });
  return res.json();
}

export async function fetchModelCollections(modelId) {
  const res = await fetch(`${BASE}/models/${modelId}/collections`);
  return res.json();
}

export async function fetchCounts() {
  const res = await fetch(`${BASE}/counts`);
  return res.json();
}
```

**Step 4: Verify** — Vite hot-reloads; the existing UI will look font-shifted/possibly broken (body classes moved). That's expected mid-migration; just confirm no build error in the Vite output and the page still renders.

**Step 5: Commit** — `git add web/index.html web/src/index.css web/src/api.js` · `git commit -m "feat(web): MANIFOLD design tokens, fonts, and API client methods"`

---

## Task 7: Icon component

**Files:**
- Create: `web/src/components/Icon.jsx`

The handoff specifies 1.5px-stroke line icons; we have no icon dependency, and `sidebars.js` ships exact paths — recreate those (zero new deps, pixel-faithful).

**Step 1: Create `web/src/components/Icon.jsx`:**

```jsx
// 1.5px-stroke line icons from the MANIFOLD handoff (sidebars.js / screen.js).
const ICONS = {
  grid: { vb: '0 0 18 18', el: <><rect x="2.3" y="2.3" width="5.6" height="5.6" rx="1.2" /><rect x="10.1" y="2.3" width="5.6" height="5.6" rx="1.2" /><rect x="2.3" y="10.1" width="5.6" height="5.6" rx="1.2" /><rect x="10.1" y="10.1" width="5.6" height="5.6" rx="1.2" /></> },
  clock: { vb: '0 0 18 18', el: <><circle cx="9" cy="9" r="6.6" /><path d="M9 5.2V9l2.6 1.6" /></> },
  heart: { vb: '0 0 18 18', el: <path d="M9 15S2.6 11 2.6 6.6A3 3 0 0 1 9 5a3 3 0 0 1 6.4 1.6C15.4 11 9 15 9 15z" /> },
  alert: { vb: '0 0 18 18', el: <><path d="M9 2.6l6.6 11.8H2.4z" /><path d="M9 7.2v3.4M9 12.6v.05" /></> },
  sliders: { vb: '0 0 18 18', el: <><path d="M3 5.4h7M13 5.4h2M3 12.6h2M8 12.6h7" /><circle cx="11.5" cy="5.4" r="1.6" /><circle cx="5.5" cy="12.6" r="1.6" /></> },
  search: { vb: '0 0 18 18', el: <><circle cx="7.8" cy="7.8" r="5" /><path d="M11.5 11.5l3 3" /></> },
  plus: { vb: '0 0 18 18', el: <path d="M9 3.5v11M3.5 9h11" /> },
  chevr: { vb: '0 0 18 18', el: <path d="M7 4.5L11.5 9 7 13.5" /> },
  shuffle: { vb: '0 0 18 18', el: <><path d="M2.5 4.5h3l7 9h3" /><path d="M2.5 13.5h3l2.1-2.7M9.4 7.2l3.1-2.7h3" /><path d="M13.5 2.5l2 2-2 2M13.5 11.5l2 2-2 2" /></> },
  download: { vb: '0 0 16 16', el: <path d="M8 2v8m0 0L5 7m3 3l3-3M3 13h10" /> },
};

export default function Icon({ name, className = '' }) {
  const icon = ICONS[name];
  if (!icon) return null;
  return (
    <svg
      viewBox={icon.vb}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {icon.el}
    </svg>
  );
}
```

**Step 2: Verify** — Vite compiles with no error (component unused so far).

**Step 3: Commit** — `git commit -m "feat(web): line icon component from MANIFOLD handoff"`

---

## Task 8: Sidebar

**Files:**
- Create: `web/src/components/Sidebar.jsx`

Recreates the `stdSection` sidebar variant: brand → search (⌘K) → nav → Collections → Creators (flex/scroll) → owner footer.

**Step 1: Create `web/src/components/Sidebar.jsx`:**

```jsx
import { useState, useEffect, useRef } from 'react';
import { fetchMe, creatorLogoUrl } from '../api';
import Icon from './Icon';

function monogram(name) {
  const words = name.split(/[\s_-]+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2)).toUpperCase();
}

function NavItem({ icon, label, count, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-[11px] rounded-[9px] px-[11px] py-[9px] text-left transition-colors ${
        active ? 'bg-accent-dim text-ink' : 'text-dim hover:bg-panel hover:text-ink'
      }`}
    >
      <Icon name={icon} className={`h-[17px] w-[17px] shrink-0 ${active ? 'text-accent' : 'text-faint'}`} />
      <span className="flex-1 truncate text-[13.5px]">{label}</span>
      {count != null && (
        <span className={`font-mono text-[10.5px] ${active ? 'text-accent' : 'text-faint'}`}>
          {count.toLocaleString()}
        </span>
      )}
    </button>
  );
}

function SectionLabel({ children, right }) {
  return (
    <div className="mb-[11px] flex items-center justify-between px-[11px] font-mono text-[10px] uppercase tracking-[.2em] text-faint">
      <span>{children}</span>
      {right}
    </div>
  );
}

const CREATORS_COLLAPSED = 6;

export default function Sidebar({
  view, onViewChange, counts, collections, creators,
  q, onSearch, onNewCollection,
}) {
  const [owner, setOwner] = useState(null);
  const [creatorsExpanded, setCreatorsExpanded] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => { fetchMe().then(setOwner); }, []);

  // ⌘K / Ctrl+K focuses search
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const visibleCreators = creatorsExpanded ? creators : creators.slice(0, CREATORS_COLLAPSED);
  const ownerLabel = owner?.name || owner?.email || 'Library owner';

  return (
    <aside className="flex h-screen w-[272px] shrink-0 flex-col border-r border-line bg-canvas px-3.5 py-[18px]">
      {/* Brand */}
      <div className="mb-5 flex items-center gap-[11px] px-1.5 py-1">
        <span className="relative h-7 w-7 shrink-0 rounded-lg bg-accent">
          <span className="absolute inset-[7px] rotate-45 rounded-[2px] border-[1.5px] border-accent-ink" />
        </span>
        <span className="font-display text-[17px] font-bold tracking-[.15em]">MANIFOLD</span>
      </div>

      {/* Search */}
      <div className="mb-[22px] flex items-center gap-[9px] rounded-[10px] border border-line bg-panel px-3 py-2.5 transition-colors focus-within:border-accent hover:border-accent">
        <Icon name="search" className="h-4 w-4 shrink-0 text-faint" />
        <input
          ref={searchRef}
          value={q}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search…"
          className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-faint"
        />
        <kbd className="rounded-[5px] border border-line px-1.5 py-0.5 font-mono text-[10px] text-dim">⌘K</kbd>
      </div>

      {/* Library nav */}
      <nav className="mb-6 flex flex-col gap-0.5">
        <NavItem icon="grid" label="All models" count={counts?.all} active={view.type === 'all'} onClick={() => onViewChange({ type: 'all' })} />
        <NavItem icon="clock" label="Recently added" count={counts?.recent} active={view.type === 'recent'} onClick={() => onViewChange({ type: 'recent' })} />
        <NavItem icon="heart" label="Favorites" count={counts?.favorites} active={view.type === 'favorites'} onClick={() => onViewChange({ type: 'favorites' })} />
        <NavItem icon="alert" label="Missing files" count={counts?.missing} active={view.type === 'missing'} onClick={() => onViewChange({ type: 'missing' })} />
      </nav>

      {/* Collections */}
      <div className="mb-[22px]">
        <SectionLabel
          right={
            <button onClick={onNewCollection} className="flex text-dim hover:text-ink" title="New collection">
              <Icon name="plus" className="h-[13px] w-[13px]" />
            </button>
          }
        >
          Collections
        </SectionLabel>
        <div className="flex flex-col gap-px">
          {collections.map((c) => (
            <button
              key={c.id}
              onClick={() => onViewChange({ type: 'collection', id: c.id, name: c.name })}
              className={`flex w-full items-center gap-[11px] rounded-lg px-[11px] py-2 text-left text-[13.5px] transition-colors ${
                view.type === 'collection' && view.id === c.id ? 'bg-panel text-ink' : 'text-dim hover:bg-panel'
              }`}
            >
              <span className="h-[9px] w-[9px] shrink-0 rounded-full" style={{ background: `hsl(${c.hue} 58% 60%)` }} />
              <span className="flex-1 truncate">{c.name}</span>
              <span className="font-mono text-[10px] text-faint">{c.count}</span>
            </button>
          ))}
          <button onClick={onNewCollection} className="flex w-full items-center gap-[11px] rounded-lg px-[11px] py-2 text-left text-[13.5px] text-dim transition-colors hover:bg-panel">
            <span className="-mx-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border border-dashed border-line text-faint">
              <Icon name="plus" className="h-[9px] w-[9px]" />
            </span>
            <span className="flex-1">New collection</span>
          </button>
        </div>
      </div>

      {/* Creators — flexible, scrolls */}
      <div className="flex min-h-0 flex-1 flex-col">
        <SectionLabel right={<span className="text-dim">{creators.length}</span>}>Creators</SectionLabel>
        <div className="sidebar-scroll flex flex-col gap-px overflow-y-auto">
          {visibleCreators.map((c) => {
            const active = view.type === 'creator' && view.creator === c.name;
            return (
              <button
                key={c.name}
                onClick={() => onViewChange({ type: 'creator', creator: c.name })}
                className={`flex w-full items-center gap-2.5 rounded-lg px-[11px] py-1.5 text-left text-[13px] transition-colors ${
                  active ? 'bg-panel text-ink' : 'text-dim hover:bg-panel'
                }`}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-md border border-line bg-panel2 font-mono text-[9px] text-dim">
                  {c.hasLogo ? (
                    <img src={creatorLogoUrl(c.folder)} alt="" className="h-full w-full object-cover" />
                  ) : (
                    monogram(c.name)
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate">{c.name}</span>
                <span className="font-mono text-[10px] text-faint">{c.count}</span>
              </button>
            );
          })}
          {creators.length > CREATORS_COLLAPSED && (
            <button
              onClick={() => setCreatorsExpanded((x) => !x)}
              className="px-[11px] pb-0.5 pt-2 text-left text-xs text-accent"
            >
              {creatorsExpanded ? 'Show less ‹' : `Show all ${creators.length} ›`}
            </button>
          )}
        </div>
      </div>

      {/* Owner footer */}
      <div className="mt-3.5 flex items-center gap-2.5 border-t border-line px-[11px] pb-0.5 pt-3">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent font-mono text-[9px] font-bold text-accent-ink">
          {ownerLabel[0].toUpperCase()}
        </span>
        <span className="truncate text-[13px] text-dim">{ownerLabel}</span>
        <Icon name="sliders" className="ml-auto h-[17px] w-[17px] shrink-0 text-faint opacity-60" />
      </div>
    </aside>
  );
}
```

**Step 2: Verify** — compiles (still unused). **Step 3: Commit** — `git commit -m "feat(web): MANIFOLD sidebar component"`

---

## Task 9: ModelCard rewrite (vcard)

**Files:**
- Rewrite: `web/src/components/ModelCard.jsx`

**Step 1: Replace `web/src/components/ModelCard.jsx`:**

```jsx
import { Link } from 'react-router-dom';
import { previewUrl, fileUrl } from '../api';
import LoadingImage from './LoadingImage';
import Icon from './Icon';

const GLASS = 'bg-[rgba(7,8,11,.5)] backdrop-blur-[6px] border border-white/15';

export default function ModelCard({ model, favorited, onToggleFavorite }) {
  const stls = model.files.filter((f) => f.toLowerCase().endsWith('.stl'));

  const handleDownload = (e) => {
    e.preventDefault();
    e.stopPropagation();
    for (const f of stls) {
      const a = document.createElement('a');
      a.href = fileUrl(model.id, f);
      a.download = f;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  };

  const handleFavorite = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onToggleFavorite?.(model.id);
  };

  return (
    <Link
      to={`/models/${model.id}`}
      className="group block overflow-hidden rounded-[13px] border border-line2 bg-panel2 transition-colors hover:border-line"
    >
      <div className="relative aspect-[4/3] overflow-hidden">
        {model.preview_filename ? (
          <LoadingImage
            src={previewUrl(model.id)}
            alt={model.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-[400ms] ease-out group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-panel text-sm text-faint">
            No preview
          </div>
        )}

        {/* STL pill */}
        <span className={`absolute right-[9px] top-[9px] rounded-[7px] px-2 py-1 font-mono text-[10px] uppercase tracking-[.04em] text-white ${GLASS}`}>
          {stls.length ? `${stls.length} STL${stls.length > 1 ? 's' : ''}` : 'no files'}
        </span>

        {/* Hover actions */}
        <div className="absolute left-[9px] top-[9px] flex -translate-y-[3px] gap-1.5 opacity-0 transition-all duration-[180ms] group-hover:translate-y-0 group-hover:opacity-100">
          {stls.length > 0 && (
            <button
              onClick={handleDownload}
              title="Download STLs"
              className={`flex h-[31px] w-[31px] items-center justify-center rounded-[9px] text-white hover:border-transparent hover:bg-accent hover:text-accent-ink ${GLASS}`}
            >
              <Icon name="download" className="h-[15px] w-[15px]" />
            </button>
          )}
          <button
            onClick={handleFavorite}
            title={favorited ? 'Remove from favorites' : 'Save to favorites'}
            className={`flex h-[31px] w-[31px] items-center justify-center rounded-[9px] hover:border-transparent hover:bg-accent hover:text-accent-ink ${
              favorited ? 'border border-transparent bg-accent text-accent-ink' : `text-white ${GLASS}`
            }`}
          >
            <Icon name="heart" className="h-[15px] w-[15px]" />
          </button>
        </div>
      </div>

      <div className="px-[13px] pb-[13px] pt-[11px]">
        <h3 className="truncate font-display text-[13px] font-semibold">{model.title}</h3>
        <div className="mt-1.5 flex items-center justify-between text-[11.5px] text-dim">
          <span className="truncate">{model.creator}</span>
          <span className="ml-2 shrink-0 font-mono text-[10px] text-faint">{model.date}</span>
        </div>
      </div>
    </Link>
  );
}
```

**Step 2: Verify** — the old BrowsePage passes only `model` (no `favorited`); optional chaining keeps it safe; page renders with new cards. **Step 3: Commit** — `git commit -m "feat(web): MANIFOLD model card with hover download/favorite actions"`

---

## Task 10: FeaturedBento

**Files:**
- Create: `web/src/components/FeaturedBento.jsx`

**Step 1: Create:**

```jsx
import { Link } from 'react-router-dom';
import { previewUrl } from '../api';
import LoadingImage from './LoadingImage';

function StlBadge({ files }) {
  const n = files.filter((f) => f.toLowerCase().endsWith('.stl')).length;
  if (!n) return (
    <span className="rounded-md bg-line2 px-2 py-1 font-mono text-[10.5px] uppercase tracking-[.04em] text-faint">no files</span>
  );
  return (
    <span className="rounded-md bg-[rgba(231,177,90,.18)] px-2 py-1 font-mono text-[10.5px] uppercase tracking-[.04em] text-accent">
      <b>{n}</b> STL{n > 1 ? 's' : ''}
    </span>
  );
}

function CardImage({ model, className = '' }) {
  return model.preview_filename ? (
    <LoadingImage
      src={previewUrl(model.id)}
      alt={model.title}
      className={`h-full w-full object-cover transition-transform duration-[400ms] ease-out group-hover:scale-105 ${className}`}
    />
  ) : (
    <div className="flex h-full w-full items-center justify-center bg-panel text-sm text-faint">No preview</div>
  );
}

export default function FeaturedBento({ models }) {
  if (!models || models.length < 5) return null;
  const [hero, ...small] = models.slice(0, 5);

  return (
    <div className="mb-[30px] grid grid-cols-2 gap-3.5 min-[1180px]:grid-cols-[1.5fr_1fr_1fr] min-[1180px]:grid-rows-[188px_188px]">
      {/* Large card */}
      <Link
        to={`/models/${hero.id}`}
        className="group relative col-span-2 block h-[260px] overflow-hidden rounded-2xl border border-line2 min-[1180px]:col-span-1 min-[1180px]:row-span-2 min-[1180px]:h-auto"
      >
        <div className="absolute inset-0"><CardImage model={hero} /></div>
        <div className="absolute inset-0 bg-gradient-to-t from-[rgba(7,8,11,.92)] from-0% via-[rgba(7,8,11,.35)] via-[42%] to-transparent to-[68%]" />
        <div className="absolute inset-x-0 bottom-0 p-6">
          <h3 className="mb-[11px] font-display text-[26px] font-bold tracking-[-.02em] text-white">{hero.title}</h3>
          <div className="flex items-center gap-2.5 text-[13px] text-white/70">
            <span>{hero.creator}</span>
            <span className="opacity-50">·</span>
            <span>{hero.date}</span>
            <StlBadge files={hero.files} />
          </div>
        </div>
      </Link>

      {/* Four small cards */}
      {small.map((m) => (
        <Link key={m.id} to={`/models/${m.id}`} className="group relative block h-[160px] overflow-hidden rounded-[14px] border border-line2 min-[1180px]:h-auto">
          <div className="absolute inset-0"><CardImage model={m} /></div>
          <div className="absolute inset-0 bg-gradient-to-t from-[rgba(7,8,11,.93)] from-0% via-[rgba(7,8,11,.25)] via-[46%] to-transparent to-[72%]" />
          <span className="absolute right-[9px] top-[9px] rounded-[7px] border border-white/15 bg-[rgba(7,8,11,.5)] px-2 py-1 font-mono text-[10px] uppercase tracking-[.04em] text-white backdrop-blur-[6px]">
            {(() => { const n = m.files.filter((f) => f.toLowerCase().endsWith('.stl')).length; return n ? `${n} STL${n > 1 ? 's' : ''}` : 'no files'; })()}
          </span>
          <div className="absolute inset-x-0 bottom-0 p-3.5 pb-[15px]">
            <h4 className="mb-1.5 line-clamp-2 font-display text-sm font-semibold leading-[1.18] text-white">{m.title}</h4>
            <div className="text-[11.5px] text-white/65">{m.creator}</div>
          </div>
        </Link>
      ))}
    </div>
  );
}
```

**Step 2: Verify** compiles. **Step 3: Commit** — `git commit -m "feat(web): featured bento hero"`

---

## Task 11: BrowsePage rewrite (main column)

**Files:**
- Rewrite: `web/src/pages/BrowsePage.jsx`

Receives all state from App (next task). Keeps the proven infinite-scroll/seeded-shuffle mechanics from the old implementation.

**Step 1: Replace `web/src/pages/BrowsePage.jsx`:**

```jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchModels } from '../api';
import ModelCard from '../components/ModelCard';
import FeaturedBento from '../components/FeaturedBento';
import Icon from '../components/Icon';

const LIMIT = 24;

const SORT_OPTIONS = [
  { value: 'random', label: 'Shuffle' },
  { value: 'date', label: 'Newest' },
  { value: 'title', label: 'Title' },
  { value: 'creator', label: 'Creator' },
];

function viewParams(view) {
  switch (view.type) {
    case 'recent': return { recent: 1 };
    case 'favorites': return { favorites: 1 };
    case 'missing': return { missing: 1 };
    case 'creator': return { creator: view.creator };
    case 'collection': return { collection: view.id };
    default: return {};
  }
}

function viewTitle(view) {
  switch (view.type) {
    case 'recent': return 'Recently added';
    case 'favorites': return 'Favorites';
    case 'missing': return 'Missing files';
    case 'creator': return view.creator;
    case 'collection': return view.name;
    default: return 'All models';
  }
}

const EMPTY_HINTS = {
  favorites: 'No favorites yet — hover a model and tap the heart.',
  missing: 'Nothing missing — every model has STL files.',
  collection: 'This collection is empty.',
};

export default function BrowsePage({ view, sort, onSortChange, q, favorites, onToggleFavorite, reindexing, onReindex }) {
  const [models, setModels] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [seed] = useState(() => Math.floor(Math.random() * 1000000));
  const [featSeed, setFeatSeed] = useState(() => Math.floor(Math.random() * 1000000));
  const [featured, setFeatured] = useState([]);
  const sentinelRef = useRef(null);
  const scrollRef = useRef(null);
  const loadingRef = useRef(false);

  const showFeatured = view.type === 'all' && !q;

  // Featured: random 5, reshuffled via featSeed
  useEffect(() => {
    if (!showFeatured) return;
    fetchModels({ limit: 5, sort: 'random', seed: featSeed }).then((d) => setFeatured(d.models));
  }, [showFeatured, featSeed]);

  const loadPage = useCallback(async (pageNum, append) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);

    const data = await fetchModels({
      q,
      ...viewParams(view),
      page: pageNum,
      limit: LIMIT,
      sort,
      ...(sort === 'random' ? { seed } : {}),
    });

    setTotal(data.total);
    setModels((prev) => (append ? [...prev, ...data.models] : data.models));
    setHasMore(pageNum * LIMIT < data.total);
    setPage(pageNum);
    setLoading(false);
    loadingRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, sort, seed, view.type, view.creator, view.id]);

  // Reset when view/filters/sort change
  useEffect(() => {
    setModels([]);
    setPage(1);
    setHasMore(true);
    scrollRef.current?.scrollTo({ top: 0 });
    loadPage(1, false);
  }, [loadPage]);

  // Infinite scroll observer
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingRef.current) {
          loadPage(page + 1, true);
        }
      },
      { root: scrollRef.current, rootMargin: '400px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, page, loadPage]);

  const title = viewTitle(view);
  const emptyHint = !loading && models.length === 0 && (EMPTY_HINTS[view.type] || 'No models match.');

  return (
    <>
      {/* Header bar */}
      <header className="flex shrink-0 items-center justify-between gap-5 border-b border-line px-[30px] py-[18px]">
        <div className="font-display text-[19px] font-semibold">
          {title} <span className="ml-1 font-normal text-dim">{total.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex gap-1">
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onSortChange(opt.value)}
                className={`rounded-lg border px-[13px] py-[7px] text-[13px] transition-colors ${
                  sort === opt.value
                    ? 'border-line bg-panel text-ink'
                    : 'border-transparent text-dim hover:text-ink'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <span className="h-[22px] w-px bg-line" />
          <button
            onClick={onReindex}
            disabled={reindexing}
            className="whitespace-nowrap rounded-[10px] border border-line bg-panel px-4 py-[9px] text-[13px] text-dim transition-colors hover:border-accent hover:text-ink disabled:opacity-50"
          >
            {reindexing ? 'Syncing…' : 'Sync library'}
          </button>
        </div>
      </header>

      {/* Scroll area */}
      <div ref={scrollRef} className="main-scroll flex-1 overflow-y-auto px-[30px] pb-10 pt-[26px]">
        {showFeatured && featured.length >= 5 && (
          <>
            <div className="mb-4 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[.2em] text-faint">
              Featured
              <button
                onClick={() => setFeatSeed(Math.floor(Math.random() * 1000000))}
                title="Shuffle featured"
                className="flex text-faint transition-colors hover:text-accent"
              >
                <Icon name="shuffle" className="h-3.5 w-3.5" />
              </button>
            </div>
            <FeaturedBento models={featured} />
          </>
        )}

        {/* Grid meta row */}
        <div className="mb-4 flex items-baseline justify-between">
          <span className="font-mono text-[11px] uppercase tracking-[.2em] text-faint">
            {view.type === 'all' && !q ? 'Everything' : title}
          </span>
          <span className="font-mono text-[11px] text-faint">
            {models.length > 0 ? `1–${models.length} of ${total.toLocaleString()}` : '0 results'}
          </span>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(224px,1fr))] gap-3.5">
          {models.map((model) => (
            <ModelCard
              key={model.id}
              model={model}
              favorited={favorites.has(model.id)}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </div>

        {emptyHint && <p className="py-16 text-center text-sm text-dim">{emptyHint}</p>}

        <div ref={sentinelRef} className="flex h-16 items-center justify-center">
          {loading && <span className="loading loading-spinner loading-md text-faint" />}
          {!hasMore && models.length > 0 && (
            <p className="font-mono text-[11px] text-faint">All {total.toLocaleString()} models loaded</p>
          )}
        </div>
      </div>
    </>
  );
}
```

**Step 2: Verify** — won't render correctly until App passes the new props (next task); confirm Vite compiles only. **Step 3: Commit** — `git commit -m "feat(web): MANIFOLD main column (header bar, featured, grid)"`

---

## Task 12: App shell + CollectionDialog — wire it all together

**Files:**
- Create: `web/src/components/CollectionDialog.jsx`
- Rewrite: `web/src/App.jsx`

**Step 1: Create `web/src/components/CollectionDialog.jsx`** (overlay pattern mirrors StaleModelsDialog):

```jsx
import { useState } from 'react';

const HUES = [28, 150, 45, 280, 200, 330];

export default function CollectionDialog({ onCreate, onDismiss }) {
  const [name, setName] = useState('');
  const [hue, setHue] = useState(HUES[0]);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    await onCreate(trimmed, hue);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onDismiss}>
      <div
        className="w-full max-w-sm rounded-2xl border border-line bg-canvas p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 font-display text-base font-semibold">New collection</h2>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Collection name"
          className="mb-4 w-full rounded-[10px] border border-line bg-panel px-3 py-2.5 text-[13px] text-ink outline-none placeholder:text-faint focus:border-accent"
        />
        <div className="mb-6 flex items-center gap-2.5">
          {HUES.map((h) => (
            <button
              key={h}
              onClick={() => setHue(h)}
              className={`h-6 w-6 rounded-full transition-transform ${hue === h ? 'scale-110 ring-2 ring-accent ring-offset-2 ring-offset-canvas' : ''}`}
              style={{ background: `hsl(${h} 58% 60%)` }}
            />
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onDismiss} className="rounded-[10px] border border-line bg-panel px-4 py-2 text-[13px] text-dim hover:text-ink">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!name.trim() || busy}
            className="rounded-[10px] bg-accent px-4 py-2 text-[13px] font-semibold text-accent-ink disabled:opacity-40"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Rewrite `web/src/App.jsx`:**

```jsx
import { useState, useEffect, useCallback } from 'react';
import {
  triggerReindex, deleteModels,
  fetchFavorites, setFavorite,
  fetchCollections, createCollection,
  fetchCounts, fetchCreators,
} from './api';
import BrowsePage from './pages/BrowsePage';
import Sidebar from './components/Sidebar';
import CollectionDialog from './components/CollectionDialog';
import StaleModelsDialog from './components/StaleModelsDialog';

export default function App() {
  const [view, setView] = useState({ type: 'all' });
  const [sort, setSort] = useState('random');
  const [q, setQ] = useState('');
  const [favorites, setFavorites] = useState(() => new Set());
  const [collections, setCollections] = useState([]);
  const [counts, setCounts] = useState(null);
  const [creators, setCreators] = useState([]);
  const [showNewCollection, setShowNewCollection] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [staleModels, setStaleModels] = useState(null);

  const refreshSidebar = useCallback(() => {
    fetchCounts().then(setCounts);
    fetchCollections().then(setCollections);
    fetchCreators().then(setCreators);
  }, []);

  useEffect(() => {
    refreshSidebar();
    fetchFavorites().then(({ ids }) => setFavorites(new Set(ids)));
  }, [refreshSidebar]);

  const handleToggleFavorite = useCallback((id) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      const on = !next.has(id);
      if (on) next.add(id); else next.delete(id);
      setFavorite(id, on).then(() => fetchCounts().then(setCounts));
      return next;
    });
  }, []);

  const handleCreateCollection = useCallback(async (name, hue) => {
    await createCollection(name, hue);
    setShowNewCollection(false);
    fetchCollections().then(setCollections);
  }, []);

  const handleReindex = useCallback(async () => {
    setReindexing(true);
    try {
      const stats = await triggerReindex();
      if (stats.stale.length > 0) setStaleModels(stats.stale);
      refreshSidebar();
      setRefreshKey((k) => k + 1);
    } catch {
      alert('Sync failed');
    }
    setReindexing(false);
  }, [refreshSidebar]);

  const handleDeleteStale = useCallback(async (ids) => {
    try {
      await deleteModels(ids);
      setStaleModels(null);
      refreshSidebar();
      setRefreshKey((k) => k + 1);
    } catch {
      alert('Failed to remove stale models');
    }
  }, [refreshSidebar]);

  return (
    <div className="flex h-screen overflow-hidden bg-canvas text-ink">
      <Sidebar
        view={view}
        onViewChange={setView}
        counts={counts}
        collections={collections}
        creators={creators}
        q={q}
        onSearch={setQ}
        onNewCollection={() => setShowNewCollection(true)}
      />
      <main className="flex h-screen min-w-0 flex-1 flex-col">
        <BrowsePage
          key={refreshKey}
          view={view}
          sort={sort}
          onSortChange={setSort}
          q={q}
          favorites={favorites}
          onToggleFavorite={handleToggleFavorite}
          reindexing={reindexing}
          onReindex={handleReindex}
        />
      </main>
      {showNewCollection && (
        <CollectionDialog onCreate={handleCreateCollection} onDismiss={() => setShowNewCollection(false)} />
      )}
      {staleModels && (
        <StaleModelsDialog models={staleModels} onConfirm={handleDeleteStale} onDismiss={() => setStaleModels(null)} />
      )}
    </div>
  );
}
```

Note: the old reindex `alert(...)` success popup is dropped (the design's Sync button shows busy state instead); failures still alert.

**Step 3: Verify in the browser** (http://localhost:5173):
- Shell: sidebar left (272px), main column scrolls independently, no page scroll
- Nav switching changes title/count/dataset; Favorites empty state shows
- Heart on a card → Favorites count increments; persists after reload (backend)
- New collection → dialog → appears in sidebar; clicking it shows empty collection
- Creator rows filter; Show all expands; ⌘K focuses search; typing filters grid
- Sort tabs work (Shuffle/Newest/Title/Creator); Sync library runs reindex
- Featured bento on All models only; shuffle affordance reshuffles

**Step 4: Commit** — `git add -A web/src` · `git commit -m "feat(web): MANIFOLD app shell with favorites, collections, and view state"`

---

## Task 13: Model detail page — favorite toggle + add to collection

**Files:**
- Modify: `web/src/pages/ModelDetailPage.jsx`

The card hover actions are per the handoff; collection membership management isn't designed there, so it lives on the detail page (agreed deviation).

**Step 1: Read `web/src/pages/ModelDetailPage.jsx` first** (it was not rewritten in this plan — preserve its gallery/download UI). Add:

- Imports: `fetchFavorites, setFavorite, fetchCollections, fetchModelCollections, setModelInCollection` from `../api`, plus `Icon`.
- State: `const [favorited, setFavorited] = useState(false);` `const [collections, setCollections] = useState([]);` `const [memberIds, setMemberIds] = useState(new Set());`
- On mount (with the model id): `fetchFavorites().then(({ ids }) => setFavorited(ids.includes(id)));` `fetchCollections().then(setCollections);` `fetchModelCollections(id).then(({ ids }) => setMemberIds(new Set(ids)));`
- Next to the model title, a heart button (same accent-filled style as the card) toggling `setFavorite(id, !favorited)`.
- A "Collections" row: one pill per collection (`co-dot` color + name); clicking toggles membership via `setModelInCollection(c.id, id, !memberIds.has(c.id))`, active pill = `bg-panel text-ink border-line`, inactive = `text-dim border-line2`.
- Restyle the page's container/text colors only where they clash with the new tokens (`bg-gray-*` → `bg-panel2`/`border-line2` etc.) — keep structure.

**Step 2: Verify in browser** — open a model, toggle heart (check sidebar count on back-nav), add/remove from a collection, confirm collection counts update.

**Step 3: Commit** — `git commit -m "feat(web): favorites and collection membership on model detail page"`

---

## Task 14: Cleanup, full verification, checkpoint

**Files:**
- Delete: `web/src/components/Header.jsx`, `web/src/components/SearchBar.jsx`

**Step 1: Delete superseded components** — `Header.jsx` (replaced by sidebar brand + header bar) and `SearchBar.jsx` (replaced by sidebar search). The old `CreatorChip` died with the BrowsePage rewrite.

**Step 2: Verify nothing imports them:**

Run: `grep -rn "Header\|SearchBar" /Users/tbird/dev/3dprint/web/src --include="*.jsx"`
Expected: no imports of the deleted files (matches on the word "header" in markup are fine).

**Step 3: Full test suite** — in `/Users/tbird/dev/3dprint/api`: `npm test` → all tests pass (18 original + ~17 new).

**Step 4: Browser walkthrough** (use chrome-devtools MCP or manual): screenshot the library view and compare against `MANIFOLD App.html` opened side-by-side. Check: tokens (amber #e7b15a, near-black canvas), Space Grotesk titles, mono counts, bento proportions, card hover reveal, sidebar active states.

**Step 5: Production build check** — from `/Users/tbird/dev/3dprint/web`: `npx vite build` → no errors.

**Step 6: Commit + checkpoint:**

```bash
git add -A
git commit -m "feat: MANIFOLD redesign — sidebar shell, favorites, collections, featured bento"
```

Then update `.claude/work/current.md` (status + next actions: push, ARM64 rebuild, Pi deploy) per the session-checkpoint skill.
