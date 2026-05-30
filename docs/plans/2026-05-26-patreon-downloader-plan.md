# Patreon STL Downloader — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Download all STL/3D-print files from Patreon creator KozaDesign, organized into dated folders with metadata and preview images.

**Architecture:** gallery-dl downloads everything to a flat staging directory with JSON metadata per file. A Python wrapper script reads the metadata, groups files by post, filters out image-only posts, and organizes into the final `KozaDesign/<date>-<title>/` structure with extracted archives and markdown metadata.

**Tech Stack:** gallery-dl (installed), Python 3.10 stdlib (json, zipfile, shutil, subprocess, pathlib, re, html, urllib.request), pip packages: `py7zr`, `rarfile` (for non-zip archives)

---

### Task 1: Install dependencies for archive extraction

**Step 1: Install Python packages and CLI tools**

Run:
```bash
pip3 install py7zr rarfile
brew install unrar
```

Expected: all install successfully. `unrar` is needed by `rarfile` as a backend.

---

### Task 2: Create gallery-dl config

**Files:**
- Create: `gallery-dl.conf`

**Step 1: Write the gallery-dl config file**

```json
{
  "extractor": {
    "patreon": {
      "cookies": ["chrome"],
      "base-directory": "./staging",
      "directory": ["{id}_{title:.80}"],
      "filename": "{filename}.{extension}",
      "files": "images,attachments,postfile",
      "order-posts": "d",
      "postprocessors": [
        {
          "name": "metadata",
          "mode": "json",
          "indent": 2,
          "extension": "json",
          "filename": "{filename}.{extension}",
          "directory": "."
        }
      ]
    }
  }
}
```

Key decisions:
- `directory` uses `{id}_{title:.80}` so each post gets its own subfolder in staging, keyed by post ID (unique, stable) with truncated title for human readability
- `files` includes images (for preview), attachments (STLs/ZIPs), and postfile
- `cookies` reads from Chrome — user must be logged into Patreon in Chrome
- Metadata postprocessor writes a `.json` sidecar for every downloaded file

**Step 2: Verify config works with a dry run**

Run:
```bash
gallery-dl --config gallery-dl.conf --simulate "https://www.patreon.com/c/KozaDesign" 2>&1 | head -30
```

Expected: URLs printed (not downloaded). If you see `no 'session_id' cookie set`, the Chrome cookie extraction isn't working — user needs to log into Patreon in Chrome.

**Step 3: Commit**

```bash
git add gallery-dl.conf
git commit -m "feat: add gallery-dl config for Patreon downloads"
```

---

### Task 3: Write the download script — Phase 1 (gallery-dl invocation)

**Files:**
- Create: `download.py`

**Step 1: Write the script skeleton with gallery-dl invocation**

```python
#!/usr/bin/env python3
"""Download and organize Patreon STL files using gallery-dl."""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import zipfile
from html.parser import HTMLParser
from pathlib import Path
from urllib.request import urlretrieve

BASE_DIR = Path(__file__).parent
STAGING_DIR = BASE_DIR / "staging"
CONFIG_FILE = BASE_DIR / "gallery-dl.conf"

ATTACHMENT_EXTENSIONS = {
    ".stl", ".zip", ".rar", ".7z", ".3mf", ".obj",
    ".step", ".stp", ".gcode", ".lys", ".chitubox",
}

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}


class HTMLStripper(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []

    def handle_data(self, data):
        self.parts.append(data)

    def handle_starttag(self, tag, attrs):
        if tag in ("br", "p"):
            self.parts.append("\n")

    def get_text(self):
        return "".join(self.parts).strip()


def strip_html(html_str):
    if not html_str:
        return ""
    s = HTMLStripper()
    s.feed(html_str)
    return s.get_text()


def sanitize_name(name):
    name = re.sub(r"[^\w\s-]", "", name)
    name = re.sub(r"\s+", "-", name.strip())
    return name.lower()[:80]


def run_gallery_dl(creator_url, simulate=False):
    cmd = [
        "gallery-dl",
        "--config", str(CONFIG_FILE),
    ]
    if simulate:
        cmd.append("--simulate")
    cmd.append(creator_url)

    print(f"Running: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=False)
    if result.returncode != 0:
        print(f"gallery-dl exited with code {result.returncode}", file=sys.stderr)
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Download Patreon STL files")
    parser.add_argument("url", help="Patreon creator URL")
    parser.add_argument("--simulate", action="store_true", help="Dry run")
    parser.add_argument("--output", default=None, help="Output directory name (default: creator name from URL)")
    args = parser.parse_args()

    STAGING_DIR.mkdir(exist_ok=True)

    # Phase 1: Download
    print("=== Phase 1: Downloading with gallery-dl ===")
    run_gallery_dl(args.url, simulate=args.simulate)

    if args.simulate:
        print("Simulate mode — skipping Phase 2")
        return

    # Phase 2: Organize (Task 4)
    creator_name = args.output or args.url.rstrip("/").split("/")[-1]
    output_dir = BASE_DIR / creator_name
    output_dir.mkdir(exist_ok=True)

    print("=== Phase 2: Organizing downloads ===")
    organize_downloads(output_dir)

    print("=== Done ===")


if __name__ == "__main__":
    main()
```

**Step 2: Test that Phase 1 runs**

Run:
```bash
python3 download.py --simulate "https://www.patreon.com/c/KozaDesign"
```

Expected: gallery-dl prints simulated URLs. No files downloaded.

**Step 3: Commit**

```bash
git add download.py
git commit -m "feat: download script Phase 1 — gallery-dl invocation"
```

---

### Task 4: Write Phase 2 — Organize downloads

**Files:**
- Modify: `download.py`

**Step 1: Add the `organize_downloads` function**

This function goes in `download.py` above `main()`:

```python
def gather_post_metadata(staging_dir):
    """Read all JSON metadata files and group by post ID."""
    posts = {}
    for json_file in staging_dir.rglob("*.json"):
        with open(json_file) as f:
            meta = json.load(f)
        post_id = str(meta.get("id", ""))
        if not post_id:
            continue
        if post_id not in posts:
            posts[post_id] = {
                "meta": meta,
                "files": [],
            }
        # The JSON sidecar sits next to the actual file — find the actual file
        actual_file = json_file.with_suffix("")  # remove .json to get e.g. foo.stl
        # gallery-dl names metadata as filename.ext.json
        # so foo.stl has foo.stl.json sidecar
        stem = json_file.stem  # "foo.stl"
        parent = json_file.parent
        candidates = [f for f in parent.iterdir() if f.name == stem and f.is_file()]
        if candidates:
            posts[post_id]["files"].append(candidates[0])
    return posts


def has_attachments(files):
    """Check if any files are downloadable attachments (not just images)."""
    for f in files:
        if f.suffix.lower() in ATTACHMENT_EXTENSIONS:
            return True
    return False


def extract_archive(archive_path, dest_dir):
    """Extract archive, keeping the original."""
    suffix = archive_path.suffix.lower()
    try:
        if suffix == ".zip":
            with zipfile.ZipFile(archive_path) as zf:
                zf.extractall(dest_dir)
            return True
        elif suffix == ".rar":
            import rarfile
            with rarfile.RarFile(archive_path) as rf:
                rf.extractall(dest_dir)
            return True
        elif suffix == ".7z":
            import py7zr
            with py7zr.SevenZipFile(archive_path) as sz:
                sz.extractall(dest_dir)
            return True
    except Exception as e:
        print(f"  Warning: failed to extract {archive_path.name}: {e}")
    return False


def write_metadata_md(post_meta, files, preview_name, dest_dir):
    """Write metadata.md for a post."""
    title = post_meta.get("title", "Untitled")
    date = post_meta.get("date", post_meta.get("published_at", ""))
    if isinstance(date, str) and "T" in date:
        date = date.split("T")[0]
    post_id = post_meta.get("id", "")
    url = post_meta.get("url", post_meta.get("patreon_url", ""))
    content = strip_html(post_meta.get("content", ""))
    creator = post_meta.get("creator", {}).get("full_name", "")

    file_list = "\n".join(f"- {f}" for f in sorted(files))

    md = f"""---
title: "{title}"
creator: {creator}
date: {date}
patreon_url: {url}
post_id: {post_id}
tags: []
---

# {title}

{content}

## Files
{file_list}

## Preview
![preview]({preview_name})
"""
    (dest_dir / "metadata.md").write_text(md)


def download_preview(post_meta, dest_dir):
    """Download the first image or thumbnail as preview."""
    thumb = post_meta.get("thumbnail", {})
    url = None
    if isinstance(thumb, dict):
        url = thumb.get("default_large") or thumb.get("original") or thumb.get("url")
    if not url:
        images = post_meta.get("images", [])
        if images:
            img = images[0]
            url = img.get("download_url") or (img.get("image_urls", {}) or {}).get("default_large")
    if not url:
        return None

    ext = ".jpg"
    if ".png" in url.split("?")[0]:
        ext = ".png"
    preview_path = dest_dir / f"preview{ext}"
    try:
        urlretrieve(url, preview_path)
        return preview_path.name
    except Exception as e:
        print(f"  Warning: failed to download preview: {e}")
        return None


def organize_downloads(output_dir):
    """Phase 2: Read staging metadata, filter, organize, extract, generate markdown."""
    posts = gather_post_metadata(STAGING_DIR)
    print(f"Found {len(posts)} posts in staging")

    skipped = 0
    processed = 0

    for post_id, post_data in posts.items():
        meta = post_data["meta"]
        files = post_data["files"]
        title = meta.get("title", "Untitled")

        if not has_attachments(files):
            print(f"  Skipping (no attachments): {title}")
            skipped += 1
            continue

        # Build folder name
        date_str = meta.get("date", meta.get("published_at", ""))
        if isinstance(date_str, str) and "T" in date_str:
            date_str = date_str.split("T")[0]
        folder_name = f"{date_str}-{sanitize_name(title)}" if date_str else sanitize_name(title)
        dest = output_dir / folder_name

        if dest.exists():
            print(f"  Already exists, skipping: {folder_name}")
            skipped += 1
            continue

        dest.mkdir(parents=True)
        print(f"  Processing: {folder_name}")

        # Move files
        moved_files = []
        for f in files:
            target = dest / f.name
            shutil.move(str(f), str(target))
            moved_files.append(f.name)

            # Extract archives
            if target.suffix.lower() in {".zip", ".rar", ".7z"}:
                print(f"    Extracting: {f.name}")
                extract_archive(target, dest)

        # Download preview
        preview_name = download_preview(meta, dest)

        # Gather all files in dest (including extracted ones)
        all_files = sorted(f.name for f in dest.iterdir() if f.name != "metadata.md")

        # Write metadata
        write_metadata_md(meta, all_files, preview_name or "preview.jpg", dest)
        processed += 1

    print(f"\nProcessed: {processed}, Skipped: {skipped}")

    # Clean up staging
    if STAGING_DIR.exists():
        shutil.rmtree(STAGING_DIR)
        print("Staging directory cleaned up")
```

**Step 2: Test with a single post**

Find one post URL from KozaDesign that has file attachments and test:

```bash
python3 download.py "https://www.patreon.com/posts/SOME-POST-12345"
```

Expected: staging downloads, then organizes into `KozaDesign/<date>-<title>/` with extracted files, preview, and metadata.md.

Check the output:
```bash
find KozaDesign -type f | head -20
cat KozaDesign/*/metadata.md | head -30
```

**Step 3: Commit**

```bash
git add download.py
git commit -m "feat: download script Phase 2 — organize, extract, metadata"
```

---

### Task 5: Test full creator download

**Step 1: Run against the full creator URL**

```bash
python3 download.py "https://www.patreon.com/c/KozaDesign"
```

This will take a while depending on how many posts KozaDesign has. Monitor for:
- Authentication warnings (missing session_id cookie)
- Posts being skipped correctly (image-only)
- Archives extracting properly
- Metadata files being generated

**Step 2: Verify output**

```bash
ls KozaDesign/ | head -20
ls KozaDesign/ | wc -l
find KozaDesign -name "metadata.md" | wc -l
find KozaDesign -name "*.stl" | wc -l
```

**Step 3: Spot-check a few folders**

```bash
ls -la KozaDesign/$(ls KozaDesign | head -1)/
cat KozaDesign/$(ls KozaDesign | head -1)/metadata.md
```

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: complete Patreon STL downloader"
```

---

### Task 6: Handle edge cases from real-world run

After the full download, review and fix any issues that came up:

- Posts where `date` field is in unexpected format
- Filenames with unicode or special chars that caused issues
- Archives that failed to extract (missing format support)
- Posts where metadata JSON structure differed from expected
- Preview images that failed to download (expired tokens)

Fix issues in `download.py` and re-run for any failed posts.

---

## Notes

- **Re-running is safe**: existing folders are skipped (idempotent)
- **gallery-dl handles pagination**: it will traverse all posts automatically
- **Cookie auth**: user must be logged into Patreon in Chrome. If cookies expire mid-download, re-run — it picks up where it left off since existing folders are skipped
- **Archive extraction imports** (`rarfile`, `py7zr`) are lazy — only imported when a `.rar` or `.7z` file is actually encountered, so the script works for zip-only content without those packages
