#!/usr/bin/env python3
"""Import locally-supplied model packs into the library.

Some creators hand over their files directly rather than through Patreon: a set of pack
folders, each containing one folder per model (with STL/, 3MF/, LIFESIZE/ subfolders) and
usually a shared renders folder. This turns that layout into the flat, indexer-compatible
`<creator>/<model>/` + metadata.md shape the app expects.

Layout it expects:
    <pack>/
      00 Renders/            (optional; naming varies: "00 Renders", "01 Renders", ...)
      <Model Name>/
        STL/  3MF/  LIFESIZE/

Rules (chosen with the library owner):
  - title    = "<Model> (<Pack>)" so duplicates across packs stay distinguishable
  - preview  = the model's own render if one matches, else the pack's group image
  - files    = flattened; collisions fold the subpath in (LIFESIZE_foo.stl)

Usage:
    ./import_local_packs.py --creator "Nostalgic 3D" --out ./Nostalgic3D <pack dirs...>
    ./import_local_packs.py --creator "Nostalgic 3D" --out ./Nostalgic3D --dry-run <pack dirs...>
"""

import argparse
import json
import re
import shutil
from datetime import date
from pathlib import Path

MODEL_SUBDIRS = {"stl", "3mf", "lifesize"}
IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".gif"}
JUNK = {".DS_Store", "Thumbs.db", "__MACOSX"}

# Renders that describe the whole pack rather than one model.
GROUP_HINTS = ("group", "logo", "cover", "banner", "thumbnail")


def slugify(name):
    s = re.sub(r"[^\w\s-]", "", name).strip().lower()
    return re.sub(r"[\s_]+", "-", s) or "model"


def norm(name):
    """Loose key for matching a render filename to a model folder name.

    Render names drift from folder names ("Scruffy Obi Wan.png" vs folder "Scruffy Obi-Wan",
    "Zapp Brannigan Han Solo" vs "Zapp Han Solo"), so strip everything but lowercase letters
    and digits before comparing.
    """
    return re.sub(r"[^a-z0-9]", "", name.lower())


def is_model_dir(path):
    """A model folder is one holding STL/ 3MF/ LIFESIZE/ subfolders."""
    if not path.is_dir():
        return False
    return any(c.is_dir() and c.name.lower() in MODEL_SUBDIRS for c in path.iterdir())


def find_renders_dir(pack_dir, max_up=2):
    """Locate the renders folder for a pack.

    Packs aren't consistently shaped: some keep renders beside the model folders, others
    (e.g. "Monthly Mashup Tier August 2026/00 Renders", whose models sit one level deeper
    under "Futurama x Star Wars Pt. 2/") keep them above. Walk up a bounded number of
    levels — unbounded would let one pack borrow a sibling pack's renders.
    """
    current = pack_dir
    for _ in range(max_up + 1):
        for c in sorted(current.iterdir()):
            if c.is_dir() and "render" in c.name.lower():
                return c
        if current.parent == current:
            break
        current = current.parent
    return None


def classify_renders(renders_dir, model_names):
    """Split a pack's renders into {model_name: [files]} plus pack-level group images.

    Matching is by normalized prefix, longest model name first so "Young Bulbasaur" wins
    over a hypothetical "Young" before it.
    """
    per_model = {m: [] for m in model_names}
    group = []
    if not renders_dir:
        return per_model, group

    ordered = sorted(model_names, key=len, reverse=True)
    for f in sorted(renders_dir.iterdir()):
        if not f.is_file() or f.suffix.lower() not in IMAGE_EXTS or f.name in JUNK:
            continue
        key = norm(f.stem)
        hit = next((m for m in ordered if norm(m) and key.startswith(norm(m))), None)
        if hit:
            per_model[hit].append(f)
        elif any(h in f.stem.lower() for h in GROUP_HINTS):
            group.append(f)
        else:
            # Unmatched and not obviously a group shot — treat as pack-level so it's not lost.
            group.append(f)
    return per_model, group


def pick_preview(images):
    """Prefer a front view, then a 45, then whatever sorts first."""
    for want in ("front", "45"):
        for img in images:
            if want in img.stem.lower():
                return img
    return images[0] if images else None


def find_lifesize_dir(model_dir):
    for c in model_dir.iterdir():
        if c.is_dir() and c.name.lower() == "lifesize":
            return c
    return None


def collect_model_files(model_dir, skip_dir=None):
    """Every file under the model folder, flattened, with collision-safe names.

    `skip_dir` excludes a subtree — used to keep the lifesize part sets out of the
    normal-scale model, since they're imported as a separate entry.
    """
    out = {}  # target name -> source path
    for src in sorted(model_dir.rglob("*")):
        if not src.is_file() or src.name in JUNK:
            continue
        if skip_dir and skip_dir in src.parents:
            continue
        name = src.name
        if name in out:
            # Fold the subpath in so e.g. Large Bed / Small Bed parts stay distinguishable.
            rel = src.relative_to(model_dir).parts
            name = "_".join(rel)
            n = 2
            while name in out:
                stem, suffix = Path(name).stem, Path(name).suffix
                name = f"{stem}-{n}{suffix}"
                n += 1
        out[name] = src
    return out


def yaml_str(val):
    return json.dumps(str(val))


def write_metadata(dest, title, creator, when, preview_name, pack, description):
    fm = [
        "---",
        f"title: {yaml_str(title)}",
        f"creator: {yaml_str(creator)}",
        f"date: {when}",
        f"collection: {yaml_str(pack)}",
    ]
    if preview_name:
        fm.append(f"preview: {yaml_str(preview_name)}")
    fm += ["---", "", f"# {title}", "", description, ""]
    (dest / "metadata.md").write_text("\n".join(fm))


def import_pack(pack_dir, out_root, creator, when, dry_run, report):
    models = sorted([p for p in pack_dir.iterdir() if is_model_dir(p)], key=lambda p: p.name)
    if not models:
        return

    pack = pack_dir.name
    renders_dir = find_renders_dir(pack_dir)
    per_model, group = classify_renders(renders_dir, [m.name for m in models])
    group_preview = pick_preview(group)

    print(f"\n{pack}  ({len(models)} models, "
          f"{'renders: ' + renders_dir.name if renders_dir else 'no renders folder'})")

    for model_dir in models:
        images = per_model.get(model_dir.name, [])
        own = pick_preview(images)
        preview_src = own or group_preview
        source = "own render" if own else ("pack group image" if preview_src else "NONE")

        # Lifesize part sets are their own model: they're a different print entirely
        # (hundreds of bed-sized chunks) and merging them buries the normal-scale files.
        lifesize = find_lifesize_dir(model_dir)

        variants = [(
            f"{model_dir.name} ({pack})",
            collect_model_files(model_dir, skip_dir=lifesize),
            f"From the {pack} pack.",
        )]
        if lifesize and any(f.is_file() for f in lifesize.rglob("*")):
            variants.append((
                f"{model_dir.name} Lifesize ({pack})",
                collect_model_files(lifesize),
                f"Lifesize part set from the {pack} pack. "
                f"Bed-size variants are distinguished by filename prefix.",
            ))

        for title, files, description in variants:
            dest = out_root / slugify(title)
            preview_name = preview_src.name if preview_src else None
            if source == "NONE":
                report["no_preview"].append(title)

            model_count = sum(1 for n in files if Path(n).suffix.lower() in
                              {".stl", ".3mf", ".obj", ".step", ".stp"})
            label = title[:len(title) - len(f" ({pack})")]
            print(f"  {label:44} {model_count:3} model files, preview: {source}")

            report["models"] += 1
            if dry_run:
                continue

            dest.mkdir(parents=True, exist_ok=True)
            for name, src in files.items():
                shutil.copy2(src, dest / name)
            for img in images:
                shutil.copy2(img, dest / img.name)
            if preview_src and not (dest / preview_src.name).exists():
                shutil.copy2(preview_src, dest / preview_src.name)

            write_metadata(dest, title, creator, when, preview_name, pack, description)


def main():
    parser = argparse.ArgumentParser(description="Import local model packs")
    parser.add_argument("packs", nargs="+", help="Pack directories")
    parser.add_argument("--creator", required=True, help="Creator display name")
    parser.add_argument("--out", required=True, help="Output creator folder")
    parser.add_argument("--date", default=str(date.today()), help="Date for metadata (YYYY-MM-DD)")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    out_root = Path(args.out).resolve()
    if not args.dry_run:
        out_root.mkdir(parents=True, exist_ok=True)

    report = {"models": 0, "no_preview": []}
    for p in args.packs:
        pack_dir = Path(p).resolve()
        if not pack_dir.is_dir():
            print(f"Skipping (not a directory): {p}")
            continue
        import_pack(pack_dir, out_root, args.creator, args.date, args.dry_run, report)

    print(f"\n{'Would import' if args.dry_run else 'Imported'} {report['models']} model(s)")
    if report["no_preview"]:
        print(f"{len(report['no_preview'])} model(s) with NO preview image:")
        for t in report["no_preview"]:
            print(f"  - {t}")


if __name__ == "__main__":
    main()
