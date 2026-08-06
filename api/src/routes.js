import { Router } from 'express';
import { createReadStream, readdirSync, statSync, mkdirSync, copyFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, extname, basename } from 'node:path';
import { tmpdir } from 'node:os';
import multer from 'multer';
import { indexModelFolder } from './indexer.js';
import { slugify, uniqueDirName, MODEL_FILE_EXTS, IMAGE_FILE_EXTS } from './addModel.js';
import { scrapeUrl } from './importers/index.js';

const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// "Missing files" = the folder has no printable/model file of ANY kind. This used to test
// only for '.stl', which flagged every 3MF-only or STEP-only model as incomplete — 35 of 43
// flagged models were false positives once the library stopped being STL-only. Archives
// count as present: they're stored opaque (never extracted server-side), so a zip-only
// model does have its files. Still a substring heuristic — the `files` column is a JSON
// array of names, so an odd name like "notes.zip.txt" can read as an archive.
const MODEL_FILE_EXTS_SQL = ['.stl', '.3mf', '.obj', '.step', '.stp', '.zip', '.rar', '.7z', '.gcode'];

// SQL predicate: true when the model HAS at least one model file. Extensions are a
// hardcoded literal list (no user input), so inlining them is injection-safe.
const hasModelFileSql = (col) => MODEL_FILE_EXTS_SQL.map((ext) => `lower(${col}) LIKE '%${ext}%'`).join(' OR ');

// Download a remote image into destDir, validating it's actually an image.
// Returns the saved filename. Throws on non-2xx, non-image, or network error.
async function downloadImage(url, destDir, index) {
  const resp = await fetch(url, { headers: { 'User-Agent': BROWSER_UA }, redirect: 'follow' });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const ct = resp.headers.get('content-type') || '';
  let name = '';
  try { name = decodeURIComponent(basename(new URL(url).pathname)); } catch { name = basename(url); }
  const hasImgExt = /\.(jpe?g|png|gif|webp)$/i.test(name);
  // Trust a known image extension even when the content-type isn't image/* — some
  // hosts (e.g. the Google Cloud Storage bucket backing Thangs) serve images as
  // application/octet-stream. Only reject when NEITHER the type nor the URL says image.
  if (!ct.startsWith('image/') && !hasImgExt) {
    throw new Error(`not an image (${ct || 'unknown type'})`);
  }
  const buf = Buffer.from(await resp.arrayBuffer());
  if (!hasImgExt) {
    // Reached only when ct is image/* (else we'd have thrown), so sub is a real subtype.
    const sub = (ct.split('/')[1] || 'jpg').split(';')[0].replace('jpeg', 'jpg');
    name = `image-${index}.${sub}`;
  }
  writeFileSync(join(destDir, name), buf);
  return name;
}

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
    let joins = '';
    const joinParams = [];
    if (sort === 'random') {
      // Weighted, creator-balanced shuffle (Efraimidis–Spirakis sampling, log form).
      // u = deterministic pseudo-random in (0,1] per (model, seed):
      //   u = (((id*a + b) % p) + 1) / (p + 1)
      // key = ln(u) * creator_count / user_weight, ordered DESC.
      // Dividing by creator_count gives every creator ~equal airtime regardless of
      // library share; the per-user weight multiplies that share (1 = default,
      // 0 clamps to 0.02 so "hidden" creators sink to the end instead of vanishing).
      const a = 1103515245;
      const b = ((seed % 32749) || 1) * 12345;
      const p = 2147483647;
      const user = userId(req);
      joins = `
        JOIN (SELECT creator, COUNT(*) n FROM models GROUP BY creator) cc ON cc.creator = m.creator
        LEFT JOIN user_creator_weights ucw ON ucw.creator = m.creator AND ucw.user_id = ?
      `;
      joinParams.push(user || '');
      orderBy = `(ln((((m.id * ${a} + ${b}) % ${p}) + 1.0) / ${p + 1}.0) * cc.n / MAX(COALESCE(ucw.weight, 1), 0.02)) DESC`;
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
      const user = userId(req);
      if (!user) return res.json({ models: [], total: 0, page, limit });
      conditions.push('m.id IN (SELECT model_id FROM favorites WHERE user_id = ?)');
      params.push(user);
    }
    if (req.query.missing === '1') {
      conditions.push(`NOT (${hasModelFileSql('m.files')})`);
    }
    if (req.query.recent === '1') {
      // "Recently added" = added to the library recently (added_at), not recently
      // published (date) — a scraped model with an old publish date still counts.
      conditions.push("m.added_at >= date('now','-30 day')");
    }
    const collectionId = parseInt(req.query.collection, 10);
    if (!isNaN(collectionId)) {
      const user = userId(req);
      if (!user) return res.json({ models: [], total: 0, page, limit });
      conditions.push(`m.id IN (
        SELECT cm.model_id FROM collection_models cm
        JOIN collections c ON c.id = cm.collection_id
        WHERE cm.collection_id = ? AND c.owner = ?
      )`);
      params.push(collectionId, user);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRow = db.prepare(
      `SELECT COUNT(*) as total FROM models m ${whereClause}`
    ).get(...params);
    const total = countRow.total;

    const models = db.prepare(
      `SELECT m.* FROM models m ${joins} ${whereClause} ORDER BY ${orderBy} LIMIT ? OFFSET ?`
    ).all(...joinParams, ...params, limit, offset);

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

    const files = JSON.parse(model.files);
    const fileDetails = files.map(name => {
      try {
        const { size } = statSync(join(dataDir, model.folder_path, name));
        return { name, size };
      } catch {
        return { name, size: null };
      }
    });

    res.json({
      ...model,
      files,
      fileDetails,
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

  // ── Identity (proxy-auth headers from TinyAuth/Authelia/etc.) ──
  // Writes require an identity; anonymous reads return empty user-scoped data.
  // DEFAULT_USER enables single-user mode for deployments without an auth proxy:
  // headerless requests act as that user instead of being anonymous.
  function userId(req) {
    return req.headers['remote-user'] || req.headers['remote-email'] || process.env.DEFAULT_USER || null;
  }

  // ── Add Model (owner-only writes to the NAS) ──
  const uploadTmp = join(tmpdir(), 'curio-uploads');
  mkdirSync(uploadTmp, { recursive: true });
  const maxUploadMb = Number(process.env.MAX_UPLOAD_MB) || 2048;
  const upload = multer({
    dest: uploadTmp,
    limits: { fileSize: maxUploadMb * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const allowed = file.fieldname === 'images' ? IMAGE_FILE_EXTS : MODEL_FILE_EXTS;
      if (allowed.has(extname(file.originalname).toLowerCase())) return cb(null, true);
      cb(new Error(`file type not allowed: ${file.originalname}`));
    },
  });

  // Run the multipart parse, mapping multer rejections to JSON errors and
  // sweeping any temp files multer saved before the rejection hit.
  const uploadFields = upload.fields([{ name: 'modelFiles' }, { name: 'images' }]);
  const parseUpload = (req, res, next) => {
    uploadFields(req, res, (err) => {
      if (!err) return next();
      for (const list of Object.values(req.files || {})) {
        for (const f of list) { try { rmSync(f.path, { force: true }); } catch { /* ignore */ } }
      }
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: `file too large (max ${maxUploadMb} MB)` });
      }
      res.status(400).json({ error: err.message });
    });
  };

  // Scrape candidate image URLs from a page (returns URLs only — downloads nothing).
  router.post('/api/scrape-images', async (req, res) => {
    const user = userId(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    const url = (req.body?.url || '').trim();
    if (!url) return res.status(400).json({ error: 'url is required' });
    try {
      res.json(await scrapeUrl(url));
    } catch (err) {
      res.status(502).json({ error: err.message });
    }
  });

  // Create a single model: write files + metadata.md into a new NAS folder, then index it.
  router.post('/api/models', parseUpload, async (req, res) => {
    const modelFiles = req.files?.modelFiles || [];
    const imageUploads = req.files?.images || [];
    const tempPaths = [...modelFiles, ...imageUploads].map((f) => f.path);
    const cleanupTemp = () => { for (const p of tempPaths) { try { rmSync(p, { force: true }); } catch { /* ignore */ } } };

    const user = userId(req);
    if (!user) { cleanupTemp(); return res.status(401).json({ error: 'Authentication required' }); }

    const title = (req.body.title || '').trim();
    const creator = (req.body.creator || '').trim();
    if (!title || !creator) { cleanupTemp(); return res.status(400).json({ error: 'title and creator are required' }); }
    if (modelFiles.length === 0) { cleanupTemp(); return res.status(400).json({ error: 'at least one model file is required' }); }

    const creatorFolder = (req.body.creatorFolder || '').trim() || slugify(creator);
    const creatorDir = join(dataDir, creatorFolder);
    const modelSlug = uniqueDirName(creatorDir, slugify(title));
    const folderPath = `${creatorFolder}/${modelSlug}`;
    const modelDir = join(creatorDir, modelSlug);

    let imageUrls = [];
    try { imageUrls = JSON.parse(req.body.imageUrls || '[]'); } catch { imageUrls = []; }

    const imagesFailed = [];
    try {
      mkdirSync(modelDir, { recursive: true });
      // Move uploaded files in (copy + remove temp — temp and NAS are different filesystems).
      for (const f of [...modelFiles, ...imageUploads]) {
        copyFileSync(f.path, join(modelDir, basename(f.originalname)));
        rmSync(f.path, { force: true });
      }
      // Download the selected scraped images; skip and report failures.
      // Track url→saved filename so a scraped image can be chosen as the preview.
      const scrapedNames = new Map();
      let i = 0;
      for (const url of imageUrls) {
        try { scrapedNames.set(url, await downloadImage(url, modelDir, i++)); }
        catch (err) { imagesFailed.push({ url, error: err.message }); }
      }

      // Resolve the chosen preview ("upload:<filename>" or "url:<scraped url>") to a real filename.
      const preview = (req.body.preview || '').trim();
      let previewName = null;
      if (preview.startsWith('upload:')) previewName = basename(preview.slice(7));
      else if (preview.startsWith('url:')) previewName = scrapedNames.get(preview.slice(4)) || null;

      // metadata.md (reuse patreon_url column for the source link)
      const date = (req.body.date || '').trim() || new Date().toISOString().slice(0, 10);
      const sourceUrl = (req.body.sourceUrl || '').trim();
      const description = (req.body.description || '').trim();
      const fm = ['---', `title: ${JSON.stringify(title)}`, `creator: ${JSON.stringify(creator)}`, `date: ${date}`];
      if (sourceUrl) fm.push(`patreon_url: ${JSON.stringify(sourceUrl)}`);
      if (previewName) fm.push(`preview: ${JSON.stringify(previewName)}`);
      fm.push('---', '', description, '');
      writeFileSync(join(modelDir, 'metadata.md'), fm.join('\n'));

      const id = indexModelFolder(db, dataDir, folderPath);
      res.status(201).json({ id, folder_path: folderPath, imagesFailed });
    } catch (err) {
      cleanupTemp();
      try { rmSync(modelDir, { recursive: true, force: true }); } catch { /* ignore */ }
      res.status(500).json({ error: err.message });
    }
  });

  // ── Favorites (per-user) ──
  const listFavorites = db.prepare('SELECT model_id FROM favorites WHERE user_id = ? ORDER BY created_at DESC');
  const insertFavorite = db.prepare('INSERT OR IGNORE INTO favorites (user_id, model_id, created_at) VALUES (?, ?, ?)');
  const deleteFavorite = db.prepare('DELETE FROM favorites WHERE user_id = ? AND model_id = ?');

  router.get('/api/favorites', (req, res) => {
    const user = userId(req);
    if (!user) return res.json({ ids: [] });
    res.json({ ids: listFavorites.all(user).map(r => r.model_id) });
  });

  router.put('/api/favorites/:id', (req, res) => {
    const user = userId(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    if (!getModelById.get(id)) return res.status(404).json({ error: 'Model not found' });
    insertFavorite.run(user, id, new Date().toISOString());
    res.json({ favorited: true });
  });

  router.delete('/api/favorites/:id', (req, res) => {
    const user = userId(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    deleteFavorite.run(user, id);
    res.json({ favorited: false });
  });

  // ── Collections (per-user) ──
  const listCollections = db.prepare(`
    SELECT c.id, c.name, c.hue, COUNT(cm.model_id) AS count
    FROM collections c
    LEFT JOIN collection_models cm ON cm.collection_id = c.id
    WHERE c.owner = ?
    GROUP BY c.id ORDER BY c.created_at
  `);
  const insertCollection = db.prepare('INSERT INTO collections (owner, name, hue, created_at) VALUES (?, ?, ?, ?)');
  const getOwnedCollection = db.prepare('SELECT * FROM collections WHERE id = ? AND owner = ?');
  const deleteOwnedCollection = db.prepare('DELETE FROM collections WHERE id = ? AND owner = ?');
  const insertCollectionModel = db.prepare(
    'INSERT OR IGNORE INTO collection_models (collection_id, model_id, added_at) VALUES (?, ?, ?)'
  );
  const deleteCollectionModel = db.prepare(
    'DELETE FROM collection_models WHERE collection_id = ? AND model_id = ?'
  );
  const listCollectionsForModel = db.prepare(`
    SELECT cm.collection_id FROM collection_models cm
    JOIN collections c ON c.id = cm.collection_id
    WHERE cm.model_id = ? AND c.owner = ?
  `);

  router.get('/api/collections', (req, res) => {
    const user = userId(req);
    if (!user) return res.json([]);
    res.json(listCollections.all(user));
  });

  router.post('/api/collections', (req, res) => {
    const user = userId(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    const name = (req.body?.name || '').trim();
    if (!name) return res.status(400).json({ error: 'name required' });
    const hue = Number.isInteger(req.body?.hue) ? ((req.body.hue % 360) + 360) % 360 : 28;
    const { lastInsertRowid } = insertCollection.run(user, name, hue, new Date().toISOString());
    res.json({ id: lastInsertRowid, name, hue, count: 0 });
  });

  router.delete('/api/collections/:id', (req, res) => {
    const user = userId(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    deleteOwnedCollection.run(id, user);
    res.json({ deleted: true });
  });

  router.put('/api/collections/:id/models/:modelId', (req, res) => {
    const user = userId(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    const id = parseInt(req.params.id, 10);
    const modelId = parseInt(req.params.modelId, 10);
    if (isNaN(id) || isNaN(modelId)) return res.status(400).json({ error: 'Invalid id' });
    if (!getOwnedCollection.get(id, user)) return res.status(404).json({ error: 'Collection not found' });
    if (!getModelById.get(modelId)) return res.status(404).json({ error: 'Model not found' });
    insertCollectionModel.run(id, modelId, new Date().toISOString());
    res.json({ added: true });
  });

  router.delete('/api/collections/:id/models/:modelId', (req, res) => {
    const user = userId(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    const id = parseInt(req.params.id, 10);
    const modelId = parseInt(req.params.modelId, 10);
    if (isNaN(id) || isNaN(modelId)) return res.status(400).json({ error: 'Invalid id' });
    if (!getOwnedCollection.get(id, user)) return res.status(404).json({ error: 'Collection not found' });
    deleteCollectionModel.run(id, modelId);
    res.json({ added: false });
  });

  // ── Creator weights (per-user, drives Featured/Shuffle balance) ──
  const listWeights = db.prepare('SELECT creator, weight FROM user_creator_weights WHERE user_id = ?');
  const upsertWeight = db.prepare(`
    INSERT INTO user_creator_weights (user_id, creator, weight) VALUES (?, ?, ?)
    ON CONFLICT (user_id, creator) DO UPDATE SET weight = excluded.weight
  `);
  const deleteWeight = db.prepare('DELETE FROM user_creator_weights WHERE user_id = ? AND creator = ?');

  router.get('/api/settings/weights', (req, res) => {
    const user = userId(req);
    if (!user) return res.json({ weights: {} });
    const weights = Object.fromEntries(listWeights.all(user).map(r => [r.creator, r.weight]));
    res.json({ weights });
  });

  router.put('/api/settings/weights', (req, res) => {
    const user = userId(req);
    if (!user) return res.status(401).json({ error: 'Authentication required' });
    const creator = (req.body?.creator || '').trim();
    const weight = req.body?.weight;
    if (!creator || typeof weight !== 'number' || !isFinite(weight) || weight < 0 || weight > 10) {
      return res.status(400).json({ error: 'creator and weight (0–10) required' });
    }
    if (weight === 1) {
      deleteWeight.run(user, creator); // 1 is the default — no row needed
    } else {
      upsertWeight.run(user, creator, weight);
    }
    res.json({ creator, weight });
  });

  // ── Sidebar nav counts ──
  const countAll = db.prepare('SELECT COUNT(*) n FROM models');
  const countRecent = db.prepare("SELECT COUNT(*) n FROM models WHERE added_at >= date('now','-30 day')");
  const countFavorites = db.prepare('SELECT COUNT(*) n FROM favorites WHERE user_id = ?');
  const countMissing = db.prepare(`SELECT COUNT(*) n FROM models WHERE NOT (${hasModelFileSql('files')})`);

  router.get('/api/counts', (req, res) => {
    const user = userId(req);
    res.json({
      all: countAll.get().n,
      recent: countRecent.get().n,
      favorites: user ? countFavorites.get(user).n : 0,
      missing: countMissing.get().n,
    });
  });

  // Which of the requesting user's collections contain this model (for the detail page)
  router.get('/api/models/:id/collections', (req, res) => {
    const user = userId(req);
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
    if (!user) return res.json({ ids: [] });
    res.json({ ids: listCollectionsForModel.all(id, user).map(r => r.collection_id) });
  });

  return router;
}
