// api/src/addModel.js — helpers for the Add Model flow (slugging, scrape parsing).
import { existsSync } from 'node:fs';
import { join } from 'node:path';

// Upload allowlists, grounded in what the library actually holds (plus .pdf instructions).
// Anything else is rejected server-side — uploads are stored verbatim on the NAS.
export const MODEL_FILE_EXTS = new Set(['.stl', '.3mf', '.obj', '.step', '.stp', '.zip', '.pdf']);
export const IMAGE_FILE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

// Turn a human title into a filesystem-safe folder slug.
export function slugify(str) {
  const s = String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s || 'model';
}

// Pick a directory name under parentDir that doesn't collide, suffixing -2, -3, …
export function uniqueDirName(parentDir, base) {
  if (!existsSync(join(parentDir, base))) return base;
  let n = 2;
  while (existsSync(join(parentDir, `${base}-${n}`))) n++;
  return `${base}-${n}`;
}

// Decode the handful of HTML entities that show up in URL attributes (&amp; chiefly).
function decodeEntities(s) {
  return s
    .replace(/&amp;/gi, '&')
    .replace(/&#0*38;/g, '&')
    .replace(/&#x0*26;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;/g, "'")
    .replace(/&apos;/gi, "'");
}

function parseSrcset(srcset) {
  // "url1 1x, url2 2x" / "url1 320w, url2 640w" → [url1, url2]
  return srcset.split(',').map((part) => part.trim().split(/\s+/)[0]).filter(Boolean);
}

// Extract candidate image URLs from server-rendered HTML, resolved absolute against baseUrl.
// Covers og:image / twitter:image meta tags, <img src|data-src|srcset>, and <source srcset>.
// Does NOT execute JS — lazy/JS-rendered galleries beyond data-src are out of reach (Phase 2).
export function extractImageUrls(html, baseUrl) {
  const found = [];
  const add = (raw) => {
    if (!raw) return;
    const u = decodeEntities(raw.trim());
    if (!u || u.startsWith('data:')) return;
    try {
      const abs = new URL(u, baseUrl).href;
      if (!/^https?:/i.test(abs)) return;
      found.push(abs);
    } catch {
      /* malformed URL — skip */
    }
  };

  let m;
  const metaRe = /<meta\b[^>]*>/gi;
  while ((m = metaRe.exec(html))) {
    const tag = m[0];
    const key = (tag.match(/(?:property|name)\s*=\s*["']([^"']+)["']/i) || [])[1];
    if (key && /^(og:image(:url)?|twitter:image)$/i.test(key)) {
      add((tag.match(/content\s*=\s*["']([^"']+)["']/i) || [])[1]);
    }
  }

  const imgRe = /<img\b[^>]*>/gi;
  while ((m = imgRe.exec(html))) {
    const tag = m[0];
    add((tag.match(/\bsrc\s*=\s*["']([^"']+)["']/i) || [])[1]);
    add((tag.match(/\bdata-src\s*=\s*["']([^"']+)["']/i) || [])[1]);
    const srcset = (tag.match(/\bsrcset\s*=\s*["']([^"']+)["']/i) || [])[1];
    if (srcset) parseSrcset(srcset).forEach(add);
  }

  const sourceRe = /<source\b[^>]*>/gi;
  while ((m = sourceRe.exec(html))) {
    const srcset = (m[0].match(/\bsrcset\s*=\s*["']([^"']+)["']/i) || [])[1];
    if (srcset) parseSrcset(srcset).forEach(add);
  }

  return [...new Set(found)];
}
