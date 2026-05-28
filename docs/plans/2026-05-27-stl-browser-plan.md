# STL Browser Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a containerized web app that indexes 3D print model files from a NAS and provides a browsable, searchable gallery.

**Architecture:** Docker Compose with Node.js/Express API (SQLite + FTS5) and React/Vite/Tailwind frontend served by nginx. Fixed container paths `/data` (NAS, read-only) and `/config` (SQLite DB). Indexer parses `metadata.md` YAML frontmatter from `<creator>/<date-title>/` folders.

**Tech Stack:** Docker, Docker Compose, Node.js 22, Express, better-sqlite3, React 19, Vite, Tailwind CSS v4, React Router v7

---

### Task 1: Project scaffolding & Docker Compose

**Files:**
- Create: `api/package.json`
- Create: `api/Dockerfile`
- Create: `api/src/index.js`
- Create: `web/package.json`
- Create: `web/Dockerfile`
- Create: `web/nginx.conf`
- Create: `web/index.html`
- Create: `web/src/main.jsx`
- Create: `web/src/App.jsx`
- Create: `web/vite.config.js`
- Create: `web/tailwind.config.js`
- Create: `web/src/index.css`
- Create: `docker-compose.yml`
- Modify: `.gitignore`

**Step 1: Create API package.json**

```json
{
  "name": "stl-browser-api",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node src/index.js",
    "dev": "node --watch src/index.js",
    "test": "node --test src/**/*.test.js"
  },
  "dependencies": {
    "better-sqlite3": "^11.0.0",
    "cors": "^2.8.5",
    "express": "^5.1.0",
    "gray-matter": "^4.0.3"
  }
}
```

**Step 2: Create minimal API entry point**

```js
// api/src/index.js
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

const port = 3001;
app.listen(port, () => {
  console.log(`API listening on port ${port}`);
});
```

**Step 3: Create API Dockerfile**

```dockerfile
# api/Dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --production
COPY . .
EXPOSE 3001
CMD ["node", "src/index.js"]
```

**Step 4: Create React app with Vite + Tailwind**

`web/package.json`:
```json
{
  "name": "stl-browser-web",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "react-router-dom": "^7.0.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.0.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^4.0.0",
    "vite": "^6.0.0",
    "@tailwindcss/vite": "^4.0.0"
  }
}
```

`web/vite.config.js`:
```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001'
    }
  }
});
```

`web/src/index.css`:
```css
@import "tailwindcss";
```

`web/index.html`:
```html
<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>STL Browser</title>
</head>
<body class="bg-gray-950 text-gray-100 min-h-screen">
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>
```

`web/src/main.jsx`:
```jsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

`web/src/App.jsx`:
```jsx
export default function App() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold">STL Browser</h1>
      <p className="text-gray-400 mt-2">Loading...</p>
    </div>
  );
}
```

**Step 5: Create web Dockerfile and nginx.conf**

`web/nginx.conf`:
```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location /api {
        proxy_pass http://api:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

`web/Dockerfile`:
```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

**Step 6: Create docker-compose.yml**

```yaml
services:
  api:
    build: ./api
    ports:
      - "3001:3001"
    volumes:
      - ${DATA_PATH:-./test-data}:/data:ro
      - ./config:/config
    environment:
      - NODE_ENV=production

  web:
    build: ./web
    ports:
      - "3000:80"
    depends_on:
      - api
```

**Step 7: Update .gitignore**

Add to existing `.gitignore`:
```
node_modules/
config/
api/node_modules/
web/node_modules/
web/dist/
test-data/
```

**Step 8: Install dependencies and verify**

```bash
cd /Users/tbird/dev/3dprint/api
npm install
cd /Users/tbird/dev/3dprint/web
npm install
```

Run API:
```bash
cd /Users/tbird/dev/3dprint/api
node src/index.js
```
Expected: `API listening on port 3001`

Verify: `curl http://localhost:3001/api/health`
Expected: `{"status":"ok"}`

**Step 9: Commit**

```bash
git add api/ web/ docker-compose.yml .gitignore
git commit -m "feat: project scaffolding with Express API and React/Vite frontend"
```

---

### Task 2: Database schema & initialization

**Files:**
- Create: `api/src/db.js`
- Create: `api/src/db.test.js`

**Step 1: Write tests for database initialization**

```js
// api/src/db.test.js
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

  it('creates model_tags table', () => {
    const info = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='model_tags'").get();
    assert.equal(info.name, 'model_tags');
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
    const results = db.prepare("SELECT * FROM models_fts WHERE models_fts MATCH ?").all('test');
    assert.ok(results.length > 0);
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
cd /Users/tbird/dev/3dprint/api
node --test src/db.test.js
```
Expected: FAIL — `initDb` not found

**Step 3: Implement database module**

```js
// api/src/db.js
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

    CREATE TABLE IF NOT EXISTS model_tags (
      model_id INTEGER NOT NULL REFERENCES models(id) ON DELETE CASCADE,
      tag TEXT NOT NULL,
      UNIQUE(model_id, tag)
    );

    CREATE INDEX IF NOT EXISTS idx_model_tags_tag ON model_tags(tag);

    CREATE VIRTUAL TABLE IF NOT EXISTS models_fts USING fts5(
      title, creator, content, tags,
      content='models',
      content_rowid='id'
    );

    CREATE TRIGGER IF NOT EXISTS models_ai AFTER INSERT ON models BEGIN
      INSERT INTO models_fts(rowid, title, creator, content, tags)
      VALUES (new.id, new.title, new.creator, new.content, '');
    END;

    CREATE TRIGGER IF NOT EXISTS models_ad AFTER DELETE ON models BEGIN
      INSERT INTO models_fts(models_fts, rowid, title, creator, content, tags)
      VALUES ('delete', old.id, old.title, old.creator, old.content, '');
    END;

    CREATE TRIGGER IF NOT EXISTS models_au AFTER UPDATE ON models BEGIN
      INSERT INTO models_fts(models_fts, rowid, title, creator, content, tags)
      VALUES ('delete', old.id, old.title, old.creator, old.content, '');
      INSERT INTO models_fts(rowid, title, creator, content, tags)
      VALUES (new.id, new.title, new.creator, new.content, '');
    END;
  `);

  return db;
}
```

**Step 4: Run tests to verify they pass**

```bash
cd /Users/tbird/dev/3dprint/api
node --test src/db.test.js
```
Expected: All 6 tests PASS

**Step 5: Commit**

```bash
git add api/src/db.js api/src/db.test.js
git commit -m "feat: SQLite database schema with FTS5 full-text search"
```

---

### Task 3: Indexer

**Files:**
- Create: `api/src/indexer.js`
- Create: `api/src/indexer.test.js`

**Step 1: Create test fixtures**

Create a temporary directory structure mimicking the NAS layout for tests.

```js
// api/src/indexer.test.js
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

  it('stores tags', () => {
    const model = db.prepare('SELECT * FROM models WHERE title = ?').get('Cool Vase');
    const tags = db.prepare('SELECT tag FROM model_tags WHERE model_id = ? ORDER BY tag').all(model.id);
    assert.deepEqual(tags.map(t => t.tag), ['Membership Exclusive', 'Vase']);
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
});
```

**Step 2: Run tests to verify they fail**

```bash
cd /Users/tbird/dev/3dprint/api
node --test src/indexer.test.js
```
Expected: FAIL — `reindex` not found

**Step 3: Implement the indexer**

```js
// api/src/indexer.js
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import matter from 'gray-matter';

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);
const DATA_DIR = '/data';

export function reindex(db, dataDir = DATA_DIR) {
  const stats = { indexed: 0, errors: 0 };

  const upsertModel = db.prepare(`
    INSERT INTO models (folder_path, title, creator, date, patreon_url, post_id, content, files, preview_filename, indexed_at)
    VALUES (@folder_path, @title, @creator, @date, @patreon_url, @post_id, @content, @files, @preview_filename, @indexed_at)
    ON CONFLICT(folder_path) DO UPDATE SET
      title=@title, creator=@creator, date=@date, patreon_url=@patreon_url,
      post_id=@post_id, content=@content, files=@files, preview_filename=@preview_filename, indexed_at=@indexed_at
  `);

  const deleteTagsForModel = db.prepare('DELETE FROM model_tags WHERE model_id = ?');
  const insertTag = db.prepare('INSERT OR IGNORE INTO model_tags (model_id, tag) VALUES (?, ?)');
  const getModelId = db.prepare('SELECT id FROM models WHERE folder_path = ?');

  const creators = readdirSync(dataDir, { withFileTypes: true })
    .filter(d => d.isDirectory());

  for (const creatorDir of creators) {
    const creatorPath = join(dataDir, creatorDir.name);
    let modelDirs;
    try {
      modelDirs = readdirSync(creatorPath, { withFileTypes: true }).filter(d => d.isDirectory());
    } catch {
      continue;
    }

    for (const modelDir of modelDirs) {
      const modelPath = join(creatorPath, modelDir.name);
      const metadataPath = join(modelPath, 'metadata.md');

      try {
        const raw = readFileSync(metadataPath, 'utf-8');
        const { data: fm, content } = matter(raw);

        const allFiles = readdirSync(modelPath)
          .filter(f => f !== 'metadata.md' && statSync(join(modelPath, f)).isFile());

        const previewFile = allFiles.find(f => IMAGE_EXTENSIONS.has(extname(f).toLowerCase())) || null;

        const folderPath = `${creatorDir.name}/${modelDir.name}`;

        upsertModel.run({
          folder_path: folderPath,
          title: fm.title || modelDir.name,
          creator: fm.creator || creatorDir.name,
          date: fm.date ? String(fm.date).slice(0, 10) : null,
          patreon_url: fm.patreon_url || null,
          post_id: fm.post_id || null,
          content: content.trim(),
          files: JSON.stringify(allFiles),
          preview_filename: previewFile,
          indexed_at: new Date().toISOString(),
        });

        const modelRow = getModelId.get(folderPath);
        deleteTagsForModel.run(modelRow.id);
        const tags = Array.isArray(fm.tags) ? fm.tags : [];
        for (const tag of tags) {
          insertTag.run(modelRow.id, tag);
        }

        stats.indexed++;
      } catch (err) {
        console.error(`Error indexing ${modelDir.name}: ${err.message}`);
        stats.errors++;
      }
    }
  }

  return stats;
}
```

**Step 4: Run tests to verify they pass**

```bash
cd /Users/tbird/dev/3dprint/api
node --test src/indexer.test.js
```
Expected: All 6 tests PASS

**Step 5: Commit**

```bash
git add api/src/indexer.js api/src/indexer.test.js
git commit -m "feat: indexer scans data directory and populates SQLite with metadata"
```

---

### Task 4: API routes — models list, search, creators, tags

**Files:**
- Create: `api/src/routes.js`
- Create: `api/src/routes.test.js`
- Modify: `api/src/index.js`

**Step 1: Write tests for API routes**

```js
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

function request(app, path) {
  return new Promise((resolve) => {
    const server = app.listen(0, () => {
      const port = server.address().port;
      fetch(`http://localhost:${port}${path}`)
        .then(res => res.json().then(body => ({ status: res.status, body })))
        .then(result => { server.close(); resolve(result); })
        .catch(err => { server.close(); resolve({ status: 500, body: { error: err.message } }); });
    });
  });
}

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

  it('GET /api/models?tag=Tag2 filters by tag', async () => {
    const { body } = await request(app, '/api/models?tag=Tag2');
    assert.equal(body.total, 1);
    assert.equal(body.models[0].title, 'Beta Model');
  });

  it('GET /api/models?q=PLA searches with FTS', async () => {
    const { body } = await request(app, '/api/models?q=PLA');
    assert.equal(body.total, 1);
    assert.equal(body.models[0].title, 'Alpha Model');
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
    assert.ok(Array.isArray(body.tags));
    assert.ok(Array.isArray(body.files));
  });

  it('GET /api/creators returns unique creators', async () => {
    const { body } = await request(app, '/api/creators');
    assert.deepEqual(body.sort(), ['CreatorA', 'CreatorB']);
  });

  it('GET /api/tags returns unique tags', async () => {
    const { body } = await request(app, '/api/tags');
    assert.ok(body.includes('Tag1'));
    assert.ok(body.includes('Tag2'));
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
cd /Users/tbird/dev/3dprint/api
node --test src/routes.test.js
```
Expected: FAIL — `createRoutes` not found

**Step 3: Implement routes**

```js
// api/src/routes.js
import { Router } from 'express';
import { join } from 'node:path';
import { createReadStream, statSync } from 'node:fs';

const DATA_DIR = '/data';

export function createRoutes(db, dataDir = DATA_DIR) {
  const router = Router();

  router.get('/api/models', (req, res) => {
    const { q, creator, tag, page = 1, limit = 24, sort = 'date' } = req.query;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    const sortMap = {
      date: 'm.date DESC',
      title: 'm.title ASC',
      creator: 'm.creator ASC',
    };
    const orderBy = sortMap[sort] || sortMap.date;

    let where = [];
    let params = [];

    if (q) {
      const ids = db.prepare('SELECT rowid FROM models_fts WHERE models_fts MATCH ?').all(q);
      if (ids.length === 0) {
        return res.json({ models: [], total: 0, page: pageNum, limit: limitNum });
      }
      where.push(`m.id IN (${ids.map(() => '?').join(',')})`);
      params.push(...ids.map(r => r.rowid));
    }

    if (creator) {
      where.push('m.creator = ?');
      params.push(creator);
    }

    if (tag) {
      where.push('m.id IN (SELECT model_id FROM model_tags WHERE tag = ?)');
      params.push(tag);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const total = db.prepare(`SELECT COUNT(*) as n FROM models m ${whereClause}`).get(...params).n;

    const models = db.prepare(
      `SELECT m.id, m.folder_path, m.title, m.creator, m.date, m.preview_filename, m.files
       FROM models m ${whereClause}
       ORDER BY ${orderBy}
       LIMIT ? OFFSET ?`
    ).all(...params, limitNum, offset);

    const tagStmt = db.prepare('SELECT tag FROM model_tags WHERE model_id = ?');
    const result = models.map(m => ({
      ...m,
      files: JSON.parse(m.files),
      tags: tagStmt.all(m.id).map(t => t.tag),
    }));

    res.json({ models: result, total, page: pageNum, limit: limitNum });
  });

  router.get('/api/models/:id', (req, res) => {
    const model = db.prepare('SELECT * FROM models WHERE id = ?').get(req.params.id);
    if (!model) return res.status(404).json({ error: 'Not found' });

    const tags = db.prepare('SELECT tag FROM model_tags WHERE model_id = ?').all(model.id).map(t => t.tag);
    res.json({ ...model, files: JSON.parse(model.files), tags });
  });

  router.get('/api/models/:id/preview', (req, res) => {
    const model = db.prepare('SELECT folder_path, preview_filename FROM models WHERE id = ?').get(req.params.id);
    if (!model || !model.preview_filename) return res.status(404).json({ error: 'No preview' });

    const filePath = join(dataDir, model.folder_path, model.preview_filename);
    try {
      statSync(filePath);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      createReadStream(filePath).pipe(res);
    } catch {
      res.status(404).json({ error: 'Preview file not found' });
    }
  });

  router.get('/api/models/:id/files/:filename', (req, res) => {
    const model = db.prepare('SELECT folder_path, files FROM models WHERE id = ?').get(req.params.id);
    if (!model) return res.status(404).json({ error: 'Not found' });

    const files = JSON.parse(model.files);
    if (!files.includes(req.params.filename)) return res.status(404).json({ error: 'File not in model' });

    const filePath = join(dataDir, model.folder_path, req.params.filename);
    try {
      const stat = statSync(filePath);
      res.setHeader('Content-Disposition', `attachment; filename="${req.params.filename}"`);
      res.setHeader('Content-Length', stat.size);
      createReadStream(filePath).pipe(res);
    } catch {
      res.status(404).json({ error: 'File not found on disk' });
    }
  });

  router.get('/api/creators', (req, res) => {
    const rows = db.prepare('SELECT DISTINCT creator FROM models ORDER BY creator').all();
    res.json(rows.map(r => r.creator));
  });

  router.get('/api/tags', (req, res) => {
    const rows = db.prepare('SELECT DISTINCT tag FROM model_tags ORDER BY tag').all();
    res.json(rows.map(r => r.tag));
  });

  return router;
}
```

**Step 4: Wire routes into index.js**

```js
// api/src/index.js
import express from 'express';
import cors from 'cors';
import { initDb } from './db.js';
import { reindex } from './indexer.js';
import { createRoutes } from './routes.js';

const DATA_DIR = '/data';
const DB_PATH = '/config/stl-browser.db';

const app = express();
app.use(cors());
app.use(express.json());

const db = initDb(DB_PATH);

app.use(createRoutes(db, DATA_DIR));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/reindex', (req, res) => {
  const stats = reindex(db, DATA_DIR);
  res.json(stats);
});

const port = 3001;
app.listen(port, () => {
  console.log(`API listening on port ${port}`);
  console.log('Running initial index...');
  const stats = reindex(db, DATA_DIR);
  console.log(`Indexed ${stats.indexed} models (${stats.errors} errors)`);
});
```

**Step 5: Run tests to verify they pass**

```bash
cd /Users/tbird/dev/3dprint/api
node --test src/routes.test.js
```
Expected: All 9 tests PASS

**Step 6: Commit**

```bash
git add api/src/routes.js api/src/routes.test.js api/src/index.js
git commit -m "feat: API routes for models, search, preview, file download"
```

---

### Task 5: React frontend — browse view with card grid

**Files:**
- Create: `web/src/api.js`
- Create: `web/src/components/ModelCard.jsx`
- Create: `web/src/components/SearchBar.jsx`
- Create: `web/src/pages/BrowsePage.jsx`
- Modify: `web/src/App.jsx`

**Step 1: Create API helper**

```js
// web/src/api.js
const BASE = '/api';

export async function fetchModels(params = {}) {
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') query.set(k, v);
  }
  const res = await fetch(`${BASE}/models?${query}`);
  return res.json();
}

export async function fetchModel(id) {
  const res = await fetch(`${BASE}/models/${id}`);
  return res.json();
}

export async function fetchCreators() {
  const res = await fetch(`${BASE}/creators`);
  return res.json();
}

export async function fetchTags() {
  const res = await fetch(`${BASE}/tags`);
  return res.json();
}

export function previewUrl(id) {
  return `${BASE}/models/${id}/preview`;
}

export function fileUrl(id, filename) {
  return `${BASE}/models/${id}/files/${encodeURIComponent(filename)}`;
}

export async function triggerReindex() {
  const res = await fetch(`${BASE}/reindex`, { method: 'POST' });
  return res.json();
}
```

**Step 2: Create SearchBar component**

```jsx
// web/src/components/SearchBar.jsx
import { useState, useEffect } from 'react';
import { fetchCreators, fetchTags } from '../api';

export default function SearchBar({ filters, onChange }) {
  const [creators, setCreators] = useState([]);
  const [tags, setTags] = useState([]);

  useEffect(() => {
    fetchCreators().then(setCreators);
    fetchTags().then(setTags);
  }, []);

  return (
    <div className="flex flex-wrap gap-3 items-center mb-6">
      <input
        type="text"
        placeholder="Search models..."
        value={filters.q || ''}
        onChange={e => onChange({ ...filters, q: e.target.value, page: 1 })}
        className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500 flex-1 min-w-48"
      />
      <select
        value={filters.creator || ''}
        onChange={e => onChange({ ...filters, creator: e.target.value, page: 1 })}
        className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100"
      >
        <option value="">All Creators</option>
        {creators.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
      <select
        value={filters.tag || ''}
        onChange={e => onChange({ ...filters, tag: e.target.value, page: 1 })}
        className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-gray-100"
      >
        <option value="">All Tags</option>
        {tags.map(t => <option key={t} value={t}>{t}</option>)}
      </select>
    </div>
  );
}
```

**Step 3: Create ModelCard component**

```jsx
// web/src/components/ModelCard.jsx
import { previewUrl } from '../api';

export default function ModelCard({ model, onClick }) {
  return (
    <div
      onClick={() => onClick(model)}
      className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden cursor-pointer hover:border-gray-600 transition-colors"
    >
      <div className="aspect-square bg-gray-800 overflow-hidden">
        {model.preview_filename ? (
          <img
            src={previewUrl(model.id)}
            alt={model.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-600 text-sm">
            No preview
          </div>
        )}
      </div>
      <div className="p-3">
        <h3 className="font-semibold text-sm truncate">{model.title}</h3>
        <p className="text-xs text-gray-400 mt-1">{model.creator}</p>
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-gray-500">{model.date}</span>
          <span className="text-xs text-gray-500">
            {model.files.filter(f => f.endsWith('.stl')).length} STLs
          </span>
        </div>
        {model.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {model.tags.map(tag => (
              <span key={tag} className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 4: Create BrowsePage**

```jsx
// web/src/pages/BrowsePage.jsx
import { useState, useEffect, useCallback } from 'react';
import { fetchModels } from '../api';
import SearchBar from '../components/SearchBar';
import ModelCard from '../components/ModelCard';

export default function BrowsePage({ onSelectModel }) {
  const [filters, setFilters] = useState({ q: '', creator: '', tag: '', page: 1, limit: 24 });
  const [data, setData] = useState({ models: [], total: 0 });
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetchModels(filters).then(d => {
      setData(d);
      setLoading(false);
    });
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.ceil(data.total / (filters.limit || 24));

  return (
    <div>
      <SearchBar filters={filters} onChange={setFilters} />

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-400">{data.total} models</p>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {data.models.map(model => (
              <ModelCard key={model.id} model={model} onClick={onSelectModel} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-8">
              <button
                disabled={filters.page <= 1}
                onClick={() => setFilters(f => ({ ...f, page: f.page - 1 }))}
                className="px-4 py-2 bg-gray-800 rounded-lg disabled:opacity-30 hover:bg-gray-700"
              >
                Previous
              </button>
              <span className="px-4 py-2 text-gray-400">
                Page {filters.page} of {totalPages}
              </span>
              <button
                disabled={filters.page >= totalPages}
                onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))}
                className="px-4 py-2 bg-gray-800 rounded-lg disabled:opacity-30 hover:bg-gray-700"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

**Step 5: Update App.jsx**

```jsx
// web/src/App.jsx
import { useState } from 'react';
import BrowsePage from './pages/BrowsePage';

export default function App() {
  const [selectedModel, setSelectedModel] = useState(null);

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">STL Browser</h1>
      </header>
      <BrowsePage onSelectModel={setSelectedModel} />
    </div>
  );
}
```

**Step 6: Verify frontend builds**

```bash
cd /Users/tbird/dev/3dprint/web
npx vite build
```
Expected: Build succeeds with no errors

**Step 7: Commit**

```bash
git add web/src/
git commit -m "feat: browse page with card grid, search, creator and tag filters"
```

---

### Task 6: React frontend — detail view

**Files:**
- Create: `web/src/components/ModelDetail.jsx`
- Modify: `web/src/App.jsx`

**Step 1: Create ModelDetail component**

```jsx
// web/src/components/ModelDetail.jsx
import { useState, useEffect } from 'react';
import { fetchModel, previewUrl, fileUrl } from '../api';

const EXT_COLORS = {
  '.stl': 'bg-blue-900 text-blue-300',
  '.3mf': 'bg-purple-900 text-purple-300',
  '.step': 'bg-green-900 text-green-300',
  '.stp': 'bg-green-900 text-green-300',
  '.obj': 'bg-yellow-900 text-yellow-300',
  '.gcode': 'bg-red-900 text-red-300',
};

function extBadge(filename) {
  const ext = '.' + filename.split('.').pop().toLowerCase();
  const color = EXT_COLORS[ext] || 'bg-gray-700 text-gray-300';
  return <span className={`text-xs px-1.5 py-0.5 rounded ${color}`}>{ext}</span>;
}

export default function ModelDetail({ modelId, onClose }) {
  const [model, setModel] = useState(null);

  useEffect(() => {
    fetchModel(modelId).then(setModel);
  }, [modelId]);

  if (!model) return <div className="text-gray-500">Loading...</div>;

  const imageExts = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);
  const downloadFiles = model.files.filter(f => !imageExts.has('.' + f.split('.').pop().toLowerCase()));

  return (
    <div className="fixed inset-0 bg-black/80 z-50 overflow-y-auto">
      <div className="max-w-4xl mx-auto my-8 bg-gray-900 rounded-xl border border-gray-700">
        <div className="flex justify-between items-center p-4 border-b border-gray-800">
          <h2 className="text-xl font-bold">{model.title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none">&times;</button>
        </div>

        <div className="p-4 grid md:grid-cols-2 gap-6">
          <div>
            {model.preview_filename && (
              <img
                src={previewUrl(model.id)}
                alt={model.title}
                className="w-full rounded-lg"
              />
            )}
            <div className="mt-4 flex flex-wrap gap-2 text-sm text-gray-400">
              <span>{model.creator}</span>
              <span>&middot;</span>
              <span>{model.date}</span>
              {model.patreon_url && (
                <>
                  <span>&middot;</span>
                  <a href={model.patreon_url} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">
                    Patreon
                  </a>
                </>
              )}
            </div>
            {model.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-3">
                {model.tags.map(tag => (
                  <span key={tag} className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">{tag}</span>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="prose prose-invert prose-sm max-h-48 overflow-y-auto mb-4 text-gray-300 whitespace-pre-wrap">
              {model.content}
            </div>

            <h3 className="text-sm font-semibold text-gray-400 mb-2">
              Files ({downloadFiles.length})
            </h3>
            <div className="space-y-1 max-h-80 overflow-y-auto">
              {downloadFiles.map(file => (
                <div key={file} className="flex items-center justify-between bg-gray-800 rounded px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {extBadge(file)}
                    <span className="text-sm truncate">{file}</span>
                  </div>
                  <a
                    href={fileUrl(model.id, file)}
                    className="text-blue-400 hover:text-blue-300 text-sm shrink-0 ml-2"
                  >
                    Download
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Update App.jsx to wire in the detail modal**

```jsx
// web/src/App.jsx
import { useState } from 'react';
import BrowsePage from './pages/BrowsePage';
import ModelDetail from './components/ModelDetail';

export default function App() {
  const [selectedModel, setSelectedModel] = useState(null);

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">STL Browser</h1>
      </header>
      <BrowsePage onSelectModel={m => setSelectedModel(m)} />
      {selectedModel && (
        <ModelDetail modelId={selectedModel.id} onClose={() => setSelectedModel(null)} />
      )}
    </div>
  );
}
```

**Step 3: Verify frontend builds**

```bash
cd /Users/tbird/dev/3dprint/web
npx vite build
```
Expected: Build succeeds

**Step 4: Commit**

```bash
git add web/src/
git commit -m "feat: model detail modal with file list and download links"
```

---

### Task 7: Integration test & Docker build

**Files:**
- Create: `test-data/` — small fixture for local dev
- Modify: `docker-compose.yml` — add dev profile
- Modify: `api/src/index.js` — handle missing /data gracefully for local dev

**Step 1: Create test fixture data**

```bash
mkdir -p test-data/TestCreator/2025-06-01-sample-model
```

Write `test-data/TestCreator/2025-06-01-sample-model/metadata.md`:
```markdown
---
title: Sample Model
creator: TestCreator
date: 2025-06-01
patreon_url: "https://example.com"
post_id: 99999
tags: ["Test"]
---

# Sample Model

A sample model for development testing.

## Files
- cube.stl
```

Create a dummy STL file:
```bash
echo "dummy stl" > test-data/TestCreator/2025-06-01-sample-model/cube.stl
```

**Step 2: Update api/src/index.js for local dev**

Update the hardcoded paths to support local dev via environment variables as fallback:

```js
// api/src/index.js
import express from 'express';
import cors from 'cors';
import { existsSync, mkdirSync } from 'node:fs';
import { initDb } from './db.js';
import { reindex } from './indexer.js';
import { createRoutes } from './routes.js';

const DATA_DIR = process.env.DATA_DIR || '/data';
const DB_PATH = process.env.DB_PATH || '/config/stl-browser.db';

const dbDir = DB_PATH.substring(0, DB_PATH.lastIndexOf('/'));
if (dbDir && !existsSync(dbDir)) mkdirSync(dbDir, { recursive: true });

const app = express();
app.use(cors());
app.use(express.json());

const db = initDb(DB_PATH);

app.use(createRoutes(db, DATA_DIR));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/reindex', (req, res) => {
  const stats = reindex(db, DATA_DIR);
  res.json(stats);
});

const port = 3001;
app.listen(port, () => {
  console.log(`API listening on port ${port}`);
  console.log(`Data directory: ${DATA_DIR}`);
  console.log(`Database: ${DB_PATH}`);
  if (existsSync(DATA_DIR)) {
    console.log('Running initial index...');
    const stats = reindex(db, DATA_DIR);
    console.log(`Indexed ${stats.indexed} models (${stats.errors} errors)`);
  } else {
    console.log('Data directory not found — skipping initial index');
  }
});
```

**Step 3: Run all API tests**

```bash
cd /Users/tbird/dev/3dprint/api
node --test src/db.test.js src/indexer.test.js src/routes.test.js
```
Expected: All tests PASS

**Step 4: Test local dev workflow**

Terminal 1 — start API pointing at test data:
```bash
cd /Users/tbird/dev/3dprint/api
DATA_DIR=../test-data DB_PATH=../config/stl-browser.db node src/index.js
```
Expected: `Indexed 1 models (0 errors)`

Terminal 2 — start frontend:
```bash
cd /Users/tbird/dev/3dprint/web
npx vite
```
Expected: Vite dev server starts, open browser at http://localhost:5173, see the sample model card

**Step 5: Test Docker Compose build**

```bash
cd /Users/tbird/dev/3dprint
docker compose build
```
Expected: Both images build successfully

**Step 6: Commit**

```bash
git add test-data/ docker-compose.yml api/src/index.js
git commit -m "feat: integration test fixtures and Docker build"
```

---

## Summary

| Task | What it builds |
|------|---------------|
| 1 | Project scaffolding — Express API, React/Vite/Tailwind, Docker Compose |
| 2 | SQLite schema with FTS5 full-text search |
| 3 | Indexer — walks NAS folders, parses metadata.md, populates DB |
| 4 | API routes — list/search/filter models, preview, file download |
| 5 | React browse page — card grid, search bar, filters, pagination |
| 6 | React detail modal — preview, metadata, file downloads |
| 7 | Integration test fixtures, Docker build |
