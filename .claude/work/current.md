# Current Work

**Project**: CURIO (containerized web UI for browsing/searching 3D print files from NAS)
**Objective**: Full-stack gallery app (Node/Express API + React/Vite, SQLite+FTS5, Tailwind UI) with multi-user favorites/collections, creator weights, and model upload flow.

**Current Focus (2026-08-05)**: Entirely data-import session + two critical bug fixes. Incrementally added 10 + 41 + 73 = **124 new models** to library (1341 → 1460 final), bringing Koza Design (258 total), Blob Lab (42), and Nostalgic 3D (73) creators up to final counts. Implemented three new import scripts (import_posts.py for Patreon post/collection URLs, flatten_models.py for nested folder structure, import_local_packs.py for hand-delivered pack archives). Fixed two backend bugs: (1) scrapeUrl() in importers/index.js never checked resp.ok, so Cloudflare-challenged pages (403 w/ "Just a moment..." HTML) were parsed as real and returned with zero images — now throws with status; (2) "missing files" heuristic was wrong for 35/43 flagged models, using a simplistic LIKE '%.stl%' check; replaced with a shared MODEL_FILE_EXTS_SQL list + hasModelFileSql() helper used by both the filter and count queries. Discovered and resolved critical NAS issue: 11 GB bloblab transfer dropped mid-SMB session; 6 folders were truncated or uncopied; byte-level verification (names + sizes, not folder counts) revealed the damage; re-copied and verified all 41/41 bloblab models.

**Last Checkpoint**: 2026-08-05 18:11 PDT

## Constraints (durable hard rules)
See constraints.md for full ledger. One-liners:
- **Node**: DEFAULT node v22.x for API & tests (better-sqlite3 recompiled 2026-08-05; old fnm v23.6.1 now fails).
- **Docker**: ARM64 for Raspberry Pi (not amd64).
- **Vite cwd**: must be web/ (not repo root).
- **API not public**: port behind nginx proxy (TinyAuth or DEFAULT_USER).
- **DB filename**: stl-browser.db (data continuity).
- **Dev API restart**: plain node, must restart after backend edits.
- **Never commit secrets**: BROWSERLESS_TOKEN, etc. stay in chat/env only.
- **Archives with nested structure**: flatten before import (app is flat-per-model).
- **Creator name matching**: must match library exactly before bulk import to avoid duplicate creator chips.
- **NAS copy verification**: byte-level (names + sizes), not folder counts (truncation hidden in counts).
- **Safety hook blocks `rm -rf /...`**: use `find <path> -depth -delete` for targeted removal.

## Next Actions
1. **Restore Patreon scrape prefill**: it is BROKEN — Patreon now 403s plain fetches behind Cloudflare, so /add link-prefill fails loudly (by design, after this session's fix). Needs BROWSERLESS_URL + token from Taylor, verification that browserless clears Cloudflare, then `render: true` on the Patreon importer.
2. **Surface `imagesFailed[]` in Add Model UI**: backend populates it correctly (verified live this session); the frontend still never renders it, so image download failures stay invisible.
3. **Local disk cleanup**: delete ~/Downloads/process/_extracted (~26 GB), original zips (~14 GB), and /Users/tbird/dev/3dprint/Nostalgic3D (21 GB) now that the NAS copy is verified byte-for-byte. Local disk was at 94%.
4. **Decide whether to push**: main is at 5cbdf2c, one commit ahead of origin/main.
5. **Pi redeploy**: rebuild/push ARM64 curio-api + curio-web, choose TinyAuth vs DEFAULT_USER, then delete the old stl-browser-* Docker Hub repos.
