import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { scrapePage } from './index.js';

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
    <meta property="og:site_name" content="Thangs">
    <img src="https://cdn.thangs.com/a.png">
  </head>`;
  const r = scrapePage('https://thangs.com/designer/x/3d-model/dragon-123', html);

  it('returns the generic result with no creator when no importer matches', () => {
    assert.equal(r.title, 'Dragon Bust');
    assert.equal(r.creator, '');
    assert.equal(r.siteName, 'Thangs');
    assert.ok(r.images.includes('https://cdn.thangs.com/a.png'));
  });

  it('does not throw on a non-URL input', () => {
    const g = scrapePage('not a url', '<title>Hi</title>');
    assert.equal(g.title, 'Hi');
    assert.equal(g.creator, '');
  });
});
