# Work Log

## 2026-07-01 14:24

**Session Summary**: Built the Add Model "start from a link" scrape flow end to end. Reshaped AddModelPage.jsx so URL fetch is a full-width "Start from a link" card at the TOP (accent Fetch button, search icon), with sections now ordered Details -> Images -> Model files and all always visible so no-URL uploads still work; the Images section is now an upload dropzone (grid icon) plus review grid, fixing the complaint that the two dropzones looked identical. Added text-metadata scraping in api/src/addModel.js via extractPageMeta(html) returning {title, description, siteName, date} from og/twitter/<title>, og:description/meta, og:site_name, and article:published_time (normalized to YYYY-MM-DD), and broadened decodeEntities() to handle numeric (&#39;) and hex (&#x27;) entities. Introduced a per-site importer architecture: api/src/importers/index.js (registry + scrapePage(url,html)) with patreon.js, where scrapePage runs generic extraction then merges any matching importer.refine(html,url,base); the Patreon importer splits og:title 'X | Creator' into title X + creator Creator and filters images to /p/post/ media (dropping the meta-image and /p/campaign/ avatars). routes.js /api/scrape-images now calls scrapePage (dropped extractImageUrls/extractPageMeta imports, added scrapePage). Added creator de-dup: since a model's creator comes from metadata.md creator: (indexer.js:66), scrape prefill now snaps to the canonical creator name+folder via new normName()/findCreator() helpers (normalize = lowercase + strip non-alnum, so 'Blob Lab' -> 'bloblab'). Central diagnostic of the session: "why didn't title populate?" turned out to be a STALE dev API — plain node started with no --watch before the backend edit, so the live endpoint was still images-only; a restart fixed it, after first verifying the new parser against saved real Patreon HTML.

**Decisions Made**:
- Sections always visible on /add (not gated behind a URL fetch): so from-scratch uploads with no link aren't blocked (Taylor confirmed).
- Prefill EMPTY fields only, never clobber typed input: preserves anything the user already entered.
- Do NOT auto-fill creator from og:site_name: for Patreon that tag is 'Patreon' (the platform), not the creator; instead derive creator per-site from the title split.
- article:published_time date added to the GENERIC extraction layer, not the Patreon importer: it's a standard OG tag that benefits all OG sites.
- Keep the low-level parsers in addModel.js with the importer layer on top: avoids breaking existing imports/tests.
- Patreon /p/post/ image filter chosen after verifying against the real page's 9 URLs (1 meta + 3 campaign avatars + 5 post images) — keep only the 5 post images.

**Actions Taken**:
- AddModelPage.jsx: moved URL fetch to a top full-width "Start from a link" card (accent Fetch, search icon); reordered sections Details -> Images -> Model files, all always visible; Images section became upload dropzone (grid icon) + review grid; differentiated the two dropzones visually.
- api/src/addModel.js: added extractPageMeta(html) -> {title, description, siteName, date} (og/twitter/<title>, og:description/meta, og:site_name, article:published_time normalized to YYYY-MM-DD); broadened decodeEntities() to numeric (&#39;) + hex (&#x27;) entities.
- api/src/importers/index.js: importer registry + scrapePage(url,html) that runs generic extraction then merges matching importer.refine(html,url,base). Interface: { match(host), refine -> partial }.
- api/src/importers/patreon.js: splits og:title 'X | Creator' -> title + creator; filters images to /p/post/ media (drops meta-image + /p/campaign/ avatars).
- routes.js: /api/scrape-images now calls scrapePage; removed extractImageUrls/extractPageMeta imports, added scrapePage import.
- Creator de-dup: added normName()/findCreator() helpers; scrape prefill snaps to canonical creator name+folder (normalized lowercase + strip non-alnum maps 'Blob Lab' -> 'bloblab').
- Verified: 99/99 API tests (was 91; +3 meta tests in addModel.test.js, +5 in new src/importers/importers.test.js), run via `node --test "src/**/*.test.js"` from api/ under fnm v23.6.1 node. Frontend build clean (~461KB). Live curl POST /api/scrape-images (Remote-User: tbird) against https://www.patreon.com/bloblab/posts/earth-zorble-161162421 returned title 'Earth Zorble', creator 'Blob Lab', date 2026-06-15, a description, and 5 post images.

**Context/Thoughts**:
- STALE-API TRAP: the dev API is plain node (no --watch); if started before a backend edit, the live endpoint keeps serving old code. When a new endpoint "doesn't work," restart the API before deeper debugging. Verify parsers against saved real HTML first.
- Importer interface is { match(host), refine(html,url,base) -> partial }; scrapePage in api/src/importers/index.js does generic extraction then merges the matching importer's partial. Add a new site by dropping a file in importers/ and registering it.
- ENV: Vite on :5173 (NOT :5180; proxy -> :4001 injects Remote-User: tbird). API on :4001. NAS 'projects' share dropped and was remounted via `open "smb://tbird@bird-nas._smb._tcp.local/projects"`. Bash cwd drifts after `cd api` — cd web before npm build.
- NOTHING COMMITTED: all of this session's changes are uncommitted on branch main.

## 2026-06-10 21:42

**Session Summary**: Polished the Add Model flow, hardened uploads, redesigned the model detail page, and packaged/shipped everything to main + Docker Hub. Taylor accepted the Add Model Phase 1 flow in-browser (prior task #2 now DONE) and created live test models (/models/28120 'Blob Plants - Desert' by bloblab; a Bowser '3D Print' by Fluid Prints with 5 images + 1 STL for layout testing). Add Model UX got drag-drop visual feedback on both dropzones, recursive folder-drop support (webkitGetAsEntry walk, flattened, collision filenames fold subpath in, dotfiles/junk skipped), auto-routing of images inside a dropped model folder to the image review grid, a 'Choose a folder' button, the model-files section moved to the BOTTOM of /add, and a frontend allowlist mirroring the server. Upload security was hardened TDD: a multer fileFilter enforcing extension allowlists plus a per-file size cap via MAX_UPLOAD_MB (default 2048; 413 over cap, 400 disallowed type; temp files swept on rejection), with MODEL_FILE_EXTS/IMAGE_FILE_EXTS exported from addModel.js (6 new tests, 91/91 total). ModelDetailPage.jsx was redesigned through heavy visual iteration into a flex-based bento gallery, scroll-to-Files Download button, file-type badges, and a collections popover. Finally packaged: committed all to main as bfa6314 (pushed to github.com-personal), dropped :ro from the compose /data mount, gitignored .vite/ and snapshot.txt, and rebuilt+pushed both ARM64 images (taylorlbird/curio-api:latest + curio-web:latest) via a docker-container buildx builder.

**Decisions Made**:
- Bento gallery via flex not grid: decouples hero size from tile size so the hero (flex-[1.7] aspect-[4/3]) can grow while the four side tiles (flex-1 2-col grid) stay small — grid's shared row-height had tied them together.
- Side tiles use grid-rows-2 stretch: fills the hero's full height (fixed Taylor's 'tiles top-aligned, big empty gap below' complaint); square on mobile, aspect-auto ≥1180px; 6th+ images wrap in a 96px thumb row; clicking a tile promotes it to hero.
- Download button scrolls to Files (filesRef + scroll-mt-6) instead of downloading: Taylor wanted per-file control in the Files section; file count moved INTO the button as a pill and per-type counts dropped from badges to avoid showing the count twice.
- Collection action placed next to Favorite using a distinct layers icon (add/remove popover, members show a check, 'New collection…' at bottom): Taylor asked for both. Collections membership section below images only renders when memberships exist.
- .pdf allowed in upload allowlist but .mp4 left OFF: grounded in live DB query (library has 6 PDFs, 1 MP4); .mp4 deferred pending Taylor's call.
- Committed directly to main, no PR: matches the repo's entire linear direct-to-main history and Taylor's 'just package and push' intent.

**Actions Taken**:
- Add Model UX: drag-drop visual feedback (accent border/tint) on both dropzones; recursive folder drops (flattened, collision-safe, junk-skipped); images in dropped model folders auto-route to image review grid; 'Choose a folder' button; model-files section moved to bottom of /add; frontend allowlist mirrors server.
- Upload hardening (TDD): multer fileFilter with extension allowlists (model: stl/3mf/obj/step/stp/zip/pdf; images: jpg/jpeg/png/gif/webp) + per-file size cap via MAX_UPLOAD_MB; 413/400 responses; temp-file sweep on rejection; MODEL_FILE_EXTS/IMAGE_FILE_EXTS exported from addModel.js; 6 new tests.
- Detail redesign (ModelDetailPage.jsx): breadcrumb own line; title + subtitle (creator+logo · Source/Patreon · Added date), title wraps at max-w-[63%]; top-aligned action cluster (Download/Favorite/Collection); flex bento gallery; scroll-to-Files Download w/ count pill + stl-first file-type badges; collections popover; dense full-width Files grid below About with per-row Download. Added 'bookmark' + 'layers' icons to Icon.jsx.
- Packaging: committed to main as bfa6314 (pushed b78fd4b..bfa6314 to github.com-personal:taylorbird/stl-browser.git); dropped :ro from docker-compose.yml /data mount (now rw + comment); added .vite/ + snapshot.txt to .gitignore; rebuilt ARM64 images via buildx 'curio-builder', pushed taylorlbird/curio-api:latest + curio-web:latest to Docker Hub.
- Verified: 91/91 API tests pass (fnm v23.6.1 node, run from api/); vite build clean; Docker pushes confirmed via manifest output.

**Context/Thoughts**:
- webkitGetAsEntry entries must be read SYNCHRONOUSLY in the drop handler — they die after an await; readEntries returns ≤100 entries/call so must be drained in a loop.
- App is flat-per-model end to end (indexer reads only top-level folder files; download route can't address subpaths) so folder drops MUST flatten and zips are stored opaque/un-extracted — a zip-only model trips the 'missing files' .stl-substring heuristic.
- Upload safety: multer with no fileFilter/limits accepts anything by default; the server never executes/extracts uploads (zips inert on server); downloads use Content-Disposition: attachment (defuses stored-HTML XSS); preview route sets no Content-Type but only serves indexed images whose ext is in the allowlist (no .svg).
- Docker push from this Mac needs a docker-container buildx builder (default docker driver can't push multi-platform/cross-arch manifests); OrbStack daemon must be started (open -a OrbStack) before any docker build.
- DEPLOY BLOCKER from prior session is RESOLVED: :ro dropped from the compose /data mount, so Add Model writes to the NAS now work.

## 2026-06-09 23:02

**Session Summary**: Two features in one local-dev session. (1) Responsive/mobile pass on the CURIO UI — approved by Taylor — drawer-below-1024px shell with a mobile top bar (hamburger + persistent search + sync), reflowed BrowsePage header, 2-col phone grid, touch-visible card actions, and dialog fixes. (2) Built Add Model Phase 1 (single model, not bulk) test-first: backend went 60→85 tests, frontend builds clean, live endpoints smoke-tested. Flow = upload model files → scrape images from a page URL and/or upload → curate a review grid (only checked saved, star=preview) → metadata (title/creator combo/date/description/source) → POST writes a creator-slug/title-slug folder + metadata.md to the NAS and indexes just that model. Awaiting Taylor's in-browser acceptance of Add Model. Nothing committed (Taylor: personal project, not worried about git yet).

**Decisions Made**:
- Mobile nav = off-canvas drawer + hamburger, persistent search in mobile top bar, breakpoint at lg/1024px (drawer on phones+tablets): preserves full sidebar content; search is primary in a 1339-model lib. Taylor chose via options.
- Add Model: page URL scrape returns metadata+images-candidates only (downloads nothing until curated); files uploaded separately; dedicated per-site importers deferred to Phase 2 (task #3). Taylor's call.
- Image curation: ALL candidates (scraped + uploaded) in one review grid, only checked ones saved; uploads default-checked, scrapes default-unchecked. Taylor explicitly asked for this.
- multer for uploads (disk storage, streams large STLs); folder name = slug of title with -2 collision suffix. Taylor chose via options.
- Reuse `patreon_url` column for any source URL (no schema change); detail page labels it "Patreon ↗" vs "Source ↗" by host.
- Indexer honors explicit `preview:` in metadata.md (else first image) — needed because readdir order over SMB is nondeterministic and the UI lets you pick the preview.
- Extracted `indexModelFolder()` from `reindex()` so Add Model indexes one folder instantly instead of a 1-2 min full SMB re-walk.

**Actions Taken**:
- Responsive: edited App.jsx, Sidebar.jsx, BrowsePage.jsx, ModelCard.jsx, Icon.jsx (menu/close/refresh), three dialogs. Made api/src/index.js PORT-env configurable; moved local dev to API :4001 / Vite :5180 (vite proxy→4001) to dodge a port clash.
- Add Model backend (TDD): api/src/addModel.js (slugify, uniqueDirName, extractImageUrls + HTML-entity decode), indexer.js refactor + preview-honoring, routes.js POST /api/scrape-images + POST /api/models (multer, owner-only, downloadImage w/ browser UA), installed multer. 25 new tests across addModel.test.js / indexer.test.js / routes.test.js (FormData multipart, local HTTP server for scrape).
- Add Model frontend: pages/AddModelPage.jsx, api.js scrapeImages/createModel, /add route in main.jsx, "Add model" buttons in Sidebar + mobile top bar, ModelDetailPage Source-link tweak.
- Wrote design doc docs/plans/2026-06-09-add-model-design.md. Created task #3 (Phase 2 importers).

**Context/Thoughts**:
- Scraper sees server-rendered HTML only (og:image/twitter:image/img src/data-src/srcset) — misses JS-rendered/lazy galleries (Fractal, inspirelightshows). That gap IS Phase 2 (task #3). Sends a browser UA to dodge naive bot-blocks.
- HTML attributes are entity-encoded — extracted URLs had literal `&amp;`; added decodeEntities or they'd fetch/render wrong. (Caught by live-scraping github.com, not by the initial tests.)
- DEPLOY BLOCKER: docker-compose.yml line 8 mounts /data:ro — Add Model writes fail until :ro dropped. Local SMB mount is rw.
- Chrome DevTools MCP did not connect this session — couldn't headless-verify UI; relied on vite build + Taylor's browser. better-sqlite3 still needs fnm v23.6.1 node.
- Gotcha repeated twice: Vite must run with cwd=web/ (accidentally started from repo root → no config/index.html → 404). Bash cwd also drifts after `cd api` for npm; re-cd before vite build.

## 2026-06-03 19:30

**Session Summary**: Extended session spanning multiple days (May 29 – June 3). Restructured 190 non-Patreon STL model folders from 8 creators (3DDb, bloblab, flexi-factory, forgecore, fractal, holidaylights, Lofted Goods, Personal) into the indexer-compatible format with metadata.md files, preview images sourced from Thangs, Patreon, Printables, and Fractal Design. Cleaned 877 model titles from filename-style to human-readable via clean_titles.py. Major UI overhaul: model card hover effects (scale + amber glow), Rajdhani font for model titles, wider layout with 5-column grid, infinite scroll with intersection observer, randomized model ordering via seeded hash, sort options (Shuffle/Newest/Title/Creator), segmented scroll/pages toggle, STL count badges, skeleton loading for creator chips. Copied Claude Code skills to ~/syncthing/claude for cross-machine sync.

**Decisions Made**:
- Infinite scroll as default, pages as opt-in toggle: gallery browsing benefits from continuous scroll
- Seeded random sort for stable pagination: seed generated per session, passed to API so pages stay consistent while scrolling
- Docker images must target linux/arm64 for Raspberry Pi deployment (not amd64)
- Model titles cleaned via script rather than manual editing: 877 titles auto-cleaned
- Skeleton loading placeholders for creator chips: prevents layout shift on load

**Actions Taken**:
- Created restructure.py to convert 8 creator folders into indexer format
- Created download_previews.py for Thangs image matching, fetch_patreon_previews.py for Patreon
- Walked through 15 models needing manual preview images (URLs, screenshots, Chrome DevTools scraping)
- Copied all 190 models to NAS models-new directory
- Created clean_titles.py — normalizes metadata titles (dashes/underscores to spaces, strip versions, title case, CamelCase splitting)
- Added sort=random with seeded hash to API routes (LCG-style: id * 1103515245 + seed-derived offset mod prime)
- Converted BrowsePage from paginated to infinite scroll with IntersectionObserver
- Added sort option buttons and scroll/pages segmented toggle
- Added hover effects to ModelCard (scale, amber glow, image zoom, title color shift)
- Added Rajdhani font, widened container to max-w-[100rem], increased grid gap
- Moved STL count to badge, removed date from model cards
- Added skeleton loading for creator chips
- Pushed code to GitHub, built and pushed Docker images (note: initially built for wrong arch — amd64 instead of arm64)
- Copied ~/.claude/commands, CLAUDE.md, settings.json to ~/syncthing/claude

**Context/Thoughts**:
- SQLite doesn't support XOR (^) operator — caused runtime error when attempted in ORDER BY
- Large integer multiplication overflows in SQLite — initial hash functions produced identical orderings for different seeds
- Working hash: (id * 1103515245 + (seed % 32749) * 12345) % 2147483647 — verified different seeds produce different orderings
- Vite must run from web/ directory (cd first), npx --prefix doesn't set cwd correctly
- inspirelightshows.com blocks curl without browser user-agent header
- Fractal Design page uses lazy-loaded images — needed Chrome DevTools MCP to extract real image URLs

## 2026-05-28 15:30

**Session Summary**: Converted model detail from modal overlay to a standalone routed page (/models/:id) using react-router-dom. Added framer-motion fade-in animations and daisyUI loading spinners for image loading states across both browse and detail pages. Added daisyUI as a dependency. Created a reusable LoadingImage component and extracted a shared Header component. Added TinyAuth support via GET /api/me endpoint that reads Remote-Email, Remote-Name, Remote-User headers from forwarded requests and displays the user name/email in the header. Rebuilt and pushed Docker images to Docker Hub. Verified from a fresh pull in /tmp/stl-browser-test — browse page, detail page routing, spinners, and /api/me all working.

**Decisions Made**:
- Detail page as route not modal: enables shareable URLs, browser back/forward, better UX for content-heavy pages
- TinyAuth integration is header-only: user already runs Traefik + TinyAuth separately, just needed API to read forwarded headers
- daisyUI for component library: user preference, used for loading spinners
- framer-motion for animations: user preference, used for image fade-in and page transitions
- docker-compose.yml uses production NAS paths: /mnt/nas/projects/3dprint/models-new and /opt/docker_apps/stlfinder/config
- No Traefik labels in compose: user configures Traefik independently

**Actions Taken**:
- Installed framer-motion and daisyui packages
- Created LoadingImage component with spinner placeholder and fade-in
- Created Header component (shared between browse and detail pages)
- Created ModelDetailPage as routed page with back link, image gallery, file list
- Updated main.jsx with BrowserRouter and routes (/ and /models/:id)
- Updated ModelCard to use Link instead of onClick
- Updated BrowsePage to remove onSelectModel prop
- Removed old ModelDetail modal component
- Added GET /api/me endpoint reading Remote-Email/Name/User headers
- Added fetchMe() to frontend API module
- Header displays authenticated user name/email when present
- Added .env to .gitignore
- Rebuilt and pushed taylorlbird/stl-browser-api:latest and taylorlbird/stl-browser-web:latest
- Verified fresh Docker pull: browse, detail routing, spinners, /api/me all working

**Context/Thoughts**:
- Container hit ENFILE (file table overflow) indexing Studio Loup — 435 errors out of 1149 models. ulimits in compose helps. Indexer could also batch file reads to avoid opening too many simultaneously.
- Vite dev server must be started separately from API (different ports: 5173 and 3001), proxy config in vite.config.js handles /api forwarding in dev
- DB from previous session was stale (pointed at NAS paths but API was on test-data) — had to delete and reindex
- User runs Traefik + TinyAuth as separate infrastructure, not as Docker labels — compose file should just expose ports

## 2026-05-28 00:00

**Session Summary**: Fixed tests broken by tag removal (4 failures → 18/18 passing). Cleaned git history to remove Patreon session cookie — deleted old .git, created fresh repo with one clean commit. Added .gitignore entries for sensitive files (gallery-dl.conf, .claude/, __pycache__, etc.). Created private GitHub repo (taylorbird/stl-browser) using github.com-personal SSH alias. Built and pushed Docker images to Docker Hub (taylorlbird/stl-browser-api, taylorlbird/stl-browser-web).

**Decisions Made**:
- Fresh git repo instead of history rewriting: only 6 commits, simpler than BFG/filter-branch
- Private GitHub repo: contains no secrets now but no reason to be public
- Docker Hub namespace taylorlbird: matches user's existing Docker Hub account

**Actions Taken**:
- Fixed 4 test failures: removed model_tags references from db.test.js, indexer.test.js, routes.test.js; updated FTS insert in db.test.js; updated creators assertion to match new object format; replaced tag search test with stale detection test
- Updated .gitignore: added .DS_Store, __pycache__, .claude/, gallery-dl.conf, creator data dirs
- Verified no secrets in staged files (grep for session_id, cookie, password, etc.)
- Deleted old .git (user ran rm -rf manually due to sandbox restriction)
- Created fresh commit with clean history
- Added remote via github.com-personal SSH alias → taylorbird/stl-browser
- Built and pushed taylorlbird/stl-browser-api:latest and taylorlbird/stl-browser-web:latest

**Context/Thoughts**:
- Patreon session cookie (LOBvOod...) was in old git history — user should rotate it
- gh CLI is authenticated as taylorbirdbumphealth (work account), not taylorbird (personal) — use SSH for personal repos
- github.com-personal SSH alias defined in ~/.ssh/config maps to taylorbird account
- Docker images only contain app code (Dockerfile COPY), no secrets even if working dir has them

## 2026-05-27 (evening session)

**Session Summary**: Continued UI polish and feature work on the STL Browser. Removed all tag infrastructure (Patreon tags were mostly empty, custom tagging deferred to Phase 3). Added multi-image gallery to ModelDetail so all post images are visible, not just one preview. Enhanced reindex to detect stale models (folders deleted from disk) and added a StaleModelsDialog for user-confirmed removal. Added creator logos — downloaded Patreon profile images for all 4 creators, added API endpoint to serve them, and restyled creator chips as larger cards with logo + name. Removed the "All" button from creator filter chips.

**Decisions Made**:
- Removed all Patreon tags: mostly empty, will build custom tagging in Phase 3 instead
- Stale model detection returns list to frontend for user confirmation (not auto-delete)
- Creator logos stored as logo.* in each creator's NAS folder, served by dedicated API endpoint
- CSS letter avatars as fallback when no logo file exists

**Actions Taken**:
- Stripped tags from: db.js, indexer.js, routes.js, api.js, SearchBar, ModelCard, ModelDetail, BrowsePage
- Added image gallery with thumbnail strip to ModelDetail (uses fileUrl, not previewUrl)
- Added stale detection to indexer (compares DB folder_paths against disk scan)
- Created POST /api/models/delete batch endpoint with FTS cleanup
- Created StaleModelsDialog component with select-all/individual checkboxes
- Downloaded 4 creator logos from Patreon (100x100)
- Added GET /api/creators/:folder/logo endpoint
- Updated /api/creators to return objects {name, folder, hasLogo}
- Restyled creator chips: larger, square-ish, stacked avatar + name
- Fixed Vite dev server: must cd to web/ directory, npx --prefix doesn't set cwd

**Context/Thoughts**:
- DB must be deleted when restarting after schema changes (model_tags table and FTS tags column removed)
- KozaDesign's Patreon avatar was actually PNG despite .jpg URL — renamed to logo.png
- 6,456 images already exist across model folders (gallery-dl downloaded them), just weren't shown in UI

## 2026-05-27

**Session Summary**: Completed all 7 tasks of the STL Browser implementation plan using subagent-driven development. Built the full stack: SQLite DB with FTS5 search, Express API with model/search/filter/download endpoints, React frontend with card grid gallery, search bar, creator/tag filters, pagination, model detail modal with file downloads. Added Reindex button to header and creator filter chips. Fixed several issues along the way: FTS5 contentless table management, gray-matter date parsing, npm deprecation warnings. Successfully indexed 1149 models from 4 creators (Fluid Prints, Gazzaladra, Koza Design, Studio Loup) from the NAS mount. Also completed the Gazzaladra Patreon download at the start of the session.

**Decisions Made**:
- Hardcoded container paths (/data, /config) with Docker volume mapping instead of env vars: simpler container config
- Used FTS5 content='' (contentless) instead of content='models': tags column doesn't exist on models table
- Removed FTS triggers, indexer manages FTS directly: triggers caused corruption on re-index due to tags mismatch
- Wrapped reindex in db.transaction(): performance and consistency

**Actions Taken**:
- Downloaded Gazzaladra models from Patreon (83 models)
- Brainstormed and designed STL Browser architecture
- Wrote implementation plan (7 tasks)
- Implemented all 7 tasks: scaffolding, DB/indexer, API routes, frontend components, Docker, integration testing, UI polish
- Fixed FTS5 trigger corruption, date parsing, npm warnings
- Added Reindex button and creator filter chips
- Verified app working locally with all 4 NAS creators

**Context/Thoughts**:
- gray-matter auto-parses YAML dates to JS Date objects — need instanceof Date check
- Dirent.isDirectory() returns false for symlinks — use real paths, not symlinks, for DATA_DIR

## 2026-06-04 (overnight session)

**Session Summary**: Implemented the full MANIFOLD redesign from the design handoff (docs/design_handoff_manifold/). Wrote a 14-task plan (docs/plans/2026-06-03-manifold-redesign.md), executed tasks 1-2 via subagent-driven development, then switched to direct implementation at Taylor's request (subagent review loops were too slow and finding nothing). Backend: favorites + collections (tables, CRUD, membership), model-list filters, counts endpoints, FTS prefix search. Frontend: complete app-shell rebuild — sidebar, bento hero, vcard grid, collection dialog, restyled detail page. All verified live in headless Chrome; final consolidated code review run; fixes applied.

**Decisions Made**:
- Favorites: backend SQLite (multi-device), not localStorage
- Collections: full backend + UI including detail-page membership pills
- Tag filter row: omitted (no tag data until Phase 3)
- Rollout: replaced old UI outright on branch manifold-redesign
- "Recently added" = post date within 30 days; "missing" = lower(files) NOT LIKE '%.stl%' heuristic
- Card download = all STLs via sequential anchors (no zip endpoint)

**Bugs Found & Fixed (live browser verification caught both)**:
- Live search dropped re-fetches while a request was in flight (loadingRef guard) → reqId supersede pattern
- FTS whole-word MATCH made partial typing show "No models match" + raw input could 500 on operators → tokenized quoted prefix query (ftsQuery)
- Post-review: 250ms search debounce (10 keystrokes were = 10 requests), stats.stale?. guard

**Review outcome**: 41/41 tests, vite build clean, "ready to merge with fixes" — fixes applied same session. Reviewer's favorites-staleness claim tested live and refuted (App remounts on route change).

**Context/Thoughts**:
- better-sqlite3 compiled for Node 23; default node v22.2.0 fails (NODE_MODULE_VERSION 131 vs 127) — use fnm v23.6.1 binary for API + tests
- chrome-devtools CLI also needs Node ≥22.12 — same binary on PATH; daemon dies silently on old node
- API startup reindex blocks all requests ~1-2 min over SMB (/Volumes/projects)
- Branch is 15 commits ahead of main; main still has old UI; Docker images on Hub are pre-redesign

## 2026-06-04 17:28

**Session Summary**: Continuation of the redesign session (same conversation as the overnight entry). Shipped everything: detail-page redesign from second handoff, per-user multi-tenancy via proxy-auth headers, creator shelf on homepage, per-user creator weights with settings dialog, renamed MANIFOLD→CURIO, deployment hardening (optional metadata.md, DEFAULT_USER, no public API port), user-facing README. Merged manifold-redesign→main (fast-forward, 60/60 tests), pushed to GitHub, built+pushed ARM64 curio-api/curio-web images to Docker Hub. Gave Taylor the updated Pi compose.

**Decisions Made**:
- Multi-user identity = Remote-User header from TinyAuth; reject writes when anonymous (Taylor chose strict over fallback); DEFAULT_USER env added later for non-proxy deployments
- Collections per-user (not shared); tag row omitted until Phase 3
- Shuffle/Featured = creator-balanced weighted random by default (Efraimidis–Spirakis in SQL via ln()); weights Hide/Less/Normal/More/Max = 0/0.5/1/2/4
- App renamed CURIO (Taylor wanted plinth-vibes without explanation; curio cabinet)
- Docker images renamed taylorlbird/curio-*; DB filename kept stl-browser.db for data continuity
- Old Hub repos deleted only AFTER Pi upgrade (todo #16); GitHub rename deferred to Taylor (todo #15)

**Actions Taken**:
- Detail page: gallery w/ thumbs, markdown About (marked), file sizes (fileDetails API), collections popover, details dl
- Multi-user: favorites(user_id), collections(owner), user_creator_weights tables; per-user scoping on all endpoints; vite dev proxy injects Remote-User: tbird
- Live-search fixes: FTS prefix matching + operator sanitization; reqId supersede; 250ms debounce
- Creator shelf (auto-fit logo cards) between Featured and grid; 48px section rhythm
- Settings dialog (sidebar sliders icon) with creator weight segments
- Deployment: optional metadata.md (folder-name derived title/date), DEFAULT_USER, hardened compose, README.md
- Merged, pushed git, built+pushed ARM64 images

**Context/Thoughts**:
- Final code review verdict "with fixes" — applied debounce + minor fixes; reviewer's favorites-staleness claim was REFUTED by live test (App remounts on route change)
- Taylor feedback captured to memory: skip per-task subagent review loops when plan has complete code; never probe dotfiles/hosts when asked for a single named operation ("just git push")
- Hover animations intermittently dead a few seconds after tabbing back into browser — noted in questions.md, verified working in fresh headless Chrome
- gh CLI = work account only; personal repo admin via web UI
