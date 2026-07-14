# Open Questions

- Next site importer (2026-07-01): Printables and Thangs are candidates — Taylor to name which is next. Build on the new `api/src/importers/` registry: each importer implements `{ match(host), refine(html, url, base) }`.
- Manual-entry creator snap (2026-07-01): normalized matching sets `creatorFolder` correctly, but typing a creator name manually does NOT rewrite the typed value to the canonical existing name (only the scrape-prefill path snaps it). Typing 'Blob Lab' manually still writes 'Blob Lab' to metadata.md (would fragment the creator vs. existing 'bloblab'); the datalist offers the existing name to pick. Minor — decide later whether to snap manual entry on blur.
- .mp4 (video) uploads (2026-06-10): the upload allowlist currently blocks them (model files limited to stl/3mf/obj/step/stp/zip/pdf). The library has exactly 1 .mp4. Taylor to decide whether to allow video uploads.
- Edit Model UX (2026-06-10, now task #1 in the tracker): confirmed scope is remove-files, metadata edits, and hero/preview-image picking. Design note: indexer already honors `preview:` in metadata.md, so hero-pick = metadata rewrite + single-folder reindex, no schema change. Open: exact UX — inline on the detail page vs a dedicated edit page like /add.

- Hover animations intermittently dead for a few seconds after tabbing back into the browser (2026-06-04, CURIO UI). Verified working in fresh headless Chrome (opacity/scale/border all apply). Suspect browser throttling of background tabs; revisit if it recurs.
- Pi auth topology: TinyAuth fronting port 3000 (multi-user) vs DEFAULT_USER env (single-user) — Taylor to decide at deploy time. Either way port 3001 must stay unpublished.
- ENFILE during indexing: ulimits set to 65536 but indexer could also batch file reads to avoid opening too many at once
- Phase 3 tagging: custom tag system — UI design for tag management, bulk operations? (tag filter row from MANIFOLD handoff intentionally omitted)
- Multi-arch Docker builds: curio-* images are ARM64-only; buildx multi-platform manifest would serve non-Pi users (README currently tells them to build their own)

# Resolved

- Patreon scrape "nothing populated" (title/description/date) — RESOLVED 2026-07-01: ROOT CAUSE was a stale dev API. The dev API runs as plain `node` (no `--watch`) and was started before the backend edit, so the live `/api/scrape-images` served old images-only code. Restarting the API fixed it; the new metadata parser was then verified against real Patreon HTML. Note: Patreon is a JS-rendered SPA, but its SERVER HTML carries full OG/article meta, so a plain fetch works without a headless browser.
- Per-site importers for JS-rendered galleries (from Phase 2 open item) — PARTIALLY RESOLVED 2026-07-01: importer registry architecture now exists (`api/src/importers/`: `index.js` registry + `scrapePage`, `patreon.js`) and the Patreon importer is built and live-verified. Remaining importers (Printables/Thangs) tracked as an open question above.
- Add Model acceptance — RESOLVED 2026-06-10: Taylor walked the flow in-browser, it works; shipped. (Was: built + tested + builds clean but the interactive browser flow was unverified; Taylor to walk it before task #2 marked done.)
- DEPLOY BLOCKER: docker-compose.yml /data:ro — RESOLVED 2026-06-10: dropped :ro, /data mount is now read-write (committed in bfa6314).
- Commit strategy: responsive + Add Model uncommitted on main — RESOLVED 2026-06-10: committed to main as bfa6314 and pushed.
