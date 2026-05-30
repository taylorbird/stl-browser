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
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

BASE_DIR = Path(__file__).parent
STAGING_DIR = BASE_DIR / "staging"
CONFIG_FILE = BASE_DIR / "gallery-dl.conf"

ATTACHMENT_EXTENSIONS = {
    ".stl", ".zip", ".rar", ".7z", ".3mf", ".obj",
    ".step", ".stp", ".gcode", ".lys", ".chitubox",
}

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}


class HTMLStripper(HTMLParser):
    """Simple HTML-to-text converter."""

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
    """Strip HTML tags, convert br/p to newlines."""
    if not html_str:
        return ""
    s = HTMLStripper()
    s.feed(html_str)
    return s.get_text()


def sanitize_name(name):
    """Strip special chars, replace spaces with hyphens, lowercase, truncate to 80 chars."""
    name = re.sub(r"[^\w\s-]", "", name)
    name = re.sub(r"\s+", "-", name.strip())
    return name.lower()[:80]


def run_gallery_dl(creator_url, simulate=False):
    """Run gallery-dl subprocess to download from Patreon."""
    cmd = [
        "gallery-dl",
        "--config", str(CONFIG_FILE),
    ]
    if simulate:
        cmd.append("--simulate")
    cmd.append(creator_url)

    print(f"Running: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=False)
    if result.returncode not in (0, 4):
        print(f"gallery-dl exited with code {result.returncode}", file=sys.stderr)
        sys.exit(1)
    if result.returncode == 4:
        print("gallery-dl reported partial errors (some files failed) — continuing")


def gather_post_metadata(staging_dir):
    """Read all JSON metadata sidecar files and group by post ID.

    gallery-dl writes metadata as {filename}.{extension}.json next to each file.
    Multiple files from the same post share the same post 'id' in their JSON.
    """
    posts = {}
    for json_file in staging_dir.rglob("*.json"):
        if len(json_file.suffixes) < 2:
            continue
        try:
            with open(json_file) as f:
                meta = json.load(f)
        except (json.JSONDecodeError, UnicodeDecodeError) as e:
            print(f"  Warning: skipping malformed JSON: {json_file}: {e}")
            continue
        if meta.get("category") != "patreon":
            continue
        post_id = str(meta.get("id", ""))
        if not post_id:
            continue
        if post_id not in posts:
            posts[post_id] = {
                "meta": meta,
                "files": [],
            }
        # The JSON sidecar sits next to the actual file.
        # gallery-dl names metadata as filename.ext.json,
        # so foo.stl has foo.stl.json sidecar.
        # json_file.stem gives us "foo.stl" (the actual filename).
        stem = json_file.stem
        parent = json_file.parent
        candidates = [f for f in parent.iterdir() if f.name == stem and f.is_file()]
        if candidates:
            posts[post_id]["files"].append(candidates[0])
    return posts


def has_attachments(files):
    """Return True if any file has an attachment extension (not just images)."""
    return any(f.suffix.lower() in ATTACHMENT_EXTENSIONS for f in files)


def _check_path_traversal(dest_dir, member_name):
    abs_dest = os.path.realpath(dest_dir)
    abs_target = os.path.realpath(os.path.join(dest_dir, member_name))
    if not abs_target.startswith(abs_dest + os.sep) and abs_target != abs_dest:
        raise ValueError(f"Path traversal detected: {member_name}")


def extract_archive(archive_path, dest_dir):
    """Extract archive (.zip, .rar, .7z), keeping the original. Returns True on success."""
    suffix = archive_path.suffix.lower()
    try:
        if suffix == ".zip":
            with zipfile.ZipFile(archive_path) as zf:
                for name in zf.namelist():
                    _check_path_traversal(dest_dir, name)
                zf.extractall(dest_dir)
            return True
        elif suffix == ".rar":
            import rarfile
            rarfile.tool_setup(unar="unar", force=True)
            with rarfile.RarFile(archive_path) as rf:
                for name in rf.namelist():
                    _check_path_traversal(dest_dir, name)
                rf.extractall(dest_dir)
            return True
        elif suffix == ".7z":
            import py7zr
            with py7zr.SevenZipFile(archive_path) as sz:
                for name in sz.getnames():
                    _check_path_traversal(dest_dir, name)
                sz.extractall(dest_dir)
            return True
    except Exception as e:
        print(f"  Warning: failed to extract {archive_path.name}: {e}")
    return False


def pick_preview(dest_dir):
    """Pick the first image file already in dest_dir as the preview."""
    for f in sorted(dest_dir.iterdir()):
        if f.suffix.lower() in IMAGE_EXTENSIONS and f.is_file():
            return f.name
    return None


def _parse_date(raw):
    if isinstance(raw, (int, float)):
        return datetime.fromtimestamp(raw, tz=timezone.utc).strftime("%Y-%m-%d")
    if isinstance(raw, str):
        return raw.split("T")[0].split(" ")[0]
    return str(raw) if raw else ""


def _yaml_escape(val):
    val = str(val)
    if any(c in val for c in ':"{}[]#&*!|>\','):
        return json.dumps(val)
    return val


def write_metadata_md(post_meta, files, preview_name, dest_dir):
    """Write metadata.md with YAML frontmatter and body content."""
    title = post_meta.get("title", "Untitled")
    date = _parse_date(post_meta.get("date", post_meta.get("published_at", "")))
    post_id = post_meta.get("id", "")
    url = post_meta.get("url", post_meta.get("patreon_url", ""))
    content = strip_html(post_meta.get("content", ""))
    creator = (post_meta.get("creator") or {}).get("full_name", "")
    tags = post_meta.get("tags", [])
    tag_str = json.dumps(tags if isinstance(tags, list) else [])

    file_list = "\n".join(f"- {f}" for f in sorted(files))

    md = f"""---
title: {_yaml_escape(title)}
creator: {_yaml_escape(creator)}
date: {date}
patreon_url: {_yaml_escape(url)}
post_id: {post_id}
tags: {tag_str}
---

# {title}

{content}

## Files
{file_list}

## Preview
![preview]({preview_name})
"""
    (dest_dir / "metadata.md").write_text(md)


def organize_downloads(output_dir):
    """Phase 2: Read staging metadata, filter, organize, extract, generate markdown."""
    posts = gather_post_metadata(STAGING_DIR)
    print(f"Found {len(posts)} posts in staging")

    skipped = 0
    processed = 0
    failed = 0

    for post_id, post_data in posts.items():
        meta = post_data["meta"]
        files = post_data["files"]
        title = meta.get("title", "Untitled")

        if not has_attachments(files):
            print(f"  Skipping (no attachments): {title}")
            skipped += 1
            continue

        date_str = _parse_date(meta.get("date", meta.get("published_at", "")))
        folder_name = (
            f"{date_str}-{sanitize_name(title)}" if date_str else sanitize_name(title)
        )
        dest = output_dir / folder_name

        # Idempotent: skip if folder already exists
        if dest.exists():
            print(f"  Already exists, skipping: {folder_name}")
            skipped += 1
            continue

        dest.mkdir(parents=True)
        print(f"  Processing: {folder_name}")

        try:
            for f in files:
                target = dest / f.name
                shutil.move(str(f), str(target))

                if target.suffix.lower() in {".zip", ".rar", ".7z"}:
                    print(f"    Extracting: {f.name}")
                    if extract_archive(target, dest):
                        target.unlink()
                        print(f"    Removed: {f.name}")

            preview_name = pick_preview(dest)

            all_files = sorted(
                f.name for f in dest.iterdir() if f.name != "metadata.md"
            )

            write_metadata_md(meta, all_files, preview_name or "preview.jpg", dest)
            processed += 1
        except Exception as e:
            print(f"  ERROR processing {folder_name}: {e}")
            failed += 1

    print(f"\nProcessed: {processed}, Skipped: {skipped}, Failed: {failed}")

    if failed == 0 and STAGING_DIR.exists():
        shutil.rmtree(STAGING_DIR)
        print("Staging directory cleaned up")
    elif failed > 0:
        print(f"Staging directory kept due to {failed} failures")


def main():
    parser = argparse.ArgumentParser(description="Download Patreon STL files")
    parser.add_argument("url", help="Patreon creator URL")
    parser.add_argument("--simulate", action="store_true", help="Dry run")
    parser.add_argument(
        "--output",
        default=None,
        help="Output directory name (default: creator name from URL)",
    )
    args = parser.parse_args()

    STAGING_DIR.mkdir(exist_ok=True)

    # Phase 1: Download with gallery-dl
    print("=== Phase 1: Downloading with gallery-dl ===")
    run_gallery_dl(args.url, simulate=args.simulate)

    if args.simulate:
        print("Simulate mode — skipping Phase 2")
        return

    # Phase 2: Organize downloads
    creator_name = args.output or args.url.rstrip("/").split("/")[-1]
    output_dir = BASE_DIR / creator_name
    output_dir.mkdir(exist_ok=True)

    print("=== Phase 2: Organizing downloads ===")
    organize_downloads(output_dir)

    print("=== Done ===")


if __name__ == "__main__":
    main()
