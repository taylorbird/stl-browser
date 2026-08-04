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

## Thangs scraping (requires a real browser)

Unlike Patreon, Thangs.com fully blocks plain HTTP fetches with a **Cloudflare managed challenge (Turnstile)** — verified via `curl`: HTTP 403, a "Just a moment..." challenge shell, and zero real page content (not even a JS-shell with OG meta). This is a different failure mode than "JS-rendered SPA": no regex on the fetched HTML can help, because the fetch never receives the site's HTML at all, only Cloudflare's challenge page.

### Diagnosing a Cloudflare challenge vs. a real JS-shell

Before concluding a site needs a headless browser (or that headless won't work), **check the response size and `<title>` first**:
- Challenge page: title "Just a moment...", tiny response (~5.8KB), references to `cf_chl` scripts.
- Real JS-shell (e.g. Patreon): full-size response with OG/meta tags already populated server-side.

### Getting past it: browserless + stealth mode

A self-hosted browserless instance's `/content` endpoint took three attempts:
1. Plain `/content` (no stealth) → still returned the Cloudflare challenge shell. A vanilla headless Chromium is detected just like `curl`.
2. `/content` with `waitForTimeout: 10000` + `gotoOptions: {waitUntil: 'networkidle2'}` → still the challenge shell. Waiting longer doesn't help if the browser fingerprint itself is what's flagged.
3. `/content?stealth=true` → success. Returned the full client-rendered page (~2MB vs ~5.8KB for the challenge), past Turnstile. The `stealth` flag patches common headless-detection vectors (e.g. `navigator.webdriver`) — that's what actually fixed it, not longer waits.

**Lesson:** try `stealth=true` (or the equivalent stealth-plugin mode) before concluding a headless-browser approach can't get through a bot-blocked site. A non-stealth headless fetch can look identical to a bot-detection failure.

### Meta field specifics

- `og:title` = `'<model title> - 3D model by <creator> on Thangs'`. Regex-split on `by ... on Thangs$`, taking the trailing segment as creator — same idea as Patreon's `|`-split, different delimiter.
- **Publish date is not in any OG/meta tag.** It's embedded in a Next.js `__NEXT_DATA__` `<script>` JSON blob, at `props.pageProps.fallback["v4/models/{modelId}/stats"].published` (ISO 8601). `modelId` is the trailing number in the URL slug (e.g. `.../The%20Rail%20v2-1397922` → `1397922`) — extract it from the URL via regex, not from the HTML.

### Image scoping: filter by alt text, not class names

The rendered page has ~250+ `<img>` tags: the model's own hero + gallery thumbnails are mixed in with an unrelated "More models" recommendation carousel and small avatar icons. Reliable filter (verified against a real page and cross-checked against a UI screenshot): **exact match on `alt="<model title> 3d model"`.** Recommendation-card images carry THEIR OWN model's title as alt text, so this filter naturally excludes them with no class-name or DOM-position heuristics needed — those would be fragile, since Next.js build-hashed class names (e.g. `ModelThumbnail_img-0-2-360`) can change between deploys, while alt text tied to the model title is stable.

Thangs proxies all images through Next/Image: `/_next/image?url=<url-encoded-origin-url>&w=<width>&q=<quality>`. To get the real asset URL (e.g. for downloading), decode the `url` query param back out rather than using the proxy URL directly.

**Alt-text exact match is necessary but not sufficient — Thangs also reuses the same alt text for its own auto-generated preview.** Live-page verification (not just the unit-test HTML fixture) turned up a second `<img>` that exactly matches `alt="<model title> 3d model"`: Thangs' own 3D-viewer preview thumbnail, rendered via a reused `ModelThumbnail` component elsewhere on the page. It passes the alt filter but is not a real designer-uploaded photo (it also happened to be a 404 in the session that found it, which is what made it noticeable — but the real problem is it's the wrong *kind* of image regardless of link health). The two classes differ in URL origin bucket: real gallery photos live under `storage.googleapis.com/production-thangs-public/uploads/attachments/...`, while the auto-generated preview lives under `storage.googleapis.com/thangs-thumbnails/production/...`. **Fix:** after the alt-text match, additionally exclude any URL containing `/thangs-thumbnails/`.

General lesson for future per-site importers: a single exact-match filter (alt text, class name, any one attribute) can look airtight because it correctly excludes the *obvious* false positives (e.g. unrelated recommendation-carousel images with a different alt) while still passing a same-labeled decorative/auxiliary element elsewhere on the page. If an attribute is reused for more than one purpose on a real page (thumbnails, avatars, previews), a second signal is usually needed to fully disambiguate — URL path/bucket/domain is often reliable since site-generated assets and user-uploaded content tend to be served from different storage locations. This class of bug is invisible in a synthetic HTML fixture that only encodes the "obvious" false positive — it surfaces only when checked against the real, live page.

### Downloading scraped images: don't reject on Content-Type alone

`downloadImage()` in `api/src/routes.js` (used during Add Model, after images are scraped/selected) previously rejected any response whose `Content-Type` didn't start with `image/`. This silently broke **every** Thangs image: Thangs' gallery images are hosted on Google Cloud Storage (`storage.googleapis.com/production-thangs-public/...`) and are served with `Content-Type: application/octet-stream`, not `image/*`. The create endpoint does surface an `imagesFailed[]` array on this kind of failure, but the frontend never displays it — so from the user's side it just looked like "images didn't save," with no visible error to point at the real cause.

**Fix — accept the response when EITHER is true, only reject when neither is:**
- `Content-Type` starts with `image/`, OR
- the URL path ends in a known image extension (`.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`)

This matches the codebase's existing extension-based philosophy elsewhere (file-type labels are already extension-based, not content-sniffed — see the importer architecture below), so it's consistent rather than a one-off special case for Thangs.

Also **`decodeURIComponent` the filename derived from the URL.** Scraped image URLs are percent-encoded and can contain arbitrary original filenames — e.g. a real Thangs URL decoded to `Rail v2 - v1 copy.MOV.gif` (with a literal space encoded as `%20`). Using the raw (still-encoded) URL segment as the saved filename leaves `%20` etc. baked into the stored file name.

**Regression test:** `api/src/routes.test.js` spins up a local HTTP server that serves an image with `Content-Type: application/octet-stream`, POSTs to `/api/models` with that URL as `imageUrl`, and asserts the file is saved to disk and usable as the model's preview.

**General lesson:** when a "download/fetch this URL" helper gates on `Content-Type`, check whether the real hosting backend for that content (CDN, object storage bucket, etc.) actually sets a semantically-correct content-type — object storage in particular often serves everything as `application/octet-stream` regardless of the actual file type. A content-type check alone is not a reliable image/non-image discriminator; corroborate with the URL/file extension.

## Importer architecture (registry pattern)

Lives in `api/src/importers/`. Two layers:

1. **Generic base extractor** — `extractPageMeta` + `extractImageUrls` from `api/src/addModel.js`, returning `{ title, creator: '', date, description, siteName, images }`. Low-level HTML parsers stay in `addModel.js`.
2. **Per-site importers** — each shaped as `{ match(hostname), refine(html, url, base) -> partialOverrides }`.

Flow: `scrapePage(url, html)` runs the generic pass, finds the FIRST importer whose `match(host)` returns true, then merges that importer's `refine()` overrides over the base result.

**Adding a new site = one new file + one registry entry.** The importer layer sits ON TOP of the generic parsers, so existing imports/tests don't break.

### Per-importer `render` flag for browser-dependent sites (not a global fetch-mode switch)

Some sites (Thangs) need a real, stealth-mode browser to fetch at all (see above); most (Patreon, generic fallback) work fine with plain `fetch()`. The design deliberately keeps this **opt-in per importer, not a global config toggle** — explicit user requirement: "I don't want to use browserless for an importer unless we have to so I'm thinking we need per-importer settings."

Implementation: an importer that needs a real browser sets `render: true` on its exported object (see `api/src/importers/thangs.js`). `api/src/importers/index.js` exports a `scrapeUrl(url)` orchestrator that checks `findImporter(url)?.render` and only routes through the heavier browserless path when the matched importer opted in — everything else keeps using the fast plain-`fetch()` path with zero added latency or external-service dependency.

**When adding a future importer that also needs a real browser, set `render: true` on it — don't touch the fetch logic for anyone else.**

## HTML entity decoding

Attribute/meta text contains numeric (`&#39;`), hex (`&#x27;`), AND named (`&amp;`) entities.

- **Decode numeric/hex FIRST** (via `String.fromCodePoint`), THEN named — so a decoded `&` from a named entity isn't re-interpreted as the start of another entity.
- A missed hex-entity case left raw apostrophes (`&#x27;`) in scraped descriptions this session; make sure hex is handled, not just decimal.

## Attribute-value extraction: use a backreference for the quote char, never `["']([^"']+)["']`

`api/src/addModel.js` (and by extension `api/src/importers/thangs.js`, which reused the same pattern shape) previously extracted HTML attribute values with regexes like `` /content\s*=\s*["']([^"']+)["']/i ``. This looks fine but is wrong: `[^"']` excludes **both** quote characters from the captured group, not just the one that opened the attribute. If the actual value contains the *other* quote character — e.g. a double-quoted attribute whose text has a literal apostrophe, `content="I've had a great time"` — the match silently truncates at that character with no error. Live-tested case: a scraped `og:description` was truncated from a full sentence down to just `"I"` (everything up to the apostrophe in "I've"). Apostrophes are extremely common in real prose (contractions, possessives), so this bug risks silently corrupting scraped titles/descriptions/alt-text on many real pages, not just Thangs — it's not a Thangs-specific issue, it's a latent bug in the shared HTML-parsing primitive.

**Fix:** match whichever quote character actually opens the attribute via a capture group, then require the same character (backreference) to close it, with a negative lookahead so the value can contain the *other* quote freely:
```
`${namePattern}\\s*=\\s*(["'])((?:(?!\\1)[\\s\\S])*)\\1`
```
Group 1 is the opening quote (`"` or `'`), group 2 is the value. This was implemented as a shared exported helper `attrValue(tag, namePattern)` in `api/src/addModel.js`. **This should be the only way any importer/scraper code in this repo extracts an HTML attribute value — never hand-roll `["']([^"']*)["']` again**; route new extraction through `attrValue`.

## CURIO gotchas

### The dev API runs plain `node` (no `--watch`)

After ANY backend edit you MUST **restart the API** or the running endpoint serves STALE code. This masqueraded as a "parser doesn't work" bug — the parser was correct, the server was old. **Verify a parser change by running it against saved real HTML before assuming the code is wrong.** Reconfirmed when adding the Thangs importer: new browserless env vars and route code weren't picked up until the dev API was restarted.

### Check optional-dependency preconditions once, at the entry point — and don't let route error-wrapping swallow specific messages

browserless is only needed by importers that set `render: true` (currently just Thangs) — most scraping paths never touch it. `api/src/importers/index.js`'s `scrapeUrl(url)` orchestrator checks the precondition (the browserless env var is configured) **once, up front**, before attempting any network call — not deep inside the function that does the actual fetch. This gives a fast, clear failure (e.g. "can't fetch Thangs without a configured downloader") with no wasted round-trip, for the one code path that needs it.

Separately, a real bug was found where that specific error still never reached the user: `api/src/routes.js`'s `POST /api/scrape-images` route wraps **every** caught error into a generic `{ error: 'Could not fetch page', detail: err.message }`, but the frontend (`web/src/pages/AddModelPage.jsx`) only reads/displays `res.error` — it never looks at `res.detail`. So a correct, specific error thrown deep in the call chain was silently discarded before the user ever saw it, replaced by the generic message. **General lesson: when adding a more specific error message anywhere in a call chain, trace it all the way to where it's actually rendered to the user** — a correct `throw` can still be invisible if something upstream re-wraps or drops the field it's carried in.

### Creator comes from `metadata.md` and dupes if it doesn't match

A model's creator is read from its `metadata.md` `creator:` field — `indexer.js:66`: `creator = fm.creator || folderName`. A creator string that doesn't match an existing creator's name surfaces as a **separate/duplicate creator** in the UI, even if written into the same folder. **Normalize** (lowercase + strip non-alphanumerics) to match e.g. `'Blob Lab'` → existing `'bloblab'` before saving.

## Testing the scraper endpoint locally

Auth is required. `curl` a POST to `/api/scrape-images` with header `Remote-User: tbird` against a real post URL.
