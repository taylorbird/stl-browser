# Add Model — Design (Phase 1)

**Date:** 2026-06-09
**Status:** Approved, ready for implementation plan
**Scope:** Manually add a *single* model to CURIO via the web UI — upload model files, attach images (scrape from a page URL and/or upload), curate which images to keep, enter basic metadata, write it all to the NAS as an indexer-compatible folder, and index it immediately.

Not in scope: bulk import; dedicated per-site importers (see Phase 2 to-do).

## Background

A model in CURIO is just a folder on the NAS:

```
DATA_DIR/<creator>/<model-name>/
  ├── metadata.md      (optional — YAML frontmatter + markdown body)
  ├── <images>         (first image alphabetically = preview)
  └── <model files>    (.stl, .3mf, .obj, .zip …)
```

The indexer (`api/src/indexer.js`) walks these folders into SQLite + FTS. So "Add Model"
fundamentally = **create a new folder with files + metadata.md, then index it.**

## UX flow

- **Entry:** "Add Model" button in the sidebar (desktop) and the mobile top bar → routes to a
  new standalone page `/add` (sibling to `/models/:id`).
- **Single vertical form, in this order:**
  1. **Model files** — drag-and-drop dropzone + file picker. Accepts `.stl`, `.3mf`, `.obj`, `.zip`.
     Staged-file list with sizes; remove individually. This is the starting point. **≥1 required.**
  2. **Images** — two sources feeding one pool:
     - *From a page URL:* paste URL → "Fetch images" → server scrapes candidates → thumbnails.
     - *Upload:* drop/select image files directly.
  3. **Image review grid** — ALL candidates (scraped + uploaded) shown together, each with a
     checkbox. **Only checked images are saved.** Defaults: uploads checked, scraped unchecked
     (opt in). First selected = preview; a "set as preview" control reorders.
  4. **Details:** Title (required), Creator (required — combo box: pick existing or type new),
     Date (optional, defaults today), Description (optional markdown → metadata.md body),
     Source URL (optional).
  5. **Save** → writes folder to NAS, indexes that one model, redirects to its new detail page.

## Backend

**Auth:** reuse `userId(req)` (`remote-user` → `remote-email` → `DEFAULT_USER`). New write
endpoints reject anonymous with 401, like favorites/collections.

### `POST /api/scrape-images` `{ url }`
- Server-side `fetch` with a browser-like `User-Agent` (avoids dumb bot-blocks).
- Extract image candidates from server-rendered HTML: `og:image`, `twitter:image`,
  `<img src>` / `srcset`. Resolve relative→absolute, dedupe.
- **Returns candidate URLs only — downloads nothing.** Browser renders thumbnails from the
  source URLs so the user curates before anything hits disk.
- HTML extraction: regex-based for the meta tags + img srcs (dependency-free; we only need URLs).
- **Known limitation:** only sees server-rendered HTML — misses lazy-loaded / JS-rendered
  galleries (e.g. Fractal, inspirelightshows). Closing that gap is Phase-2 per-site work.

### `POST /api/models` (multipart)
Carries: model files + uploaded image files (file parts), selected scraped image URLs (to
download server-side), and fields title/creator/date/description/sourceUrl.

Server steps:
1. Resolve creator → existing folder, or slugify a new creator name into a new dir.
2. Slugify title → model folder name; auto-suffix `-2`, `-3` on collision.
3. `mkdir` the folder; stream uploaded files in (multer disk storage → move into folder).
4. Download each *selected* scraped image URL (browser UA; validate image content-type;
   cap count/size). Skip failures, report which failed; never half-write the DB row.
5. Write `metadata.md`:
   ```
   ---
   title: <title>
   creator: <creator>
   date: <YYYY-MM-DD>
   patreon_url: <sourceUrl>   # reuse existing column for the source link
   ---
   <description markdown>
   ```
6. Index just this folder; return new model id → frontend redirects to `/models/:id`.

**Shared indexing:** refactor `reindex`'s per-folder body into
`indexModelFolder(db, dataDir, folderPath)` so Add Model indexes one model instantly
(no 1–2 min SMB re-walk) and both code paths stay in sync.

**Validation:** title + creator required; ≥1 model file required.

### Detail-page Source link tweak
The detail page currently labels `patreon_url` as "Patreon ↗". Since we reuse that column for
any source URL, update the Source row: show "Patreon ↗" when the host is patreon.com, else
"Source ↗". No schema change.

## Dependencies
- **`multer`** (API) — Express multipart handler; disk storage streams large STLs straight to
  the target dir (no memory buffering).

## Deployment
- The data volume must be **read-write**. Compose currently mounts `/data:ro`
  (docker-compose.yml line 8) — drop `:ro` before this ships. Local dev mount is already writable.

## Testing (mirror existing `node:test` harness)
- `slugify` + folder-uniqueness suffixing.
- HTML image-parser: sample HTML → expected candidate URLs (og:image + img src/srcset).
- `indexModelFolder`: create temp folder → index → assert models + FTS row.
- `POST /api/models`: happy path (FormData), 401 anonymous, missing-file rejection.

## Local dev reminders
- Run API/tests with fnm node v23.6.1 (better-sqlite3 native build).
- Vite must run from `web/`. Current local ports: API `:4001`, Vite `:5180`
  (vite.config proxy → 4001).

## Phase 2 (to-do, not now)
Dedicated per-site importers (Patreon, Thangs, Printables, MakerWorld …) that pull the model
files + images + metadata automatically from a model page, including JS-rendered galleries.
