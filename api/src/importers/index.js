// Importer registry for the Add Model "start from a link" scrape.
//
// Every page runs through the generic extractor first (Open Graph / Twitter / <title>
// meta + heuristic image scrape). If a per-site importer matches the hostname, it gets
// to REFINE that base result — cleaning titles, deriving the creator, filtering images,
// etc. This is an information scraper, not a downloader: no files are fetched here.
//
// To support a new site, add one file exporting { match(host), refine(html, url, base) }
// and register it below. Most sites serve real HTML to a plain fetch (even JS-rendered
// SPAs usually carry OG meta server-side). A site that actively blocks non-browser
// requests (bot-detection challenges) can opt into `render: true` — scrapeUrl() then
// fetches it through a headless browser (browserless.js) instead of plain fetch. This
// is a per-importer setting, not a global one: only sites that actually need it pay the
// extra latency and take on the browserless dependency.
import { extractImageUrls, extractPageMeta } from '../addModel.js';
import { fetchRenderedHtml } from '../browserless.js';
import { patreon } from './patreon.js';
import { thangs } from './thangs.js';

const registry = [patreon, thangs];

function findImporter(url) {
  let host = '';
  try { host = new URL(url).hostname; } catch { /* non-URL — no importer can match */ }
  return registry.find((imp) => imp.match(host));
}

// Generic, site-agnostic extraction. Shape is the contract every importer refines.
function genericParse(url, html) {
  const meta = extractPageMeta(html);
  return {
    title: meta.title,
    creator: '',
    date: meta.date,
    description: meta.description,
    siteName: meta.siteName,
    images: extractImageUrls(html, url),
  };
}

// Parse a fetched page into { title, creator, date, description, siteName, images }.
// `url` should be the FINAL (post-redirect) URL so relative images resolve correctly.
export function scrapePage(url, html) {
  const base = genericParse(url, html);
  const importer = findImporter(url);
  if (!importer) return base;
  return { ...base, ...importer.refine(html, url, base) };
}

const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// Fetch + parse a URL end to end. Routes the fetch itself through browserless when the
// matched importer requires it (render: true); everyone else gets a plain fetch.
export async function scrapeUrl(url) {
  const importer = findImporter(url);
  if (importer?.render) {
    if (!process.env.BROWSERLESS_URL) {
      throw new Error(`Can't fetch ${importer.name || 'this site'} without a configured downloader (BROWSERLESS_URL is not set)`);
    }
    const html = await fetchRenderedHtml(url);
    return scrapePage(url, html);
  }
  const resp = await fetch(url, { headers: { 'User-Agent': BROWSER_UA }, redirect: 'follow' });
  // A blocked request still has a body (a bot-detection challenge page). Parsing it
  // yields a junk "scrape" — e.g. title "Just a moment..." with no images — that looks
  // like success to the caller, so fail loudly instead. A site that starts doing this
  // needs `render: true`, not a silent empty result.
  if (!resp.ok) {
    throw new Error(`Could not fetch page (HTTP ${resp.status}) — the site may be blocking automated requests`);
  }
  const html = await resp.text();
  return scrapePage(resp.url || url, html);
}
