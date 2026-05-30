#!/usr/bin/env python3
"""Download preview images for staging-import models by fuzzy-matching against Thangs data."""

import json
import re
import urllib.request
import urllib.error
from pathlib import Path

STAGING = Path(__file__).parent / "staging-import"
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}


def normalize(name):
    """Normalize a name for fuzzy matching."""
    name = name.lower()
    name = name.replace("-", " ").replace("_", " ")
    name = re.sub(r"[^\w\s]", "", name)
    name = re.sub(r"\s+", " ", name).strip()
    name = re.sub(r"\s*\(.*?\)\s*", " ", name)
    name = re.sub(r"\bv\d+\b", "", name)
    name = re.sub(r"\s+", " ", name).strip()
    return name


def has_preview(model_dir):
    """Check if model directory already has a preview image."""
    return any(f.suffix.lower() in IMAGE_EXTENSIONS for f in model_dir.iterdir() if f.is_file())


def download_image(url, dest_path):
    """Download an image from a URL."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = resp.read()
            dest_path.write_bytes(data)
            return True
    except (urllib.error.URLError, OSError) as e:
        print(f"  FAILED: {e}")
        return False


def get_extension(url):
    """Get file extension from URL."""
    path = url.split("?")[0]
    ext = Path(path).suffix.lower()
    if ext in IMAGE_EXTENSIONS:
        return ext
    return ".jpg"


def match_and_download(creator_dir, image_map, creator_name):
    """Match local model folders to image map entries and download previews."""
    print(f"\n=== {creator_name} ===")

    # Build normalized lookup from image map
    normalized_map = {}
    for thangs_name, url in image_map.items():
        norm = normalize(thangs_name)
        normalized_map[norm] = (thangs_name, url)

    matched = 0
    skipped = 0
    unmatched = []

    for model_dir in sorted(creator_dir.iterdir()):
        if not model_dir.is_dir():
            continue

        if has_preview(model_dir):
            skipped += 1
            continue

        folder_name = model_dir.name
        norm_folder = normalize(folder_name)

        # Try exact normalized match first
        best_match = None
        if norm_folder in normalized_map:
            best_match = normalized_map[norm_folder]
        else:
            # Try substring matching in both directions
            for norm_thangs, (thangs_name, url) in normalized_map.items():
                if norm_folder in norm_thangs or norm_thangs in norm_folder:
                    best_match = (thangs_name, url)
                    break

            # Try word overlap matching
            if not best_match:
                folder_words = set(norm_folder.split())
                if len(folder_words) >= 2:
                    best_score = 0
                    for norm_thangs, (thangs_name, url) in normalized_map.items():
                        thangs_words = set(norm_thangs.split())
                        overlap = len(folder_words & thangs_words)
                        score = overlap / max(len(folder_words), len(thangs_words))
                        if score > best_score and score >= 0.5:
                            best_score = score
                            best_match = (thangs_name, url)

        if best_match:
            thangs_name, url = best_match
            ext = get_extension(url)
            dest = model_dir / f"preview{ext}"
            print(f"  {folder_name} -> {thangs_name}")
            if download_image(url, dest):
                matched += 1
            else:
                unmatched.append(folder_name)
        else:
            unmatched.append(folder_name)

    print(f"  Matched: {matched}, Skipped (has image): {skipped}, Unmatched: {len(unmatched)}")
    if unmatched:
        print(f"  Unmatched folders:")
        for name in unmatched:
            print(f"    - {name}")

    return matched, skipped, unmatched


def main():
    total_matched = 0
    total_unmatched = []

    # 3DDb
    with open(STAGING / "3ddb-images.json") as f:
        images_3ddb = json.load(f)
    m, s, u = match_and_download(STAGING / "3DDb", images_3ddb, "3DDb")
    total_matched += m
    total_unmatched.extend(u)

    # Lofted Goods
    with open(STAGING / "loftedgoods-images.json") as f:
        images_lg = json.load(f)
    m, s, u = match_and_download(STAGING / "Lofted Goods", images_lg, "Lofted Goods")
    total_matched += m
    total_unmatched.extend(u)

    print(f"\n=== TOTAL ===")
    print(f"  Downloaded: {total_matched}")
    print(f"  Still missing: {len(total_unmatched)}")


if __name__ == "__main__":
    main()
