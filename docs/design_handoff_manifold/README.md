# Handoff: MANIFOLD — 3D Print Library UI

## Overview
MANIFOLD is a web app for navigating large libraries of 3D-print files (STLs) collected
from many different creators. This handoff covers the **main library screen**: a persistent
left **sidebar** (navigation + favorites + collections + creators) and a **main content area**
(view header + a "Featured" bento hero + tag filters + a responsive model grid).

The visual direction is **"refined dark"** — true near-black canvas, a single warm amber
accent, `Space Grotesk` for titles, `Space Mono` for metadata/labels, and `Archivo` for body/UI.

## About the Design Files
The files in this bundle are **design references created in HTML/CSS/JS** — prototypes that
show the intended look, layout, and behavior. They are **not production code to copy directly**.

The task is to **recreate these designs in your existing codebase** (React/Vue/Svelte/etc.)
using its established component patterns, styling approach, icon set, and data layer. The HTML
renders cards/sidebars by string-concatenation purely so the prototype stays small — do **not**
mirror that approach; build real components. Treat `manifold.css` as the source of truth for
tokens and visual styling, and the `.html`/`.js` files as the source of truth for structure,
states, and behavior.

Image thumbnails in the prototype are **placeholders** (a tonal duotone panel + a wireframe
glyph + a mono caption). In production these are **real rendered photos of each model** —
swap the placeholder for an `<img>` filling the same frame (`object-fit: cover`).

## Fidelity
**High-fidelity (hifi).** Colors, typography, spacing, radii, and interaction states are final
and intentional. Recreate the UI pixel-closely using your codebase's libraries, then wire it to
real data. Exact token values are in **Design Tokens** below.

---

## Screens / Views

### Screen: Library (All models)
The default landing view. Full-viewport app shell, no page scroll — only the main column scrolls.

**Layout**
- Root: `display: flex; height: 100vh; overflow: hidden`.
- **Sidebar**: fixed `width: 272px`, full height, `border-right: 1px solid --line`, internal
  `padding: 18px 14px`, vertical flex column. Does **not** scroll as a whole; the creators list
  is the flexible/scrolling region.
- **Main**: `flex: 1`, full-height flex column.
  - **Header bar** (`flex: 0 0 auto`): `padding: 18px 30px`, `border-bottom: 1px solid --line`,
    space-between. Left = view title + count; right = sort tabs + divider + "Sync library" button.
  - **Scroll area** (`flex: 1; overflow-y: auto`): `padding: 26px 30px 40px`. Contains the
    Featured hero, the tag row, a "Everything / 1–24 of 1,339" meta row, then the grid.

**Components**

1. **Brand lockup** (sidebar top)
   - Mark: 28×28, `border-radius: 8px`, solid amber (`--accent`); inside it a 45°-rotated
     square outline (`inset: 7px; border: 1.5px solid --accentInk; border-radius: 2px`).
   - Wordmark: text "MANIFOLD", `Space Grotesk` 700, `17px`, `letter-spacing: .15em`.

2. **Search box** (sidebar) — *kept purely for search, by design*
   - `Space`/panel bg, `1px solid --line`, `border-radius: 10px`, `padding: 10px 12px`.
   - Search glyph (16px, `--faint`) + placeholder "Search…" (`13px`, `--faint`) + a `⌘K` kbd hint
     (mono `10px`, bordered `5px` radius).
   - Hover/focus-within: border becomes `--accent`.

3. **Library nav** (sidebar) — list of rows, `gap: 2px`
   - Row: `padding: 9px 11px; border-radius: 9px; gap: 11px`. Icon (17px, `--faint`) +
     label (`Archivo 13.5px`) + right-aligned count (mono `10.5px`, `--faint`).
   - Items: **All models** `1,339` (active), **Recently added** `24`, **Favorites** `32`,
     **Missing files** `7`.
   - Active state `.ni--on`: bg `--accentDim`, label `--text`, icon + count `--accent`.
   - Hover: bg `--panel`, label `--text`.

4. **Collections section** (sidebar)
   - Section label row: mono `10px`, `letter-spacing: .2em`, uppercase, `--faint`, with a small
     "+" add affordance on the right.
   - Rows: color dot (9px circle, per-collection hue) + name (`13.5px`, `--dim`) + count (mono).
     Hover bg `--panel`.
   - Collections: **To print** `42` (hue 28), **Printed** `118` (hue 150),
     **Gift ideas** `16` (hue 45), **Cosplay build** `9` (hue 280).
   - Final row "**New collection**": dashed-border 14px "+" tile + muted label.

5. **Creators section** (sidebar) — the flexible region (`flex: 1`, list scrolls if long)
   - Section label "Creators" + count `10`.
   - Row: 24×24 monogram tile (`--panel2` bg, `1px solid --line`, `border-radius: 6px`,
     mono `9px` initials) + name (`13px`) + model count (mono `10px`).
   - Active `.mk--on`: bg `--panel`, name `--text`.
   - Show first ~4–6, then a "**Show all 10 ›**" link (`12px`, `--accent`).

6. **Owner footer** (sidebar bottom, pinned)
   - `border-top: 1px solid --line`, `padding: 12px 11px 2px`. 24px amber monogram "A" +
     "Library owner" (`13px`, `--dim`) + a settings/sliders glyph pushed right (opacity .6).

7. **Header: view title** — "All models" (`Space Grotesk 600, 19px`) + count "1,339"
   (`--dim`, weight 400).

8. **Header: sort tabs** — segmented text tabs `Shuffle · Newest · Title · Creator`.
   - Tab: `13px`, `--dim`, `padding: 7px 13px; border-radius: 8px`.
   - Active `.tab--on`: bg `--panel`, `--text`, `1px solid --line`.
   - **Single-select**, click switches active.

9. **Header: "Sync library" button** — `.ghostbtn`: `--panel` bg, `1px solid --line`,
   `13px --dim`, `padding: 9px 16px; border-radius: 10px`; hover → text `--text`, border `--accent`.
   (Replaces the old developer-y "Reindex" action.)

10. **Featured hero — BENTO layout** (1 large + 4 small)
    - Preceded by a "Featured" section label (mono, uppercase, `--faint`).
    - Grid: `grid-template-columns: 1.5fr 1fr 1fr; grid-template-rows: 188px 188px; gap: 14px`.
    - **Large card** spans both rows (`grid-row: 1 / 3`): full-height image, bottom gradient
      scrim, overlaid `noun` tag (mono, amber) + title (`Space Grotesk 700, 26px`, white) +
      creator · date + an STL badge.
    - **Four small cards** `.fcard`: full-height image, scrim, top-right STL pill, overlaid
      `noun` tag (mono `9px` amber) + title (`Space Grotesk 600, 14px` white) + creator
      (`11.5px`, white 66%).
    - All cards: image `border-radius: 14px`, `1px solid --line2`; hover scales image `1.05`.
    - **Featured items are RANDOM in production** (not curated). Consider a subtle "shuffle"
      affordance; the label can stay "Featured".

11. **Tag filter row** `.tags2` — pill chips, `gap: 8px`, wrap.
    - Chip: `12.5px --dim`, `--panel` bg, `1px solid --line`, `border-radius: 999px`,
      `padding: 7px 15px`.
    - Active `.tag2--on`: `--accent` bg, `--accentInk` text, no border, weight 600. Single-select.
    - Tags: `All · Functional · Desk · Gridfinity · Flexi · Decor · Keychains · Cosplay`.

12. **Grid meta row** — left "Everything" (mono label) + right "1–24 of 1,339" (mono `11px`, `--faint`).

13. **Model card** `.vcard` (the main grid unit)
    - Container: `--panel2` bg, `1px solid --line2`, `border-radius: 13px`, overflow hidden.
    - **Image** `.vcard-img`: `aspect-ratio: 4 / 3`, image absolutely fills it.
      - **STL pill** top-right: glassy (`rgba(7,8,11,.5)` + `backdrop-filter: blur(6px)`,
        `1px solid rgba(255,255,255,.16)`), mono `10px` white, e.g. "3 STLS" / "NO FILES".
      - **Hover actions** top-left (`.vcard-hov`): two 31px glassy icon buttons — **Download**
        (down-arrow into tray) and **Save/Favorite** (heart). Hidden by default
        (`opacity: 0; translateY(-3px)`), shown on card hover. Button hover → amber bg.
    - **Strip** `.vcard-strip` (`padding: 11px 13px 13px`): title (`Space Grotesk 600, 13px`,
      truncated) then a sub-row: creator (`11.5px --dim`) + date (mono `10px --faint`).
    - Card hover: border → `--line`, image scales `1.05`, hover actions reveal.

14. **Grid** `.v2grid` — `display: grid; grid-template-columns: repeat(auto-fill, minmax(224px, 1fr)); gap: 14px`.
    Auto-fills columns to the available main width.

---

## Interactions & Behavior
- **Sort tabs**: single-select; clicking sets `.tab--on` and re-sorts the grid
  (Shuffle = randomize order; Newest = by date desc; Title = A–Z; Creator = group/sort by creator).
- **Tag chips**: single-select filter; `All` clears. Active chip = amber.
- **Sidebar nav**: single-select; switches the main view (All / Recently added / Favorites / Missing files).
  Each changes the header title + count and the grid's dataset. "Favorites" shows hearted models;
  empty state if none.
- **Collections / Creators rows**: clicking filters the grid to that collection/creator and updates
  the header (e.g. "Studio Loup · 173 models"). "Show all 10 ›" expands the creators list.
- **Card hover**: border highlight, image zoom (`scale(1.05)`, `.4s ease`), reveal Download + Save
  buttons (`opacity` + `translateY`, `.18s`).
- **Save/heart**: toggles the model in Favorites (updates the Favorites count in nav).
- **Featured hero**: randomized selection per load; image hover zoom as above.
- **"+" on Collections / "New collection"**: opens a create-collection flow (name + color).
- **Responsive**: grid auto-fills columns. Below ~1180px main width, the bento can collapse to a
  single column / 2-up small cards. Sidebar may become a drawer on very narrow viewports (not yet designed).

## State Management
- `activeView`: `'all' | 'recent' | 'favorites' | 'missing' | {collection:id} | {creator:id}` — drives header + dataset.
- `activeSort`: `'shuffle' | 'newest' | 'title' | 'creator'`.
- `activeTag`: tag string or `'All'`.
- `favorites`: Set of model ids (persisted). Drives the heart state + Favorites count.
- `collections`: list of `{ id, name, hue, modelIds[] }`.
- `featured`: array of model ids chosen at random on load (or on shuffle).
- `creatorsExpanded`: boolean for "Show all".
- Data: a `models` collection (`{ id, title, creator, date, fileCount, thumbnailUrl, tags[] }`)
  and a `creators` collection (`{ id, name, monogram, modelCount }`). The prototype's `MODELS` /
  `CREATORS` arrays in `screen.js` show the shape.

## Design Tokens
Refined-dark theme (set as CSS custom properties on the app root in `manifold.css`):

| Token | Value | Use |
|---|---|---|
| `--bg` | `#0b0c10` | App canvas (true near-black) |
| `--panel` | `rgba(255,255,255,.045)` | Inputs, buttons, hover, active tab |
| `--panel2` | `rgba(255,255,255,.025)` | Card backgrounds, monogram tiles |
| `--text` | `#f3f4f7` | Primary text |
| `--dim` | `rgba(243,244,247,.52)` | Secondary text |
| `--faint` | `rgba(243,244,247,.32)` | Tertiary text, icons, mono meta |
| `--line` | `rgba(255,255,255,.09)` | Primary borders/dividers |
| `--line2` | `rgba(255,255,255,.05)` | Card borders (subtler) |
| `--accent` | `#e7b15a` | Amber accent (active, badges, links) |
| `--accentInk` | `#1c1505` | Text/ink on top of amber |
| `--accentDim` | `rgba(231,177,90,.16)` | Active nav bg, STL badge bg |

**Typography**
- Display/titles: **Space Grotesk** (600–700). View title 19px; card title 13px; small featured 14px; large featured 26px.
- UI/body: **Archivo** (400–600). Nav labels 13.5px; tabs/tags ~12.5–13px.
- Metadata/labels: **Space Mono** (400/700). Counts ~10–10.5px; section labels 10px uppercase `letter-spacing: .2em`; STL pills 10px.

**Spacing** — app padding 18–30px; card gap 14px; sidebar row padding `9px 11px`; card radius 13px; sidebar/control radius 8–10px; pills 999px.

**Radii** — pill `999px`; cards `13–16px`; controls `8–12px`; small tiles `6–8px`.

**Shadows** — minimal. Image inset shadow `inset 0 -40px 60px -30px rgba(0,0,0,.4)`; scrim gradients on featured cards; tooltip `0 8px 24px rgba(0,0,0,.4)` (icon rail variant).

**Icons** — simple 1.5px-stroke line icons (grid, clock, heart, alert/triangle, users, layers, sliders, search, plus, check, chevrons, download, box). Use your codebase's icon set (Lucide/Phosphor map cleanly).

## Assets
- **No bitmap assets** in the prototype. Model thumbnails are CSS placeholders — replace with real
  rendered model photos (`<img>` with `object-fit: cover`, same frame + radius).
- **Fonts**: Space Grotesk, Space Mono, Archivo (Google Fonts). Self-host or include via your pipeline.
- **Brand mark** is pure CSS (amber rounded square + rotated outline) — reproduce as a small
  component or export an SVG.

## Files
Included in this bundle (design references):
- `MANIFOLD App.html` — the full assembled screen (sidebar + main). **Start here.**
- `manifold.css` — all tokens + component styles. The styling source of truth.
- `screen.js` — content data (`CREATORS`, `MODELS`) and the render functions for the main column,
  cards, featured/bento hero, and tag row. Shows structure + data shape.
- `sidebars.js` — sidebar variants; the app uses `stdSection` (Direction A: nav + Favorites +
  Collections + Creators). Other variants are exploration only.

To preview the reference: open `MANIFOLD App.html` in a browser (the three files must sit together).
