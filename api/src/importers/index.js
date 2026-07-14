// Importer registry for the Add Model "start from a link" scrape.
//
// Every page runs through the generic extractor first (Open Graph / Twitter / <title>
// meta + heuristic image scrape). If a per-site importer matches the hostname, it gets
// to REFINE that base result — cleaning titles, deriving the creator, filtering images,
// etc. This is an information scraper, not a downloader: no files are fetched here.
//
// To support a new site, add one file exporting { match(host), refine(html, url, base) }
// and register it below.
import { extractImageUrls, extractPageMeta } from '../addModel.js';
import { patreon } from './patreon.js';

const registry = [patreon];

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
  let host = '';
  try { host = new URL(url).hostname; } catch { /* non-URL — generic only */ }
  const importer = registry.find((imp) => imp.match(host));
  if (!importer) return base;
  return { ...base, ...importer.refine(html, url, base) };
}
