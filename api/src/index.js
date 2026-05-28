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
