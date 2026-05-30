#!/usr/bin/env python3
"""Fetch preview images from Patreon creators using gallery-dl, then match to local model folders."""

import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

BASE_DIR = Path(__file__).parent
STAGING_IMAGES = BASE_DIR / "staging-images"
STAGING_IMPORT = BASE_DIR / "staging-import"
CONFIG_FILE = BASE_DIR / "gallery-dl-images-only.conf"

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}

CREATORS = {
    "bloblab": {
        "url": "https://www.patreon.com/bloblab",
        "local_dir": "bloblab",
    },
    "FlexiFactory": {
        "url": "https://www.patreon.com/FlexiFactory",
        "local_dir": "flexi-factory",
    },
}


def normalize(name):
    name = name.lower()
    name = name.replace("-", " ").replace("_", " ")
    name = re.sub(r"[^\w\s]", "", name)
    name = re.sub(r"\s+", " ", name).strip()
    name = re.sub(r"\s*\(.*?\)\s*", " ", name)
    name = re.sub(r"\bv\d+\b", "", name)
    name = re.sub(r"\s+", " ", name).strip()
    return name


def has_preview(model_dir):
    return any(f.suffix.lower() in IMAGE_EXTENSIONS for f in model_dir.iterdir() if f.is_file())


def run_gallery_dl(creator_url):
    """Download images only from a Patreon creator."""
    cmd = [
        "gallery-dl",
        "--config", str(CONFIG_FILE),
        creator_url,
    ]
    print(f"Running: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=False)
    if result.returncode not in (0, 4):
        print(f"gallery-dl exited with code {result.returncode}", file=sys.stderr)
    if result.returncode == 4:
        print("gallery-dl reported partial errors — continuing")


def gather_post_images():
    """Read JSON metadata sidecars and return {post_title: first_image_path}."""
    posts = {}
    for json_file in STAGING_IMAGES.rglob("*.json"):
        if len(json_file.suffixes) < 2:
            continue
        try:
            with open(json_file) as f:
                meta = json.load(f)
        except (json.JSONDecodeError, UnicodeDecodeError):
            continue
        if meta.get("category") != "patreon":
            continue

        title = meta.get("title", "")
        if not title:
            continue

        # The actual image file is the sidecar stem
        image_name = json_file.stem
        image_path = json_file.parent / image_name
        if image_path.exists() and image_path.suffix.lower() in IMAGE_EXTENSIONS:
            if title not in posts:
                posts[title] = image_path

    return posts


def match_and_copy(post_images, local_creator_dir, creator_name):
    """Match Patreon post titles to local model folders and copy first image as preview."""
    print(f"\n=== Matching {creator_name} ===")

    norm_posts = {}
    for title, img_path in post_images.items():
        norm_posts[normalize(title)] = (title, img_path)

    matched = 0
    skipped = 0
    unmatched = []

    for model_dir in sorted(local_creator_dir.iterdir()):
        if not model_dir.is_dir():
            continue
        if has_preview(model_dir):
            skipped += 1
            continue

        norm_folder = normalize(model_dir.name)

        best_match = None
        if norm_folder in norm_posts:
            best_match = norm_posts[norm_folder]
        else:
            for norm_title, (title, img_path) in norm_posts.items():
                if norm_folder in norm_title or norm_title in norm_folder:
                    best_match = (title, img_path)
                    break

            if not best_match:
                folder_words = set(norm_folder.split())
                if len(folder_words) >= 2:
                    best_score = 0
                    for norm_title, (title, img_path) in norm_posts.items():
                        title_words = set(norm_title.split())
                        overlap = len(folder_words & title_words)
                        score = overlap / max(len(folder_words), len(title_words))
                        if score > best_score and score >= 0.5:
                            best_score = score
                            best_match = (title, img_path)

        if best_match:
            title, img_path = best_match
            dest = model_dir / f"preview{img_path.suffix.lower()}"
            shutil.copy2(str(img_path), str(dest))
            print(f"  {model_dir.name} -> {title}")
            matched += 1
        else:
            unmatched.append(model_dir.name)

    print(f"  Matched: {matched}, Skipped: {skipped}, Unmatched: {len(unmatched)}")
    if unmatched:
        print(f"  Unmatched:")
        for name in unmatched:
            print(f"    - {name}")


def main():
    STAGING_IMAGES.mkdir(exist_ok=True)

    for creator_key, info in CREATORS.items():
        print(f"\n{'='*60}")
        print(f"Downloading images for {creator_key}...")
        print(f"{'='*60}")
        run_gallery_dl(info["url"])

    # Gather all downloaded images
    post_images = gather_post_images()
    print(f"\nFound {len(post_images)} posts with images")

    # Match to local folders
    for creator_key, info in CREATORS.items():
        local_dir = STAGING_IMPORT / info["local_dir"]
        if local_dir.exists():
            match_and_copy(post_images, local_dir, creator_key)

    # Cleanup
    if STAGING_IMAGES.exists():
        shutil.rmtree(STAGING_IMAGES)
        print("\nCleaned up staging-images directory")


if __name__ == "__main__":
    main()
