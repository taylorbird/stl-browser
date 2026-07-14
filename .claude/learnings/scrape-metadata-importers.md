# CURIO Scrape-Metadata & Per-Site Importers

Durable learnings for CURIO's Add-Model URL-import flow: scraping web page metadata (title/creator/date/description/images) and the per-site importer registry that refines the generic scrape. CURIO = Express API (`api/`) + React/Vite frontend (`web/`).

## Patreon scraping (no headless browser needed)

Patreon post pages are a JS-rendered SPA (Next.js — tags carry `data-next-head`), **but the server HTML from a plain `fetch` with a browser User-Agent already carries full metadata**: Open Graph + Twitter card + `article:*` meta + JSON-LD. So title/description/date/images are all extractable via regex on the fetched HTML — do NOT reach for a headless browser for Patreon.

### Meta field specifics

- `og:title` = `'<post title> | <creator>'` (e.g. `'Earth Zorble | Blob Lab'`). Split `og:title` on `|`; the **last segment is the creator**, the rest is the title.
- `<title>` = `'<post> | Patreon'` (the platform suffix, not the creator).
- `og:site_name` = `'Patreon'` — this is the PLATFORM, not the creator. **Do not use `og:site_name` as the creator.**

### Date

- Patreon exposes `<meta property="article:published_time" content="<ISO8601>">` and JSON-LD `datePublished`.
- The og/twitter cards have NO date field — you must read `article:published_time` or JSON-LD.
- `article:published_time` is a **standard OG-article tag**, so reading it generically benefits many blogs/sites, not just Patreon. Put it in the generic extractor.

### Images

Patreon server HTML contains several image URL kinds:
- Real post media: `c10.patreonusercontent.com/4/patreon-media/p/post/<postid>/...`
- A `/meta-image/post/<id>` thumbnail
- Campaign avatar images: `/p/campaign/<campaignid>/...`

**Filter to real photos by requiring the URL to contain BOTH `patreonusercontent.com` AND `/p/post/`.** Verified against a real page: 9 candidates = 1 meta + 3 campaign + 5 post; the filter keeps the 5 post images.

## Importer architecture (registry pattern)

Lives in `api/src/importers/`. Two layers:

1. **Generic base extractor** — `extractPageMeta` + `extractImageUrls` from `api/src/addModel.js`, returning `{ title, creator: '', date, description, siteName, images }`. Low-level HTML parsers stay in `addModel.js`.
2. **Per-site importers** — each shaped as `{ match(hostname), refine(html, url, base) -> partialOverrides }`.

Flow: `scrapePage(url, html)` runs the generic pass, finds the FIRST importer whose `match(host)` returns true, then merges that importer's `refine()` overrides over the base result.

**Adding a new site = one new file + one registry entry.** The importer layer sits ON TOP of the generic parsers, so existing imports/tests don't break.

## HTML entity decoding

Attribute/meta text contains numeric (`&#39;`), hex (`&#x27;`), AND named (`&amp;`) entities.

- **Decode numeric/hex FIRST** (via `String.fromCodePoint`), THEN named — so a decoded `&` from a named entity isn't re-interpreted as the start of another entity.
- A missed hex-entity case left raw apostrophes (`&#x27;`) in scraped descriptions this session; make sure hex is handled, not just decimal.

## CURIO gotchas

### The dev API runs plain `node` (no `--watch`)

After ANY backend edit you MUST **restart the API** or the running endpoint serves STALE code. This masqueraded as a "parser doesn't work" bug — the parser was correct, the server was old. **Verify a parser change by running it against saved real HTML before assuming the code is wrong.**

### Creator comes from `metadata.md` and dupes if it doesn't match

A model's creator is read from its `metadata.md` `creator:` field — `indexer.js:66`: `creator = fm.creator || folderName`. A creator string that doesn't match an existing creator's name surfaces as a **separate/duplicate creator** in the UI, even if written into the same folder. **Normalize** (lowercase + strip non-alphanumerics) to match e.g. `'Blob Lab'` → existing `'bloblab'` before saving.

## Testing the scraper endpoint locally

Auth is required. `curl` a POST to `/api/scrape-images` with header `Remote-User: tbird` against a real post URL.
