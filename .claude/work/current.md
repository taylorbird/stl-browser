# Current Work

**Project**: CURIO (containerized web UI for browsing/searching 3D print files from NAS)
**Objective**: Full-stack gallery app (Node/Express API + React/Vite, SQLite+FTS5, Tailwind UI) with multi-user favorites/collections, creator weights, and model upload flow.

**Current Focus (2026-09-23 — MACHINE HANDOFF)**: Work is moving off the old Mac to a new machine. Verified 2026-09-23: `main` == `origin/main` at 09a6dce (everything committed + pushed; no stashes, no other worktrees). Docker Hub `curio-api:latest` / `curio-web:latest` (built 2026-08-05 18:59 PDT, ARM64) postdate the last api/web code commit (5cbdf2c), so they contain current code — no rebuild needed. Taylor is pulling them onto the Pi. Things git does NOT carry are listed under "New-machine setup" below.

**Previous focus (2026-08-05 — updated 19:00)**: Continuation of bulk-import session. Earlier checkpoint (18:11) recorded 124 model imports + critical backend bug fixes. This follow-up focused on image richness for Blob Lab: discovered that Patreon's Blob Lab posts are SPLIT across two posts — release post with model files + hero photo, and companion showcase post with full gallery under the same title. Imported models had only 1 image because we used collection URLs (release-post-only). Developed **image pooling** technique: paired all 41 models to companion posts via title + date proximity (with critical safeguards: date-nearest instead of most-images to handle re-releases, suffix-stripping like (Bonus)/(Old) for exact matching). Cross-validated via in-body link analysis on subset, confirming correctness. Added 475 gallery images (28 already-present skipped); pinned original release-post hero image as explicit `preview:` field before reindexing to prevent alphabetical shuffle of nearly every card. Blob Lab final: 42 models, avg 12.8 images/model (was 1). Also: rebuilt and pushed both ARM64 Docker Hub images (taylorlbird/curio-api:latest + curio-web:latest); verified pushed manifests are ARM64 via docker buildx imagetools inspect. Main now at cf9de7d (2 commits ahead of origin/main), NOT yet pushed.

**Last Checkpoint**: 2026-09-23 (handoff); previous 2026-08-05 19:00 PDT

## New-machine setup (not in git)
- **Clone**: remote is `github.com-personal:taylorbird/stl-browser.git` — an SSH host alias (see learnings/ssh-multi-github.md); on a machine without that alias use `git@github.com:taylorbird/stl-browser.git`.
- **Node v22.x**, then install deps in api/ and web/ (repo currently has npm `package-lock.json` files) (native module better-sqlite3 must compile against the node in use — learnings/node-version-native-modules.md).
- **Docker**: `docker login -u taylorlbird`, then create a buildx builder (`docker buildx create --name curio-builder --driver docker-container --bootstrap`) — the old Mac's builder does not transfer. Always `--platform linux/arm64`. See learnings/docker-hub-push.md.
- **Library data** lives on the NAS (Pi mounts `/mnt/nas/projects/3dprint/models-new`; old Mac used `/Volumes/projects/3dprint/models-new`). Local dev DB `stl-browser.db` is gitignored — copy it or let the API reindex (2-6 min over SMB).
- **Gitignored local files that only existed on the old Mac**: `gallery-dl.conf`, `gallery-dl-images-only.conf` (Patreon download config), `enrich_images.py` (intentionally never committed), `.claude/settings.local.json` (permission allowlist). Copy manually if needed.
- **BROWSERLESS_URL/TOKEN**: never in files; ask Taylor.
- **Working-style feedback** that used to live in the old Mac's machine-local Claude memory is now in `.claude/work/working-style.md` — read it.

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
1. **Confirm the Pi is on the new images**: Taylor was running `docker compose pull && docker compose up -d` on the Pi at handoff (2026-09-23). Confirm with him that it came up healthy.
2. **Restore Patreon scrape prefill**: it is BROKEN — Patreon now 403s plain fetches behind Cloudflare, so /add link-prefill fails loudly (by design, after the blocked-scrape fix). Needs BROWSERLESS_URL + token from Taylor, verification that browserless clears Cloudflare, then `render: true` on the Patreon importer.
3. **Surface `imagesFailed[]` in Add Model UI**: backend populates it correctly (verified live this session); the frontend still never renders it, so image download failures stay invisible.
4. **Old-Mac disk cleanup** (only relevant on the old Mac): ~/Downloads/process/_extracted (~26 GB), original zips (~14 GB), repo-local Nostalgic3D/ (21 GB, NAS copy verified byte-for-byte). Repo-local Gazzaladra/ (14 GB) and KozaDesign/ (574 MB) were NOT verified against the NAS — check before deleting.
