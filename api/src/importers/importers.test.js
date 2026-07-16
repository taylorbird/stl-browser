import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { scrapePage } from './index.js';
import { thangs } from './thangs.js';

// Mirrors the shape of a real Patreon post page's server HTML (og/article meta + a
// mix of meta-image, campaign-avatar, and real post-media image URLs).
const PATREON_HTML = `<head>
  <title>Earth Zorble | Patreon</title>
  <meta property="og:title" content="Earth Zorble | Blob Lab">
  <meta property="og:description" content="This is a bonus design :)">
  <meta property="og:site_name" content="Patreon">
  <meta property="article:published_time" content="2026-06-15T16:53:18.000+00:00">
  <meta property="og:image" content="https://www.patreon.com/meta-image/post/161162421">
  <img src="https://c10.patreonusercontent.com/4/patreon-media/p/campaign/2694356/avatar.jpg?token=x">
  <img src="https://c10.patreonusercontent.com/4/patreon-media/p/post/161162421/one.jpg?token=x">
  <img src="https://c10.patreonusercontent.com/4/patreon-media/p/post/161162421/two.jpg?token=x">
</head>`;

describe('scrapePage — Patreon importer', () => {
  const r = scrapePage('https://www.patreon.com/bloblab/posts/earth-zorble-161162421', PATREON_HTML);

  it('splits "<post> | <creator>" into title + creator', () => {
    assert.equal(r.title, 'Earth Zorble');
    assert.equal(r.creator, 'Blob Lab');
  });

  it('keeps date and description from the generic pass', () => {
    assert.equal(r.date, '2026-06-15');
    assert.equal(r.description, 'This is a bonus design :)');
  });

  it('filters images down to real post media (drops meta + campaign)', () => {
    assert.equal(r.images.length, 2);
    assert.ok(r.images.every((u) => u.includes('/p/post/')));
  });
});

describe('scrapePage — generic fallback', () => {
  const html = `<head>
    <meta property="og:title" content="Dragon Bust">
    <meta property="og:site_name" content="Printables">
    <img src="https://cdn.printables.com/a.png">
  </head>`;
  const r = scrapePage('https://printables.com/model/dragon-123', html);

  it('returns the generic result with no creator when no importer matches', () => {
    assert.equal(r.title, 'Dragon Bust');
    assert.equal(r.creator, '');
    assert.equal(r.siteName, 'Printables');
    assert.ok(r.images.includes('https://cdn.printables.com/a.png'));
  });

  it('does not throw on a non-URL input', () => {
    const g = scrapePage('not a url', '<title>Hi</title>');
    assert.equal(g.title, 'Hi');
    assert.equal(g.creator, '');
  });
});

// Trimmed from a real Thangs model page (browserless stealth-fetched, post-Cloudflare
// challenge): og:title "<title> - 3D model by <creator> on Thangs", a __NEXT_DATA__
// blob carrying the publish date, and a mix of this model's gallery images (alt
// "<title> 3d model") with unrelated recommendation-card and avatar images that must
// be filtered out.
const THANGS_URL = 'https://thangs.com/designer/LoftedGoods/3d-model/The%20Rail%20v2-1397922';
const THANGS_HTML = `<head>
  <title>The Rail v2 - 3D model by LoftedGoods on Thangs</title>
  <meta property="og:title" content="The Rail v2 - 3D model by LoftedGoods on Thangs">
  <meta property="og:description" content="I've had the original Rail mounted in my studio and home for about a year now.">
  <meta property="og:site_name" content="Thangs">
  <script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"fallback":{"v4/models/1397922/stats":{"published":"2025-08-08T19:38:42.901Z"}}}}}</script>
</head>
<body>
  <img alt="The Rail v2 3d model" src="https://thangs.com/_next/image?url=https%3A%2F%2Fstorage.googleapis.com%2Fproduction-thangs-public%2Fuploads%2Fattachments%2Fb16d0fcc-09b2-4f11-bcc6-45d10cf163c9%2F1.jpg&w=3840&q=85">
  <img alt="The Rail v2 3d model" src="https://thangs.com/_next/image?url=https%3A%2F%2Fstorage.googleapis.com%2Fproduction-thangs-public%2Fuploads%2Fattachments%2Fb16d0fcc-09b2-4f11-bcc6-45d10cf163c9%2F2.jpg&w=3840&q=85">
  <img alt="Dovetail Mount for IKEA SKADIS 3d model" src="https://thangs.com/_next/image?url=https%3A%2F%2Fstorage.googleapis.com%2Fother%2Fdovetail.jpg&w=384&q=85">
  <img alt="LoftedGoods" src="https://thangs.com/_next/image?url=https%3A%2F%2Fstorage.googleapis.com%2Favatars%2Floftedgoods.jpg&w=32&q=85">
</body>`;

describe('scrapePage — Thangs importer', () => {
  it('opts into browser rendering (Cloudflare-blocked host)', () => {
    assert.equal(thangs.render, true);
  });

  const r = scrapePage(THANGS_URL, THANGS_HTML);

  it('splits "<title> - 3D model by <creator> on Thangs" into title + creator', () => {
    assert.equal(r.title, 'The Rail v2');
    assert.equal(r.creator, 'LoftedGoods');
  });

  it('reads publish date from the embedded __NEXT_DATA__ stats cache', () => {
    assert.equal(r.date, '2025-08-08');
  });

  it('keeps only the gallery images (alt === "<title> 3d model"), decoded off the /_next/image proxy', () => {
    assert.equal(r.images.length, 2);
    assert.ok(r.images.every((u) => u.startsWith('https://storage.googleapis.com/production-thangs-public/')));
  });

  it('drops recommendation-card and avatar images (different alt text)', () => {
    assert.ok(!r.images.some((u) => u.includes('dovetail') || u.includes('loftedgoods.jpg')));
  });
});
