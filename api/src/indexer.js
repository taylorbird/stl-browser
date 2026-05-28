import { readdirSync, readFileSync } from 'node:fs';
import { join, extname } from 'node:path';
import matter from 'gray-matter';

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);
const DATA_DIR = '/data';

export function reindex(db, dataDir = DATA_DIR) {
  const stats = { indexed: 0, errors: 0, stale: [] };

  const upsertModel = db.prepare(`
    INSERT INTO models (folder_path, title, creator, date, patreon_url, post_id, content, files, preview_filename, indexed_at)
    VALUES (@folder_path, @title, @creator, @date, @patreon_url, @post_id, @content, @files, @preview_filename, @indexed_at)
    ON CONFLICT(folder_path) DO UPDATE SET
      title=@title, creator=@creator, date=@date, patreon_url=@patreon_url,
      post_id=@post_id, content=@content, files=@files, preview_filename=@preview_filename, indexed_at=@indexed_at
  `);

  const getModelId = db.prepare('SELECT id FROM models WHERE folder_path = ?');
  const getExistingFts = db.prepare('SELECT title, creator, content FROM models_fts WHERE rowid = ?');
  const deleteFtsRow = db.prepare(
    "INSERT INTO models_fts(models_fts, rowid, title, creator, content) VALUES ('delete', ?, ?, ?, ?)"
  );
  const insertFtsRow = db.prepare(
    'INSERT INTO models_fts(rowid, title, creator, content) VALUES (?, ?, ?, ?)'
  );

  const getAllFolderPaths = db.prepare('SELECT id, folder_path, title, creator FROM models');

  const runInTransaction = db.transaction(() => {
    const seenPaths = new Set();
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

          const allFiles = readdirSync(modelPath, { withFileTypes: true })
            .filter(d => d.isFile() && d.name !== 'metadata.md')
            .map(d => d.name);

          const previewFile = allFiles.find(f => IMAGE_EXTENSIONS.has(extname(f).toLowerCase())) || null;

          const folderPath = `${creatorDir.name}/${modelDir.name}`;
          seenPaths.add(folderPath);
          const title = fm.title || modelDir.name;
          const creator = fm.creator || creatorDir.name;
          const trimmedContent = content.trim();
          const existingRow = getModelId.get(folderPath);
          if (existingRow) {
            const oldFts = getExistingFts.get(existingRow.id);
            if (oldFts) {
              deleteFtsRow.run(existingRow.id, oldFts.title, oldFts.creator, oldFts.content);
            }
          }

          upsertModel.run({
            folder_path: folderPath,
            title,
            creator,
            date: fm.date ? (fm.date instanceof Date ? fm.date.toISOString().slice(0, 10) : String(fm.date).slice(0, 10)) : null,
            patreon_url: fm.patreon_url ?? null,
            post_id: fm.post_id ?? null,
            content: trimmedContent,
            files: JSON.stringify(allFiles),
            preview_filename: previewFile,
            indexed_at: new Date().toISOString(),
          });

          const modelRow = existingRow || getModelId.get(folderPath);
          insertFtsRow.run(modelRow.id, title, creator, trimmedContent);
          stats.indexed++;
        } catch (err) {
          console.error(`Error indexing ${modelDir.name}: ${err.message}`);
          stats.errors++;
        }
      }
    }

    for (const row of getAllFolderPaths.all()) {
      if (!seenPaths.has(row.folder_path)) {
        stats.stale.push({ id: row.id, folder_path: row.folder_path, title: row.title, creator: row.creator });
      }
    }
  });

  runInTransaction();
  return stats;
}
