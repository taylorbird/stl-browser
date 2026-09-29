# Current Work

**Project**: CURIO (containerized web UI for browsing/searching 3D print files from NAS)
**Objective**: Full-stack gallery app (Node/Express API + React/Vite, SQLite+FTS5, Tailwind UI) with multi-user favorites/collections, creator weights, and model upload flow.

**Current Focus (2026-09-23 — MACHINE HANDOFF)**: Work moved off the old Mac to a new machine. Verified: `main` == `origin/main` at b4a1557 (all work committed + pushed). Docker Hub images (curio-api:latest, curio-web:latest, built 2026-08-05, ARM64) postdate the last code change (5cbdf2c), so they are current. CLAUDE.md and .claude/work/working-style.md added to repo so agents have the confirmed working-style rules. Pi pull of new images in progress.

**Last Checkpoint**: 2026-09-29 14:31 PDT

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
- **Working-style rules**: confirmed ones live in .claude/work/working-style.md (repo), not machine-local memory.

## Next Actions
1. **Confirm the Pi is on the new images**: Taylor was running `docker compose pull && docker compose up -d` on the Pi at handoff (2026-09-23). Confirm with him that it came up healthy.
2. **Restore Patreon scrape prefill**: it is BROKEN — Patreon now 403s plain fetches behind Cloudflare, so /add link-prefill fails loudly (by design, after the blocked-scrape fix). Needs BROWSERLESS_URL + token from Taylor, verification that browserless clears Cloudflare, then `render: true` on the Patreon importer.
3. **Surface `imagesFailed[]` in Add Model UI**: backend populates it correctly (verified live this session); the frontend still never renders it, so image download failures stay invisible.
4. **Old-Mac disk cleanup** (only relevant on the old Mac): ~/Downloads/process/_extracted (~26 GB), original zips (~14 GB), repo-local Nostalgic3D/ (21 GB, NAS copy verified byte-for-byte). Repo-local Gazzaladra/ (14 GB) and KozaDesign/ (574 MB) were NOT verified against the NAS — check before deleting.
