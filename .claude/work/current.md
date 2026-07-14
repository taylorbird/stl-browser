# Current Work

**Project**: CURIO (formerly STL Browser / MANIFOLD) — containerized web UI for browsing/searching 3D print files from NAS
**Objective**: Build and deploy a Docker Compose app (Node/Express API + React/Vite/Tailwind frontend) that indexes model folders into SQLite and provides a searchable, multi-user gallery UI

**Current Focus**: Add Model "start from a link" (scrape) flow reshape + per-site importer architecture — ALL UNCOMMITTED on main. This session: (a) AddModelPage.jsx layout reshape — moved URL fetch into a full-width "Start from a link" card at the TOP (accent Fetch button + search icon), no longer a dropzone-twin; new section order Details → Images → Model files, ALL always visible so no-URL/from-scratch uploads still work; Images section is now just an upload dropzone (grid icon) + review grid (fixes Taylor's complaint that the two dropzones looked identical). (b) Scraper now returns TEXT metadata (was images-only) — added `extractPageMeta(html)` in api/src/addModel.js → {title, description, siteName, date} (og:/twitter:title→title, fallback <title>; og/twitter/meta description; og:site_name; article:published_time→date normalized YYYY-MM-DD); broadened `decodeEntities()` to decode numeric (&#39;) and hex (&#x27;) entities. (c) Per-site importer architecture (information scraper, NOT a downloader) — new dir api/src/importers/ with index.js (registry + `scrapePage(url,html)`) and patreon.js; scrapePage runs genericParse (extractPageMeta + extractImageUrls) then merges a matching importer's `refine(html,url,base)` overrides; importer interface `{ match(host), refine(html,url,base)->partial }`; patreon.js splits og:title 'Earth Zorble | Blob Lab' → title 'Earth Zorble' + creator 'Blob Lab', filters images to real post media (patreonusercontent.com AND /p/post/), dropping meta-image thumbnail + /p/campaign/ avatars; routes.js /api/scrape-images now calls scrapePage. (d) Creator de-dup — creator matching now normalizes (lowercase + strip non-alphanumerics) so 'Blob Lab' maps to existing 'bloblab'; scrape prefill snaps a matched creator to its canonical name+folder. Note: manual-typed creator still writes the typed value (only the scrape path snaps to canonical).

**Last Checkpoint**: 2026-07-01 14:24 PDT

## Constraints (durable hard rules)
- **Node version**: better-sqlite3 native module compiled for Node 23 — run API & tests with fnm v23.6.1 node (`"/Users/tbird/Library/Application Support/fnm/node-versions/v23.6.1/installation/bin/node"`), NOT default v22.2.0 (→ NODE_MODULE_VERSION error).
- **Docker target**: images must target ARM64 for the Raspberry Pi (not amd64).
- **Vite cwd**: Vite must run with cwd=web/ (bash cwd drifts after `cd api` — `cd web` before `npm run build`).
- **API not public in deploy**: identity = Remote-User header, which is spoofable — the API port must NOT be exposed publicly. nginx in the web container proxies /api internally; front with TinyAuth (multi-user) or DEFAULT_USER (single-user).
- **DB filename**: stays `stl-browser.db` for data continuity with existing Pi data — do not rename.
- **Dev API is plain node (no --watch)**: RESTART the API after ANY backend edit or the endpoint serves STALE code. (This session's central diagnostic: live /api/scrape-images was stale/images-only because the API was started before the backend edit.)

**Add Model (Phase 1, SHIPPED)**: Design in docs/plans/2026-06-09-add-model-design.md. Flow: /add page → upload model files → add images (scrape page URL via POST /api/scrape-images and/or upload) → curate review grid (only checked saved; uploads default-checked, scrapes default-unchecked; star=preview) → title/creator(combo)/date/description/sourceUrl → POST /api/models (multipart, multer, owner-only) writes creator-slug/title-slug/ folder + metadata.md, indexes via indexModelFolder() (no full re-walk), redirects to /models/:id. Backend: addModel.js (slugify, uniqueDirName, extractImageUrls, extractPageMeta, decodeEntities, MODEL_FILE_EXTS/IMAGE_FILE_EXTS + fileFilter), importers/ (scrapePage registry + patreon), indexer.js (indexModelFolder + honors `preview:`), routes.js (endpoints + downloadImage + multer caps).

**Status**: Full MANIFOLD→CURIO redesign shipped + Add Model Phase 1 live + scrape flow reshape/importer architecture in progress (uncommitted). Backend: per-user favorites/collections/creator-weights (proxy-auth headers or DEFAULT_USER), model filters, counts, FTS prefix search, optional metadata.md indexing, secured uploads, text-metadata scrape + per-site importers. Frontend: app-shell (sidebar, bento hero, creator shelf, vcard grid, settings dialog), redesigned detail page, reshaped Add Model page. 99/99 API tests (was 91; +3 meta +5 importer). vite build clean (~461 KB JS).

## Published Artifacts
- **GitHub**: git@github.com:taylorbird/stl-browser.git (via github.com-personal SSH alias) — main @ **bfa6314**. This session's work (AddModelPage.jsx, addModel.js, addModel.test.js, routes.js, new api/src/importers/{index,patreon,importers.test}.js) is UNCOMMITTED. Repo rename to "curio" still pending (web UI, personal acct).
- **Docker Hub**: taylorlbird/curio-api:latest + taylorlbird/curio-web:latest — ARM64, pushed via buildx builder 'curio-builder'. Old stl-browser-* repos still exist — delete after Pi upgrade.
- **Tests**: 99/99 passing (91 prior + 3 extractPageMeta + 5 importer). vite build clean (~461 KB JS).
- **NAS**: 12 creators, 1340 models indexed.

## Environment notes
- better-sqlite3 native module compiled for Node 23 — run API/tests with fnm v23.6.1 node (see Constraints); default v22.2.0 → NODE_MODULE_VERSION error.
- chrome-devtools CLI also needs Node ≥22.12 on PATH; daemon dies silently on old node.
- Local dev (current ports): API on :4001 (`PORT=4001 DATA_DIR=/Volumes/projects/3dprint/models-new DB_PATH=/Users/tbird/dev/3dprint/stl-browser.db`, node from api/src/index.js), Vite on **:5173** from web/ (vite.config.js has NO explicit port — correct dev URL is http://localhost:5173/ , add page /add; proxy → :4001, injects Remote-User: tbird / Remote-Name: Taylor). Vite MUST run cwd=web/. API startup reindex blocks ~1 min over SMB; RESTART API to pick up backend changes (plain node, not --watch).
- **NAS mount**: the 'projects' share had DROPPED (only 'media' was mounted). Remount (keychain, non-interactive) with: `open "smb://tbird@bird-nas._smb._tcp.local/projects"`.
- **Left running this session (background)**: dev API :4001 (latest code), Vite :5173, OrbStack daemon, leftover curio-builder buildx container (clean up if reclaiming resources).
- docker-compose.yml /data mount: `:ro` DROPPED (now read-write w/ comment) so Add Model can write to NAS.
- .gitignore now covers .vite/ and snapshot.txt (build cache + a11y dump, not committed).
- gh CLI authed as work account — personal repo admin ops (rename) via web UI or personal gh login; pushes work via github.com-personal SSH alias.

## Multi-user model
- Identity = Remote-User header (fallback Remote-Email, then DEFAULT_USER env). Anonymous: reads empty, writes 401.
- DEPLOY: API port must NOT be public (header spoofing). nginx in web container proxies /api internally. TinyAuth fronts port 3000 for multi-user, or DEFAULT_USER for single-user.
- Model creator comes from metadata.md `creator:` field (indexer.js:66 `creator = fm.creator || creatorName`), so mismatched names surface as DUPLICATE creators — hence this session's normalization/snap-to-canonical work.

## Creator weights
- Shuffle/Featured = creator-balanced weighted random (equal airtime per creator by default; Hide/Less/Normal/More/Max per user). Settings via sidebar footer sliders icon.

## Known approximations (documented, accepted)
- "Missing files" = lower(files) NOT LIKE '%.stl%' substring heuristic
- "Recently added" = post date within 30 days
- DELETE favorites/membership idempotent (200 even if nothing deleted)
- File format label is extension-based ("45.3 MB · STL"), no binary/ascii detection

## Next Actions
1. **Commit this session's Add Model / importer work to main + push** — AddModelPage.jsx, addModel.js, addModel.test.js, routes.js, new api/src/importers/{index,patreon,importers.test}.js. Nothing is committed yet; 99/99 tests + clean build.
2. **Build Edit Model feature** (tracker task #1): remove files, edit metadata (title/creator/date/description/source), pick hero/preview image. Indexer already honors `preview:` in metadata.md → hero-pick = metadata edit + single-folder reindex (no schema change). Reuse indexModelFolder().
3. **Build next site importer(s)** — Printables / Thangs (Taylor to name the target) — on the api/src/importers/ registry (add a module exporting `{ match(host), refine(html,url,base) }` and register it in index.js).
4. **Carried-forward**: Pi redeploy (pull new curio-api/curio-web images, choose TinyAuth vs DEFAULT_USER; compose :ro already dropped; no public API port); GitHub repo rename to "curio" + delete old stl-browser-* Hub repos (do after Pi upgrade); decide whether .mp4 uploads should be allowed (currently blocked; ask Taylor).
