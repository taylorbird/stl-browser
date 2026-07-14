# CURIO Uploads & Gallery

Durable technical learnings for CURIO's add-model upload flow and model-detail gallery. CURIO = Express API (`api/`) + React/Vite frontend (`web/`) over a flat-per-model SQLite/FTS5 library stored on a NAS.

## Browser folder-drop ingest

To accept dropped folders (not just files) in the browser, use `DataTransferItem.webkitGetAsEntry()` inside the drop handler.

- **CRITICAL: read the entries synchronously within the drop event.** `DataTransferItem` entries become invalid after any `await`. Capture all the entry objects first (synchronous loop over `dataTransfer.items`), then walk them asynchronously.
- **Directory readers are batched.** `entry.createReader().readEntries(cb)` returns at most ~100 entries per call. You MUST call it in a loop, accumulating, until it returns an empty batch — otherwise large folders silently truncate.
- The `<input webkitdirectory>` folder picker exposes `file.webkitRelativePath` for each file (the picker's equivalent of the dropped-entry path).

Implemented in `web/src/pages/AddModelPage.jsx`: `filesFromDrop`, `walkEntry`, `readAllEntries`, `mergeFiles`.

## CURIO is flat-per-model, end to end

The library model is flat: each model is a single folder of top-level files. This assumption is baked into multiple layers.

- The indexer `indexFolder` in `api/src/indexer.js` reads ONLY the top-level files of a model folder; it skips subdirectories.
- The download route addresses files by **basename only** and cannot reach subpaths.

Consequences:

- **Dropped folders MUST be flattened.** Subfolder name collisions are resolved by folding the subpath into the filename (so `parts/base.stl` becomes a single top-level entry rather than a nested file).
- **ZIPs are stored opaque** — never extracted or indexed server-side. A zip-only model trips the "missing files" heuristic, which is `lower(files) NOT LIKE '%.stl%'`.
- Real nested-structure support would require coordinated changes across the indexer, the download/preview routes, and the UI — it is not a localized change.

## Upload security model

`multer` with no `fileFilter` / `limits` accepts ANY file type and size by default. Hardening lives in `api/src/routes.js`.

- **fileFilter** checks the extension against `MODEL_FILE_EXTS` / `IMAGE_FILE_EXTS` (exported from `api/src/addModel.js`), keyed by multer field name (`'images'` vs the model-file field).
- **limits.fileSize** comes from the `MAX_UPLOAD_MB` env var (default 2048).
- A wrapper, `parseUpload`, maps multer errors to JSON: `LIMIT_FILE_SIZE` → 413, all other multer errors → 400. On rejection it sweeps multer's temp files so nothing partial reaches the NAS.

Defense-in-depth already present (server never trusts upload content):

- The server NEVER executes or extracts uploads — zips are inert server-side.
- File downloads use `Content-Disposition: attachment`, which defuses stored-HTML/XSS through the download route.
- The preview route serves only indexed images whose extension is in the image allowlist — so no `.svg` preview vector.

**Residual risk is distribution, not server execution**: a trusted user uploading a malicious archive that another user later opens locally. The server itself is not the attack surface.

When changing the allowlist, **validate that the FRONTEND allowlist mirrors the server** — `MODEL_EXT_RE` in `AddModelPage.jsx` must match `MODEL_FILE_EXTS`, so folder drops pre-filter consistently with what the server will accept.

## Flex bento gallery (decoupling hero size from tile size)

Problem: in a CSS-grid bento layout, the hero and side tiles share the same row tracks, so the hero's height is bound to the tile rows. You cannot enlarge the hero without also enlarging the tiles, and top-aligned square tiles leave an empty gap below them.

Solution — switch the layout to flexbox to decouple the two:

- Hero = `flex-[1.7]` with its own `aspect-[4/3]`.
- Side tiles = a `flex-1` container that is itself `grid grid-cols-2 grid-rows-2`, so the 2x2 matrix STRETCHES to fill the (flex-stretched) hero height — eliminating the gap.
- Tiles stay `aspect-square` on mobile and switch to `aspect-auto` at the `≥1180px` breakpoint.

Pattern lives in the gallery section of `web/src/pages/ModelDetailPage.jsx`.
