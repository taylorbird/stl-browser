// Thangs model-page importer. Thangs sits behind a Cloudflare managed challenge that
// blocks plain HTTP fetches outright (no content at all, not even a JS shell) — this
// importer sets `render: true` so the fetch layer (importers/index.js) routes it
// through a headless browser (browserless.js) instead of a plain fetch. The rendered,
// post-challenge page carries full OG meta (title/description/image) plus an embedded
// Next.js __NEXT_DATA__ JSON blob that has the model's publish date.
import { decodeEntities, attrValue } from '../addModel.js';

export const thangs = {
  match: (host) => /(^|\.)thangs\.com$/i.test(host),
  name: 'Thangs',
  render: true,

  refine(html, url, base) {
    const out = {};

    // og:title is "<title> - 3D model by <creator> on Thangs".
    const m = (base.title || '').match(/^(.*) by (.+) on Thangs$/i);
    if (m) {
      out.creator = m[2].trim();
      out.title = m[1].replace(/\s*-\s*3D model$/i, '').trim();
    }

    // Publish date isn't in any OG/meta tag — it lives in the embedded Next.js data
    // cache, keyed by the model id (the trailing number in the URL slug).
    const idMatch = url.match(/-(\d+)\/?(?:[?#].*)?$/);
    if (idMatch) {
      const nextData = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
      if (nextData) {
        try {
          const data = JSON.parse(nextData[1]);
          const stats = data?.props?.pageProps?.fallback?.[`v4/models/${idMatch[1]}/stats`];
          if (stats?.published) out.date = stats.published.slice(0, 10);
        } catch { /* malformed/absent — leave date as the generic pass found it */ }
      }
    }

    // The hero + left thumbnail strip are the only <img> elements whose alt text is
    // "<title> 3d model" — every other image on the page (related-model recommendation
    // cards, avatars) carries a DIFFERENT title as its alt, so this filter is exact
    // rather than heuristic. Next/Image proxies real assets through
    // /_next/image?url=<encoded-origin-url>; decode that back to the origin.
    const galleryTitle = (out.title || base.title || '').trim();
    if (galleryTitle) {
      const wanted = `${galleryTitle} 3d model`.toLowerCase();
      const images = [];
      const imgRe = /<img\b[^>]*>/gi;
      let im;
      while ((im = imgRe.exec(html))) {
        const tag = im[0];
        const altRaw = attrValue(tag, '\\balt') || '';
        if (decodeEntities(altRaw).toLowerCase() !== wanted) continue;
        const srcRaw = attrValue(tag, '\\bsrc');
        if (!srcRaw) continue;
        const src = decodeEntities(srcRaw);
        let real = src;
        try {
          const proxied = new URL(src, url);
          const inner = proxied.searchParams.get('url');
          if (inner) real = inner;
        } catch { /* not a proxied/absolute URL — use as-is */ }
        // Thangs also renders its own auto-generated 3D-viewer preview thumbnail
        // with this exact same alt text (a "ModelThumbnail" component reused
        // elsewhere on the page) — served from a separate "thangs-thumbnails"
        // bucket, distinct from the "production-thangs-public" bucket the
        // designer's actual uploaded photos live in. Exclude it: it's not a
        // product photo, and in practice this asset 404s anyway.
        if (/\/thangs-thumbnails\//i.test(real)) continue;
        images.push(real);
      }
      if (images.length) out.images = [...new Set(images)];
    }

    return out;
  },
};
