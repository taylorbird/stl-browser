# Patreon STL Downloader — Design

## Goal

Download all STL files and assets from a Patreon creator (KozaDesign) using a paid membership, organized into a browsable local archive with metadata.

## Architecture

Two-phase approach: gallery-dl handles downloading, a Python wrapper script organizes the output.

### Phase 1 — gallery-dl

- Authenticate via `--cookies-from-browser chrome`
- Download all posts from the creator to a `staging/` directory
- Write per-post JSON metadata (`--write-metadata`)
- Flat staging structure for post-processing

### Phase 2 — Python wrapper (`download.py`)

- Read each post's JSON metadata from staging
- Skip posts with no downloadable attachments (image-only posts like spoiler alerts)
- Create final folder: `KozaDesign/<YYYY-MM-DD>-<sanitized-title>/`
- Move files into place
- Extract archives (ZIP, RAR, 7z) — keep originals alongside extracted files
- Download preview image (thumbnail from metadata)
- Generate `metadata.md` per model
- Clean up staging

## File Structure

```
/Users/tbird/dev/3dprint/
├── download.py              # Wrapper script
├── gallery-dl.conf          # gallery-dl config for Patreon
├── staging/                 # Temp area (cleaned after each run)
└── KozaDesign/
    ├── 2024-03-15-space-rover-collection/
    │   ├── metadata.md
    │   ├── preview.jpg
    │   ├── space-rover-body.stl
    │   ├── space-rover-wheels.stl
    │   └── Space_Rover_Collection.zip
    └── ...
```

## metadata.md Format

```markdown
---
title: "Post Title"
creator: KozaDesign
date: YYYY-MM-DD
patreon_url: https://www.patreon.com/posts/...
post_id: 12345
tags: []
---

# Post Title

Original post content (HTML stripped).

## Files
- file1.stl
- file2.stl
- original.zip

## Preview
![preview](preview.jpg)
```

## Filtering Logic

Skip posts where no files have attachment-type extensions (.stl, .zip, .rar, .7z, .3mf, .obj, .step, .stp). Posts with only .jpg/.png (spoiler/teaser posts) are skipped.

## Edge Cases

- **Duplicate runs**: Skip folders that already exist (idempotent)
- **Archive formats**: ZIP, RAR, 7z — extract and keep originals
- **Filename sanitization**: Strip special chars, lowercase, hyphens for spaces, handle unicode
- **Authentication**: Relies on Chrome cookies; fails clearly if not logged in

## Implementation Steps

1. Create `gallery-dl.conf` with Patreon-specific settings (directory structure, metadata output, cookie source)
2. Write `download.py` Phase 1: invoke gallery-dl, download to staging
3. Write `download.py` Phase 2: read metadata, filter, organize, extract, generate markdown
4. Test with a single post URL first
5. Run against full creator URL
