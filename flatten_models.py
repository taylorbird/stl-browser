#!/usr/bin/env python3
"""Flatten nested folders inside model directories.

The app is flat-per-model end to end: the indexer only reads top-level files in a model
folder, and the download route can't address subpaths. Creators who ship archives with
internal structure (STL/, 3MF/, Bodies/, STL/Zeek/, ...) therefore produce models whose
files are invisible in the UI. This moves every nested file up to the model root.

Filenames that would collide get their subpath folded into the name, matching what the
Add Model folder-drop already does in the frontend.

Usage:
    ./flatten_models.py bloblab/*/
    ./flatten_models.py --dry-run bloblab/2026-02-20-blob-octopus
"""

import argparse
import re
from pathlib import Path

SKIP_NAMES = {".DS_Store", "__MACOSX", "Thumbs.db"}


def flatten(model_dir, dry_run=False):
    """Move all nested files to model_dir. Returns (moved, renamed, skipped)."""
    moved = renamed = skipped = 0

    # Deepest-first so directories are empty by the time we try to remove them.
    nested_files = sorted(
        (p for p in model_dir.rglob("*") if p.is_file() and p.parent != model_dir),
        key=lambda p: len(p.parts),
        reverse=True,
    )

    for src in nested_files:
        if src.name in SKIP_NAMES:
            if not dry_run:
                src.unlink()
            skipped += 1
            continue

        target = model_dir / src.name
        if target.exists():
            # Fold the subpath in: "STL/Octopus/body.stl" -> "STL_Octopus_body.stl"
            rel_parts = src.relative_to(model_dir).parts
            folded = "_".join(rel_parts)
            target = model_dir / folded
            # Still colliding (same file twice under different trees): number it.
            n = 2
            while target.exists():
                stem, suffix = Path(folded).stem, Path(folded).suffix
                target = model_dir / f"{stem}-{n}{suffix}"
                n += 1
            renamed += 1
            print(f"    collision: {'/'.join(rel_parts)} -> {target.name}")

        if dry_run:
            moved += 1
            continue
        src.rename(target)
        moved += 1

    if not dry_run:
        # Remove the now-empty directory tree, deepest first.
        for d in sorted(
            (p for p in model_dir.rglob("*") if p.is_dir()),
            key=lambda p: len(p.parts),
            reverse=True,
        ):
            try:
                d.rmdir()
            except OSError as e:
                print(f"    Warning: could not remove {d}: {e}")

    return moved, renamed, skipped


def rewrite_file_list(model_dir):
    """Refresh metadata.md's '## Files' section — it was written pre-flatten and is stale.

    The section is part of the markdown body, which the indexer stores as the model's
    `content` and the detail page renders, so a wrong list is user-visible.
    """
    meta = model_dir / "metadata.md"
    if not meta.exists():
        return False
    text = meta.read_text()
    names = sorted(p.name for p in model_dir.iterdir() if p.is_file() and p.name != "metadata.md")
    listing = "\n".join(f"- {n}" for n in names)

    # Replace everything between "## Files" and the next "## " heading (or end of file).
    new_text, count = re.subn(
        r"(## Files\n)(.*?)(?=\n## |\Z)",
        lambda m: m.group(1) + listing + "\n",
        text,
        count=1,
        flags=re.DOTALL,
    )
    if count and new_text != text:
        meta.write_text(new_text)
        return True
    return False


def main():
    parser = argparse.ArgumentParser(description="Flatten nested model folders")
    parser.add_argument("dirs", nargs="+", help="Model folders to flatten")
    parser.add_argument("--dry-run", action="store_true", help="Report without changing anything")
    args = parser.parse_args()

    total_dirs = total_moved = total_renamed = 0

    for d in args.dirs:
        model_dir = Path(d).resolve()
        if not model_dir.is_dir():
            print(f"Skipping (not a directory): {d}")
            continue
        has_nested = any(p.is_dir() for p in model_dir.iterdir())
        if not has_nested:
            continue

        print(f"  {model_dir.name}")
        moved, renamed, skipped = flatten(model_dir, dry_run=args.dry_run)
        if not args.dry_run:
            rewrite_file_list(model_dir)
        print(f"    moved {moved} file(s), {renamed} renamed, {skipped} junk removed")
        total_dirs += 1
        total_moved += moved
        total_renamed += renamed

    verb = "Would flatten" if args.dry_run else "Flattened"
    print(f"\n{verb} {total_dirs} folder(s): {total_moved} files moved, {total_renamed} renamed on collision")


if __name__ == "__main__":
    main()
