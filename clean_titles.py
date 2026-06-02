#!/usr/bin/env python3
"""Clean up model titles in metadata.md files on the NAS."""

import re
from pathlib import Path

NAS_DIR = Path("/Volumes/projects/3dprint/models-new")


def clean_title(raw):
    t = raw

    # Strip leading "bonus_" or "Bonus_"
    t = re.sub(r'^[Bb]onus[_\s]+', '', t)

    # Replace underscores and hyphens with spaces
    t = t.replace('_', ' ').replace('-', ' ')

    # Split camelCase / PascalCase boundaries, but only when both sides are 2+ chars
    # e.g. AccessoryPack -> Accessory Pack, but not iPad -> i Pad
    t = re.sub(r'(?<=[a-z]{2})(?=[A-Z][a-z]{2})', ' ', t)

    # Remove version suffixes like v1.0, v2.1, V2, etc. at end or mid-string
    t = re.sub(r'\s*[vV]\d+(\.\d+)*\s*', ' ', t)

    # Collapse multiple spaces
    t = re.sub(r'\s+', ' ', t).strip()

    # Title case, but preserve known acronyms
    acronyms = {'stl', 'usb', 'led', 'pvc', 'lrs', 'srx1', 'f8', 'pi', 'pla', 'abs',
                'xl', 'xxl', 'rgb', '3d', 'all', 'and', 'the', 'to', 'of', 'for', 'with'}
    words = t.split()
    result = []
    for i, w in enumerate(words):
        wl = w.lower()
        # All-caps short words (acronyms) stay uppercase
        if len(w) <= 4 and w.isupper() and len(w) > 1:
            result.append(w)
        # First word always capitalized
        elif i == 0:
            result.append(w.capitalize())
        # Small words lowercase (unless they're the model name)
        elif wl in ('to', 'of', 'for', 'with', 'and', 'the', 'or', 'a', 'an'):
            result.append(wl)
        else:
            result.append(w.capitalize())

    return ' '.join(result)


def process_metadata(md_path):
    text = md_path.read_text(encoding='utf-8')

    # Extract title from frontmatter
    match = re.search(r'^title:\s*["\']?(.+?)["\']?\s*$', text, re.MULTILINE)
    if not match:
        return None, None

    old_title = match.group(1)
    new_title = clean_title(old_title)

    if old_title == new_title:
        return old_title, None

    # Replace title in frontmatter
    new_text = text.replace(f'title: "{old_title}"', f'title: "{new_title}"', 1)

    # Also update the markdown heading if it matches the old title
    new_text = new_text.replace(f'# {old_title}', f'# {new_title}', 1)

    md_path.write_text(new_text, encoding='utf-8')
    return old_title, new_title


def main():
    import sys
    dry_run = '--dry-run' in sys.argv

    changed = 0
    skipped = 0

    for creator_dir in sorted(NAS_DIR.iterdir()):
        if not creator_dir.is_dir():
            continue
        for model_dir in sorted(creator_dir.iterdir()):
            if not model_dir.is_dir():
                continue
            md = model_dir / 'metadata.md'
            if not md.exists():
                continue

            if dry_run:
                text = md.read_text(encoding='utf-8')
                match = re.search(r'^title:\s*["\']?(.+?)["\']?\s*$', text, re.MULTILINE)
                if match:
                    old = match.group(1)
                    new = clean_title(old)
                    if old != new:
                        print(f"  {old}")
                        print(f"  -> {new}")
                        print()
                        changed += 1
                    else:
                        skipped += 1
            else:
                old, new = process_metadata(md)
                if new:
                    print(f"  {old}")
                    print(f"  -> {new}")
                    print()
                    changed += 1
                else:
                    skipped += 1

    print(f"{'Would change' if dry_run else 'Changed'}: {changed}, Unchanged: {skipped}")


if __name__ == '__main__':
    main()
