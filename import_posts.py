#!/usr/bin/env python3
"""Import specific Patreon posts into the model archive.

download.py crawls a whole creator; this imports an explicit list of posts,
which is what incremental "the creator released 10 new models" pulls need.
Phase 1 runs a single gallery-dl call for all posts, then Phase 2 reuses
download.py's organizer so the output format stays identical.

Usage:
    ./import_posts.py --output KozaDesign 165419978 164654729 ...
    ./import_posts.py --output KozaDesign --simulate <ids...>
    ./import_posts.py --output KozaDesign --dest /Volumes/.../models-new <ids...>
"""

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

import download
from download import BASE_DIR, CONFIG_FILE, STAGING_DIR, organize_downloads

POST_URL = "https://www.patreon.com/posts/{}"


def post_url(ref):
    """Accept a bare post id or a full URL."""
    ref = ref.strip()
    return ref if ref.startswith("http") else POST_URL.format(ref)


def run_gallery_dl(urls, simulate=False):
    """One gallery-dl invocation for every post, so staging is populated once."""
    # Pin staging to an absolute path. The config's base-directory is relative ("./staging"),
    # so without this gallery-dl would write next to the shell's cwd while Phase 2 looks in
    # the repo root — producing a silent "Found 0 posts".
    cmd = ["gallery-dl", "--config", str(CONFIG_FILE), "-o", f"base-directory={STAGING_DIR}"]
    if simulate:
        cmd.append("--simulate")
    cmd.extend(urls)

    print(f"Fetching {len(urls)} post(s) with gallery-dl")
    result = subprocess.run(cmd, capture_output=False)
    # 4 = some files failed (e.g. a single tier-locked attachment); keep going.
    if result.returncode not in (0, 4):
        print(f"gallery-dl exited with code {result.returncode}", file=sys.stderr)
        sys.exit(1)
    if result.returncode == 4:
        print("gallery-dl reported partial errors — continuing")


def copy_to_dest(output_dir, dest_root, created):
    """Copy freshly created model folders to the library (e.g. the NAS)."""
    dest_creator = Path(dest_root) / output_dir.name
    dest_creator.mkdir(parents=True, exist_ok=True)
    for name in created:
        src = output_dir / name
        dst = dest_creator / name
        if dst.exists():
            print(f"  Destination already exists, skipping: {dst}")
            continue
        print(f"  Copying {name} -> {dst}")
        shutil.copytree(src, dst)


def main():
    parser = argparse.ArgumentParser(description="Import specific Patreon posts")
    parser.add_argument("posts", nargs="+", help="Post IDs or full post URLs")
    parser.add_argument(
        "--output",
        required=True,
        help="Creator folder name, e.g. KozaDesign (must match existing folder)",
    )
    parser.add_argument("--simulate", action="store_true", help="Dry run, no downloads")
    parser.add_argument(
        "--dest",
        default=None,
        help="Optional library root to copy new folders into (e.g. the NAS models-new dir)",
    )
    args = parser.parse_args()

    urls = [post_url(p) for p in args.posts]

    STAGING_DIR.mkdir(exist_ok=True)

    print("=== Phase 1: Download ===")
    run_gallery_dl(urls, simulate=args.simulate)

    if args.simulate:
        print("Simulate mode — skipping Phase 2")
        return

    output_dir = BASE_DIR / args.output
    output_dir.mkdir(exist_ok=True)

    before = {p.name for p in output_dir.iterdir() if p.is_dir()}

    print("=== Phase 2: Organize ===")
    organize_downloads(output_dir)

    created = sorted({p.name for p in output_dir.iterdir() if p.is_dir()} - before)
    print(f"\nCreated {len(created)} model folder(s):")
    for name in created:
        print(f"  {name}")

    if args.dest and created:
        print(f"\n=== Phase 3: Copy to {args.dest} ===")
        copy_to_dest(output_dir, args.dest, created)

    print("=== Done ===")


if __name__ == "__main__":
    main()
