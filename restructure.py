#!/usr/bin/env python3
"""Restructure non-Patreon model folders into the STL Browser format.

Target structure:
  Creator/
    model-slug/
      metadata.md
      *.stl, *.3mf, etc.
      preview.jpg (if available)
"""

import json
import os
import re
import shutil
import zipfile
from pathlib import Path

STAGING = Path(__file__).parent / "staging-import"
DEFAULT_DATE = "2026-05-29"

ATTACHMENT_EXTENSIONS = {
    ".stl", ".zip", ".rar", ".7z", ".3mf", ".obj",
    ".step", ".stp", ".gcode", ".lys", ".chitubox",
}
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
SKIP_FILES = {".DS_Store", "Thumbs.db"}


def sanitize_name(name):
    name = re.sub(r"[^\w\s-]", "", name)
    name = re.sub(r"\s+", "-", name.strip())
    return name.lower()[:80]


def write_metadata(dest, title, creator):
    md = f"""---
title: {json.dumps(title)}
creator: {json.dumps(creator)}
date: {DEFAULT_DATE}
---

# {title}
"""
    (dest / "metadata.md").write_text(md)


def extract_zip(zip_path, dest):
    try:
        with zipfile.ZipFile(zip_path) as zf:
            zf.extractall(dest)
        return True
    except Exception as e:
        print(f"  WARNING: failed to extract {zip_path.name}: {e}")
        return False


def flatten_into(src, dest):
    """Move all files from src (recursively) into dest, flattening subdirs."""
    for item in src.rglob("*"):
        if item.is_file() and item.name not in SKIP_FILES:
            target = dest / item.name
            if target.exists():
                target = dest / f"{item.parent.name}_{item.name}"
            shutil.move(str(item), str(target))


def has_model_files(path):
    """Check if a directory contains any 3D model files."""
    for f in path.rglob("*"):
        if f.is_file() and f.suffix.lower() in ATTACHMENT_EXTENSIONS:
            return True
    return False


def process_flat_creator(creator_path, creator_name):
    """Handle creators where models are loose files/zips at the top level (e.g. 3DDb)."""
    print(f"\n=== Processing flat creator: {creator_name} ===")
    count = 0

    items = list(creator_path.iterdir())
    for item in items:
        if item.name in SKIP_FILES:
            continue

        if item.is_file():
            base_name = item.stem
            slug = sanitize_name(base_name)
            if not slug:
                continue
            model_dir = creator_path / slug

            if item.suffix.lower() == ".zip":
                model_dir.mkdir(exist_ok=True)
                if extract_zip(item, model_dir):
                    item.unlink()
                    pass
                else:
                    shutil.move(str(item), str(model_dir / item.name))
            elif item.suffix.lower() in ATTACHMENT_EXTENSIONS | IMAGE_EXTENSIONS:
                model_dir.mkdir(exist_ok=True)
                shutil.move(str(item), str(model_dir / item.name))
            else:
                continue

            if not (model_dir / "metadata.md").exists():
                write_metadata(model_dir, base_name, creator_name)
                count += 1
        # Directories are already model folders — just add metadata
        elif item.is_dir() and not (item / "metadata.md").exists():
            if has_model_files(item):
                write_metadata(item, item.name, creator_name)
                count += 1

    print(f"  Created {count} metadata files")


def process_subfolder_creator(creator_path, creator_name):
    """Handle creators where models are already in subfolders (e.g. bloblab, Lofted Goods)."""
    print(f"\n=== Processing subfolder creator: {creator_name} ===")
    count = 0

    # First: handle loose files at top level by moving into matching or new folders
    loose_files = [f for f in creator_path.iterdir() if f.is_file() and f.name not in SKIP_FILES]
    for f in loose_files:
        base = f.stem
        # Check if there's a matching subfolder
        matching = None
        for d in creator_path.iterdir():
            if d.is_dir() and d.name.lower().startswith(base.lower()[:10]):
                matching = d
                break
        if matching:
            shutil.move(str(f), str(matching / f.name))
        else:
            slug = sanitize_name(base)
            model_dir = creator_path / slug
            model_dir.mkdir(exist_ok=True)
            shutil.move(str(f), str(model_dir / f.name))

    # Second: remove duplicate zips where extracted folder exists
    for item in list(creator_path.iterdir()):
        if item.is_file() and item.suffix.lower() == ".zip":
            folder_name = item.stem
            matching_folder = creator_path / folder_name
            if matching_folder.is_dir():
                print(f"  Removing duplicate zip: {item.name}")
                item.unlink()
            else:
                # Extract the zip into a folder
                slug = sanitize_name(folder_name)
                model_dir = creator_path / slug
                model_dir.mkdir(exist_ok=True)
                if extract_zip(item, model_dir):
                    item.unlink()

    # Third: add metadata to all model folders
    for item in creator_path.iterdir():
        if item.is_dir() and not (item / "metadata.md").exists():
            if has_model_files(item):
                write_metadata(item, item.name, creator_name)
                count += 1

    print(f"  Created {count} metadata files")


def process_personal(personal_path):
    """Handle Personal creator — flatten nested structures."""
    print(f"\n=== Processing Personal ===")
    count = 0

    for model_dir in list(personal_path.iterdir()):
        if not model_dir.is_dir() or model_dir.name in SKIP_FILES:
            continue

        # Remove any .zip duplicates
        for f in list(model_dir.rglob("*.zip")):
            f.unlink()
            print(f"  Removed zip: {f.name}")

        # Flatten nested subdirectories
        nested_dirs = [d for d in model_dir.iterdir() if d.is_dir()]
        if len(nested_dirs) == 1:
            # Single nested folder — flatten up
            nested = nested_dirs[0]
            flatten_into(nested, model_dir)
            shutil.rmtree(nested)
            print(f"  Flattened: {model_dir.name}")

        # Remove PDFs, LICENSE, README etc — keep model files and images
        for f in list(model_dir.iterdir()):
            if f.is_file() and f.suffix.lower() in {".pdf", ".txt"}:
                f.unlink()

        # Clean up any remaining empty subdirs
        for d in list(model_dir.rglob("*")):
            if d.is_dir() and not any(d.iterdir()):
                d.rmdir()

        if not (model_dir / "metadata.md").exists():
            title = model_dir.name.replace("-", " ").title()
            write_metadata(model_dir, title, "Personal")
            count += 1

    print(f"  Created {count} metadata files")


def process_fractal(fractal_path):
    """Handle fractal — merge sub-variants into model folders."""
    print(f"\n=== Processing fractal ===")
    count = 0

    # Remove the PDF
    for f in fractal_path.iterdir():
        if f.is_file() and f.suffix.lower() == ".pdf":
            f.unlink()

    for item in fractal_path.iterdir():
        if item.is_dir() and not (item / "metadata.md").exists():
            if has_model_files(item):
                write_metadata(item, item.name, "fractal")
                count += 1

    print(f"  Created {count} metadata files")


def main():
    print("Restructuring staging-import into STL Browser format...")

    # 3DDb: flat files
    process_flat_creator(STAGING / "3DDb", "3DDb")

    # bloblab: already subfoldered
    process_subfolder_creator(STAGING / "bloblab", "bloblab")

    # flexi-factory: mixed (subfolders + duplicate zips + loose stls)
    process_subfolder_creator(STAGING / "flexi-factory", "flexi-factory")

    # Lofted Goods: mostly subfoldered, some loose stls
    process_subfolder_creator(STAGING / "Lofted Goods", "Lofted Goods")

    # forgecore: single subfolder
    process_subfolder_creator(STAGING / "forgecore", "forgecore")

    # fractal: two model subfolders + a PDF
    process_fractal(STAGING / "fractal")

    # holidaylights: subfolders + duplicate zips
    process_subfolder_creator(STAGING / "holidaylights", "holidaylights")

    # Personal: nested structures
    process_personal(STAGING / "Personal")

    # Summary
    print("\n=== Summary ===")
    total_models = 0
    for creator_dir in sorted(STAGING.iterdir()):
        if not creator_dir.is_dir() or creator_dir.name in SKIP_FILES:
            continue
        models = [d for d in creator_dir.iterdir() if d.is_dir() and (d / "metadata.md").exists()]
        total_models += len(models)
        print(f"  {creator_dir.name}: {len(models)} models")
    print(f"  TOTAL: {total_models} models")

    # Report models missing preview images
    print("\n=== Models missing preview images ===")
    missing = 0
    for creator_dir in sorted(STAGING.iterdir()):
        if not creator_dir.is_dir():
            continue
        for model_dir in sorted(creator_dir.iterdir()):
            if not model_dir.is_dir():
                continue
            has_image = any(
                f.suffix.lower() in IMAGE_EXTENSIONS
                for f in model_dir.iterdir()
                if f.is_file()
            )
            if not has_image:
                missing += 1
    print(f"  {missing} models missing preview images")


if __name__ == "__main__":
    main()
