# Patreon Bulk Import via gallery-dl + Scripted Tooling

Durable learnings for bulk importing Patreon creator content and hand-delivered archives into CURIO's flat-per-model NAS structure. Session 2026-08-05 imported 124 models across three creators using gallery-dl for Patreon scraping and custom Python scripts for organization.

## gallery-dl Patreon scraping

### Collection URLs are natively supported

Patreon creator pages organize posts into **Collections** (e.g., "Welcome Pack 2026"). gallery-dl supports collection URLs directly:

```
https://www.patreon.com/collection/<collection-id>?view=expanded
```

No special flags or postprocessing needed — pass the URL directly to gallery-dl and it downloads all posts in the collection as separate folders, one per post.

Verified 2026-08-05: three Blob Lab collections (2164454, 1711631, 1688276) each with 10–18 posts downloaded cleanly. Example:

```bash
gallery-dl "https://www.patreon.com/collection/2164454?view=expanded"
```

### --print for inventory, --Print for download

Inventory mode is useful for reconciling what's new without re-downloading. `gallery-dl --print` is a dry-run that shows metadata without downloading, but **still writes JSON sidecars**. A 597-post inventory run left ~597 orphan `.json` files in the staging directory, which later confused the organize script (no real `.zip` or model files next to them).

**Solution**: when doing inventory, use an isolated `-o base-directory` (temp location) to keep sidecars separate from actual downloads:

```bash
gallery-dl --print -o /tmp/inventory-only \
  "https://www.patreon.com/collection/2164454?view=expanded"
```

The capital-letter variant `--Print` (print + download) both shows metadata AND downloads files.

### Per-post inventory format

For a reconciliation workflow (finding which posts are new), use `--print` with a custom output format:

```bash
gallery-dl --print "{id}|{date}|{title}|{filename}.{extension}" \
  "https://www.patreon.com/collection/2164454?view=expanded"
```

This outputs one line per post with ID, date, title, and filename — easy to parse into a Python list of IDs for diffing against the existing DB. This session used `patreon_url` column extraction + regex to get post IDs from already-imported models, then diffed them against the inventory, finding only 10 new posts out of 247 accessible across Koza Design's public posts.

## Handling nested folder structures in bulk downloads

### Archives with nested subfolders must be flattened

Downloaded archives and packs often contain nested folder structures (STL/, 3MF/, Bodies/, Renders/, etc.). CURIO's indexer is **flat-per-model**: it only reads top-level files in each creator/model folder. Files in subfolders are invisible to search and download.

**Flattened before import**: A bulk `flatten_models.py` script recursively walks each model folder, moves all files from subfolders to the top level, and rewrites `metadata.md`'s "## Files" section (which is indexed for search) to reflect the new flat layout.

Files that collide during flattening (same name from different subfolders) are de-duplicated by folding the subfolder path into the filename: `STL/model.stl` + `3MF/model.stl` → `model.stl` + `model-3mf.stl`. No data loss, just a filename change.

This session: 29 of 41 Blob Lab models had nested structure. Example: `Blob_Plants_Desert/STL/Zeek/...` → `Blob_Plants_Desert/...` (Zeek files merged up). Flattened all 29 in one script call.

### Inspecting nested zips without extraction

To see whether an archive contains subfolders without extracting the entire thing:

```bash
unzip -p archive.zip "subarchive.zip" | tar -tf -
```

`unzip -p` pipes the archive member to stdout (no disk write). `tar -tf` on a zip (macOS tar is bsdtar) reads the directory listing. Useful for sanity-checking nested packs before download/import.

## Hand-delivered archive pack imports

### Layout discovery via pattern matching

User-supplied packs have consistent internal structure:

```
Pack_Name/
  Model_1/
    STL/
    3MF/
    LIFESIZE/
  Model_2/
    STL/
    ...
  00_Renders/
    Model_1 front.png
    Model_1 45.png
    ...
```

A bulk `import_local_packs.py` script infers this structure via pattern matching: walks the directory tree, finds a shared "Renders" folder (searches up to 2 parent levels to avoid ambiguity), and fuzzy-matches render filenames to model folders by normalized name (lowercase + alphanumeric only, so "Kif Kroker Chewy" → "kifkrokerchewy" ≈ "Kif Chewbacca" → "kifchewbacca" if within fuzzy-match threshold).

This session: 12 Nostalgic 3D packs, 66 base models, 7 LIFESIZE entries (split into separate model entries) = 73 final models. 69 had a matching render; 4 Young Pokemon had no renders in the pack.

### LIFESIZE entries split into separate models

Some creators ship a model in multiple part sets: a standard "assembled" version and a "LIFESIZE" variant. CURIO models are single-part-set entities (a zip is opaque, no extraction server-side). Splitting into separate models allows each to have its own file list and preview.

Example: "Robot Devil Vader" had 345 files total (both assembled + lifesize). Split into:
- "Robot Devil Vader" (standard, 4 files)
- "Robot Devil Vader Lifesize" (341 files)

Same preview image used for both (fuzzy-matched from pack renders), but now users download only what they need.

## Large NAS copy verification: bytes matter, not folder count

When copying 10+ GB across SMB, mid-transfer failures are possible (session 2026-08-05: 11 GB bloblab transfer dropped with "Socket is not connected"). The obvious check — "do all 41 folders exist?" — passes even if some files are truncated or missing within a folder.

**Byte-level verification required**:

1. Count files and sum total size locally: `find local_model_dir -type f | wc -l` + `du -sh local_model_dir`
2. Count files and sum size on NAS via the same commands
3. Compare **both** totals

Truncation is invisible in folder counts but shows up in byte differences. This session: 6 folders failed verification, including one truncated at 9/14 files and 448/1035 MB (visible only by comparing byte sums, not folder existence).

### cp progress tracking with SIGINFO

`cp` on macOS is slow over SMB and gives no progress feedback. The utility responds to `SIGINFO` (kill -INFO <pid>) by printing its current file and percentage to the task log:

```bash
kill -INFO <cp-pid>
# Output in the running cp terminal: ... Copying large file (48%)
```

Useful for long background copies to confirm the process isn't hung.

## Image pooling: enriching imports with companion post galleries

### Creators split models across two posts

Patreon creators often publish a "release" post (model files + 1 hero photo) and a separate "showcase" post (full photo gallery, same or very similar title, published within a few days). Collection-URL imports fetch only the release-post images, leaving models with a single image each.

Session 2026-08-05: Blob Lab's 41 imported models all had exactly 1 image, despite the creator having uploaded far more photos to Patreon. Investigation found that all 41 release posts had 1 image, but every release post had a companion showcase post with 3-21 images published 0-7 days later.

### Pairing by title + date proximity

To enrich an import without re-downloading model files:

1. **Crawl the creator's page** to fetch all post metadata (ID, title, date, image count).
2. **Extract post IDs from existing metadata.md** — the `post_id:` field records where each model came from.
3. **Pair each imported model to a companion post** using:
   - Title similarity (normalize: lowercase + alphanumeric only, strip suffix noise)
   - Date proximity (select the closest companion post, reject any >45 days away)
   - Rationale: companions publish 0-7 days from release; >45 days is a re-release or a different model

**Critical safeguards discovered via dry-run**:

- **Use date-nearest, NOT most-images**: Blob Lab re-released "Blob Bunny" a year later (post 125792493, 2025-04-02, 12 images) with identical title. Selecting most-images would grab the newer, wrong version. Date-nearest selects the correct original (post 100011633, +1 day, 8 images).
- **Strip title suffixes before matching**: Two models ("Blob Snowflake Ornaments (Bonus)" and "Blob Chocolate Bunny (Bonus)") keep their galleries under suffixed titles. Exact-string matching would have reported them as unmatched. Strip patterns: `(Old)`, `(Bonus)`, `(Beta)`, `(New)`, `(Updated)`, `(Extra)`, `(Part N)` before comparing.
- **Reject pairings >45 days apart**: Safely bounds the search to true companions. This session's 41 models all paired within 7 days; gaps >45 days indicate a re-release or unrelated post.

### Downloading images without re-downloading files

Once pairings are confirmed (including dry-run spot-checks), download images ONLY using gallery-dl's `-o files=images` option:

```bash
gallery-dl -o "files=images" -o "base-directory=/path/to/models" \
  "https://www.patreon.com/posts/123456"
```

This option fetches images only, never re-downloads model files even if they exist in the target folder. 28 duplicates are detected and skipped automatically.

### Preview pinning before bulk indexing

The flat-per-model indexer picks its preview as the first image alphabetically when metadata.md has no explicit `preview:` field. Adding 475 new images to an existing import would silently shuffle nearly every card thumbnail to an arbitrary shot (depending on filename ordering over SMB).

**Solution**: Before reindexing, pin the original release-post hero image as an explicit `preview:` line in metadata.md:

```yaml
---
title: Blob Dim Sum
creator: Blob Lab
preview: Blob-Lab-Dim-Sum11m.jpg
post_id: 123456789
---
```

Verify after reindex that card previews haven't shifted. This session: all 41 models correctly pinned; spot-check on Blob Dim Sum confirmed it still previews the release-post hero.

### Models from /add flow lack post_id

Models created via the Add Model UI don't have a `post_id:` field in metadata.md, so any tooling keyed on post_id will skip them. This session: blob-plants-desert was manually added in a prior session, so it wasn't in the 41-model pairing. Topped up manually from its known companion post (146524585): +18 images, 3→21 total.

This is expected behavior (the /add flow captures URLs but not post IDs from Patreon), but worth noting for future bulk-enrichment scripts — check for models with no post_id and add them manually or extend the tooling to extract post IDs from existing patreon_url fields in metadata.md.

## Future optimization: .3mf slicer previews

Sliced .3mf files embed a slicer plate preview at `Metadata/plate_1.png` inside the archive (a zip). This is a viable fallback source for per-model thumbnails when a creator ships no render images:

```bash
unzip -p model.3mf "Metadata/plate_1.png" > preview.png
```

Young Pokemon models (4 models this session) would have previews if extracted this way. Not yet implemented, but documented as an option for completeness.

## Tooling created this session

Three new scripts at repo root:

1. **import_posts.py** — Takes a list of Patreon post IDs or full post URLs (including collection URLs), makes one gallery-dl call, then reuses the existing `download.py`'s `organize_downloads()` function. **Important**: passes `--output-directory` as an absolute path, because gallery-dl's config uses a relative path (`./staging`), and the script may be run from the repo root — without the absolute path override, gallery-dl looks for `./staging` relative to cwd and silently finds zero posts if cwd != the gallery-dl config dir.

2. **flatten_models.py** — Recursively flattens nested folder structures within model directories, rewrites `metadata.md`'s "## Files" section to match the new flat layout.

3. **import_local_packs.py** — Converts hand-delivered pack archives/folders into CURIO model directories with metadata.md, fuzzy-matches render images to models by name, searches up to 2 parent levels for shared renders (bounded), splits LIFESIZE entries into separate models.

All three integrate with the existing NAS/metadata.md workflow and are version-controlled in the repo for future reuse.
