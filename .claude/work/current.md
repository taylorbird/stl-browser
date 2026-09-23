# Current Work

**Project**: CURIO (containerized web UI for browsing/searching 3D print files from NAS)
**Objective**: Full-stack gallery app (Node/Express API + React/Vite, SQLite+FTS5, Tailwind UI) with multi-user favorites/collections, creator weights, and model upload flow.

**Current Focus (2026-08-05 — updated 19:00)**: Continuation of bulk-import session. Earlier checkpoint (18:11) recorded 124 model imports + critical backend bug fixes. This follow-up focused on image richness for Blob Lab: discovered that Patreon's Blob Lab posts are SPLIT across two posts — release post with model files + hero photo, and companion showcase post with full gallery under the same title. Imported models had only 1 image because we used collection URLs (release-post-only). Developed **image pooling** technique: paired all 41 models to companion posts via title + date proximity (with critical safeguards: date-nearest instead of most-images to handle re-releases, suffix-stripping like (Bonus)/(Old) for exact matching). Cross-validated via in-body link analysis on subset, confirming correctness. Added 475 gallery images (28 already-present skipped); pinned original release-post hero image as explicit `preview:` field before reindexing to prevent alphabetical shuffle of nearly every card. Blob Lab final: 42 models, avg 12.8 images/model (was 1). Also: rebuilt and pushed both ARM64 Docker Hub images (taylorlbird/curio-api:latest + curio-web:latest); verified pushed manifests are ARM64 via docker buildx imagetools inspect. Main now at cf9de7d (2 commits ahead of origin/main), NOT yet pushed.

**Last Checkpoint**: 2026-08-05 19:00 PDT

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
1. **Pull updated Docker images on Pi**: curio-api and curio-web pushed to Docker Hub (latest); Pi deployment needs `docker pull` to fetch the new images (contains missing-files and blocked-scrape fixes + new image pooling + preview pinning).
2. **Restore Patreon scrape prefill**: it is BROKEN — Patreon now 403s plain fetches behind Cloudflare, so /add link-prefill fails loudly (by design, after the blocked-scrape fix). Needs BROWSERLESS_URL + token from Taylor, verification that browserless clears Cloudflare, then `render: true` on the Patreon importer.
3. **Surface `imagesFailed[]` in Add Model UI**: backend populates it correctly (verified live this session); the frontend still never renders it, so image download failures stay invisible.
4. **Local disk cleanup**: delete ~/Downloads/process/_extracted (~26 GB), original zips (~14 GB), and /Users/tbird/dev/3dprint/Nostalgic3D (21 GB) now that the NAS copy is verified byte-for-byte. Local disk was at 94%.
5. **Decide whether to push**: main is at cf9de7d, two commits ahead of origin/main (5cbdf2c bulk-import + cf9de7d checkpoint). Optionally cherry-pick and push the import work only, holding checkpoint docs.
