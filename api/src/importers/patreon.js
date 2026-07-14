// Patreon post importer. Patreon is a JS-rendered SPA, but its server HTML carries
// full Open Graph / article meta — so the generic extractor gets title/description/
// date/images; this importer cleans up the Patreon-specific shape:
//   • og:title is "<post title> | <creator>"  → split into title + creator
//   • images mix the meta thumbnail and the campaign avatar in with the real post
//     photos → keep only the post media.
export const patreon = {
  match: (host) => /(^|\.)patreon\.com$/i.test(host),

  // Receives the generic result; returns only the fields it wants to override.
  refine(html, url, base) {
    const out = {};

    const parts = (base.title || '').split('|').map((s) => s.trim()).filter(Boolean);
    if (parts.length >= 2) {
      out.creator = parts[parts.length - 1];      // trailing segment is the creator/campaign
      out.title = parts.slice(0, -1).join(' | '); // everything before it is the post title
    }

    // Real post photos live at patreonusercontent.com/.../p/post/<id>/... — the
    // meta-image thumbnail and /p/campaign/ avatar are chrome, not model images.
    const real = (base.images || []).filter((u) => u.includes('patreonusercontent.com') && u.includes('/p/post/'));
    if (real.length) out.images = real;

    return out;
  },
};
