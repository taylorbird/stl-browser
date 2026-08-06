# Constraints Ledger

Durable hard rules with date + rationale. One-liners summarizing these are maintained in current.md for fast session resume.

## Node version: DEFAULT node (v22.x) for API & tests
**Date**: 2026-08-05 (SUPERSEDES earlier fnm v23.6.1 constraint)
**Rationale**: better-sqlite3 native module was recompiled for NODE_MODULE_VERSION 127 = Node 22.x. As of 2026-08-05, deps were reinstalled and API+tests run on the default `node` (v22.23.1). The old constraint (fnm v23.6.1 binary) now FAILS with ERR_DLOPEN_FAILED.
**Status**: ACTIVE. Docker images unaffected — they compile their own node_modules in-image.

## Node version: fnm v23.6.1 constraint (SUPERSEDED)
**Date**: 2026-07-16 — SUPERSEDED 2026-08-05
**Old Rule**: Run API & tests with `fnm v23.6.1 node`, not default v22.x (→ NODE_MODULE_VERSION mismatch)
**Why Superseded**: Deps were reinstalled under Node 22 after 2026-07-16. better-sqlite3 is now built for v22. Using the old fnm binary now fails with ERR_DLOPEN_FAILED.
**Action**: Delete any shell aliases or documentation that mandated fnm v23.6.1; use the default node.

## Docker target: linux/arm64 for Raspberry Pi
**Date**: 2026-06-03
**Rationale**: App deploys to a Raspberry Pi. Images must be built with buildx for linux/arm64 (not amd64). Use a docker-container buildx builder; the default docker driver cannot cross-compile/push multi-platform manifests.

## Vite cwd: must be web/ (not repo root)
**Date**: 2026-06-09
**Rationale**: Vite is started with `npm run dev` from the web/ directory. Bash cwd drifts after `cd api` — must manually `cd web` before running npm (npx --prefix does NOT set cwd correctly for Vite). Also: `npm run build` from web/.

## API port not publicly exposed in deploy
**Date**: 2026-06-04
**Rationale**: Identity is Remote-User header (from TinyAuth, nginx proxy, etc.), which is spoofable. API must never be publicly accessible. nginx in the web container proxies /api internally. Frontend port 3000 fronts with TinyAuth (multi-user) or DEFAULT_USER env (single-user).

## DB filename: stl-browser.db
**Date**: 2026-06-04
**Rationale**: Data continuity with existing Pi data. Do not rename. Path is configured via DB_PATH env (dev: /Users/tbird/dev/3dprint/stl-browser.db; prod: /opt/docker_apps/stlfinder/config/stl-browser.db).

## Dev API is plain node (no --watch): RESTART after backend edits
**Date**: 2026-06-09
**Rationale**: API startup is plain `node api/src/index.js` with no file watcher. After ANY backend change, the live endpoint serves STALE code until the API process is restarted. This masqueraded as parser bugs / feature-not-working when root cause was an un-restarted dev API. Always restart before deeper troubleshooting.

## Never commit real secret values to git-tracked files
**Date**: 2026-06-10
**Rationale**: API tokens (BROWSERLESS_TOKEN), credentials, and other secrets shared in chat stay in conversation/local env only (.env files, compose environment variables, user's secrets management). Never write them into committed files like docker-compose.yml, README.md examples, or .claude/* docs. Use placeholder examples like `change-me`.

## Safety hook blocks rm -rf /...
**Date**: 2026-06-09
**Rationale**: Prevent accidental recursive deletion of critical paths. For targeted folder removal, use `find <path> -depth -delete` instead of `rm -rf`.

## Archives with nested folder structure MUST be flattened before import
**Date**: 2026-08-05
**Rationale**: App is flat-per-model end to end (indexer reads only top-level folder files; download route cannot address subpaths). When importing a zip or downloaded folder with internal structure (e.g., STL/, 3MF/, Bodies/ subdirs), flatten it using flatten_models.py before indexing — otherwise files are invisible to both search and download. Use find | zip to check nested structure; byte-level verification (names + sizes) catches truncation when verifying large NAS copies.

## Creator display name must match library exactly before importing
**Date**: 2026-08-05
**Rationale**: Model creator comes from metadata.md `creator:` field (normalized for matching but stored as-is). A creator name that doesn't match an existing creator surfaces as a DUPLICATE creator in the UI. Before importing a batch (especially from Patreon via gallery-dl), confirm the creator display name matches the library exactly. Example: gallery-dl reports "Blob Lab" but the library has "bloblab" — normalize to match before import. Example #2 (future trap): Patreon account behind "Nostalgic 3D" shows full_name "Dom Master" — future automated Patreon imports will write creator: Dom Master unless overridden, splitting the creator.

## Verify large NAS copies by comparing per-file names AND byte sizes (not folder counts)
**Date**: 2026-08-05
**Rationale**: SMB mounts can drop mid-transfer silently (happened 2026-08-05: 11 GB bloblab transfer, cp failed with "Socket is not connected"). A plain folder-count check PASSES even with truncated files — byte-level comparison is required to detect partial copies. Count files, sum sizes locally vs remote for each folder; a mismatch reveals truncation. cp responds to SIGINFO (kill -INFO <pid>) with progress output to task log.

## Always read actual Vite startup log for port (don't assume 5173)
**Date**: 2026-08-05
**Rationale**: Vite picks the next available port when the default (5173) is occupied. In 2026-08-05 session, campfinder was running on 5173 and Vite picked 5174. Always check the startup log output rather than hardcoding assumptions about port choice.
