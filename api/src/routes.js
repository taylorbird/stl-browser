import { Router } from 'express';
import { createReadStream, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

export function createRoutes(db, dataDir) {
  const router = Router();

  // Prepared statements
  const getModelById = db.prepare(`
    SELECT * FROM models WHERE id = ?
  `);

  const getAllCreators = db.prepare(`
    SELECT creator, substr(folder_path, 1, instr(folder_path, '/') - 1) as folder, COUNT(*) as count
    FROM models GROUP BY creator, folder ORDER BY creator
  `);

  router.get('/api/me', (req, res) => {
    const email = req.headers['remote-email'] || null;
    const name = req.headers['remote-name'] || null;
    const user = req.headers['remote-user'] || null;
    res.json({ email, name, user });
  });

  const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

  function findLogo(creatorFolder) {
    const dir = join(dataDir, creatorFolder);
    try {
      const files = readdirSync(dir);
      return files.find(f => f.startsWith('logo') && IMAGE_EXTS.has(extname(f).toLowerCase())) || null;
    } catch {
      return null;
    }
  }

  const ftsSearch = db.prepare(`
    SELECT rowid FROM models_fts WHERE models_fts MATCH ?
  `);

  // Turn raw user input into a safe prefix-matching FTS5 query:
  // each token is quoted (neutralizing operators/quotes) and starred for prefix match.
  function ftsQuery(q) {
    const tokens = q.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return null;
    return tokens.map(t => `"${t.replace(/"/g, '""')}"*`).join(' ');
  }

  // GET /api/models — List/search models with pagination
  router.get('/api/models', (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 24));
    const offset = (page - 1) * limit;
    const creator = req.query.creator || null;
    const q = req.query.q || null;
    const sort = req.query.sort || 'random';
    const seed = parseInt(req.query.seed, 10) || 0;

    let orderBy;
    if (sort === 'random') {
      // Stable seeded shuffle using substr of hex(randomblob()) seeded via id+seed
      // We use a deterministic hash: (id*A + seed*B) mod P, with small-enough constants
      const a = 1103515245;
      const b = ((seed % 32749) || 1) * 12345;
      const p = 2147483647;
      orderBy = `((m.id * ${a} + ${b}) % ${p})`;
    } else {
      const sortClauses = {
        date: 'date DESC',
        title: 'title ASC',
        creator: 'creator ASC',
      };
      orderBy = sortClauses[sort] || sortClauses.date;
    }

    const conditions = [];
    const params = [];

    const fts = q ? ftsQuery(q) : null;
    if (fts) {
      const ftsResults = ftsSearch.all(fts);
      const rowids = ftsResults.map(r => r.rowid);
      if (rowids.length === 0) {
        return res.json({ models: [], total: 0, page, limit });
      }
      conditions.push(`m.id IN (${rowids.map(() => '?').join(',')})`);
      params.push(...rowids);
    }

    if (creator) {
      conditions.push('m.creator = ?');
      params.push(creator);
    }

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

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRow = db.prepare(
      `SELECT COUNT(*) as total FROM models m ${whereClause}`
    ).get(...params);
    const total = countRow.total;

    const models = db.prepare(
      `SELECT m.* FROM models m ${whereClause} ORDER BY ${orderBy} LIMIT ? OFFSET ?`
    ).all(...params, limit, offset);

    const result = models.map(model => ({
      id: model.id,
      folder_path: model.folder_path,
      title: model.title,
      creator: model.creator,
      date: model.date,
      preview_filename: model.preview_filename,
      files: JSON.parse(model.files),
    }));

    res.json({ models: result, total, page, limit });
  });

  // GET /api/models/:id — Single model detail
  router.get('/api/models/:id', (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

    const model = getModelById.get(id);
    if (!model) return res.status(404).json({ error: 'Model not found' });

    res.json({
      ...model,
      files: JSON.parse(model.files),
    });
  });

  // GET /api/models/:id/preview — Stream preview image
  router.get('/api/models/:id/preview', (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

    const model = getModelById.get(id);
    if (!model || !model.preview_filename) {
      return res.status(404).json({ error: 'No preview available' });
    }

    const filePath = join(dataDir, model.folder_path, model.preview_filename);
    try {
      const stat = statSync(filePath);
      res.set('Cache-Control', 'public, max-age=86400');
      res.set('Content-Length', stat.size);
      createReadStream(filePath).pipe(res);
    } catch {
      res.status(404).json({ error: 'Preview file not found' });
    }
  });

  // GET /api/models/:id/files/:filename — Stream file download
  router.get('/api/models/:id/files/:filename', (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

    const model = getModelById.get(id);
    if (!model) return res.status(404).json({ error: 'Model not found' });

    const filename = req.params.filename;
    const files = JSON.parse(model.files);

    // Security: verify filename is in the model's files list (prevents path traversal)
    if (!files.includes(filename)) {
      return res.status(404).json({ error: 'File not found' });
    }

    const filePath = join(dataDir, model.folder_path, filename);
    try {
      const stat = statSync(filePath);
      res.set('Content-Disposition', `attachment; filename="${filename}"`);
      res.set('Content-Length', stat.size);
      createReadStream(filePath).pipe(res);
    } catch {
      res.status(404).json({ error: 'File not found on disk' });
    }
  });

  // GET /api/creators — List all unique creators with logo info
  router.get('/api/creators', (req, res) => {
    const rows = getAllCreators.all();
    const creators = rows.map(r => ({
      name: r.creator,
      folder: r.folder,
      count: r.count,
      hasLogo: !!findLogo(r.folder),
    }));
    res.json(creators);
  });

  // GET /api/creators/:folder/logo — Serve creator logo image
  router.get('/api/creators/:folder/logo', (req, res) => {
    const folder = req.params.folder;
    if (folder.includes('..') || folder.includes('/')) {
      return res.status(400).json({ error: 'Invalid folder' });
    }
    const logo = findLogo(folder);
    if (!logo) return res.status(404).json({ error: 'No logo found' });

    const filePath = join(dataDir, folder, logo);
    try {
      const stat = statSync(filePath);
      res.set('Cache-Control', 'public, max-age=86400');
      res.set('Content-Length', stat.size);
      createReadStream(filePath).pipe(res);
    } catch {
      res.status(404).json({ error: 'Logo file not found' });
    }
  });

  // POST /api/models/delete — Batch delete models by ID
  const deleteModel = db.prepare('DELETE FROM models WHERE id = ?');
  const getFtsForDelete = db.prepare('SELECT title, creator, content FROM models_fts WHERE rowid = ?');
  const deleteFts = db.prepare(
    "INSERT INTO models_fts(models_fts, rowid, title, creator, content) VALUES ('delete', ?, ?, ?, ?)"
  );

  const batchDelete = db.transaction((ids) => {
    let deleted = 0;
    for (const id of ids) {
      const fts = getFtsForDelete.get(id);
      if (fts) {
        deleteFts.run(id, fts.title, fts.creator, fts.content);
      }
      const result = deleteModel.run(id);
      deleted += result.changes;
    }
    return deleted;
  });

  router.post('/api/models/delete', (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ids array required' });
    }
    const deleted = batchDelete(ids);
    res.json({ deleted });
  });

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

  // ── Sidebar nav counts ──
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

  // Which collections contain this model (for the detail page)
  router.get('/api/models/:id/collections', (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    res.json({ ids: listCollectionsForModel.all(id).map(r => r.collection_id) });
  });

  return router;
}
