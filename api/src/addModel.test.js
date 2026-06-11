// api/src/addModel.test.js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { slugify, uniqueDirName, extractImageUrls } from './addModel.js';

describe('slugify', () => {
  it('lowercases and hyphenates words', () => {
    assert.equal(slugify('Dragon Bust'), 'dragon-bust');
  });
  it('strips punctuation and collapses separators', () => {
    assert.equal(slugify('  Cool!!  Thing__v2  '), 'cool-thing-v2');
  });
  it('falls back to "model" when nothing usable remains', () => {
    assert.equal(slugify('!!!'), 'model');
  });
});

describe('uniqueDirName', () => {
  it('returns the base name when the directory is free', () => {
    const parent = mkdtempSync(join(tmpdir(), 'curio-'));
    try {
      assert.equal(uniqueDirName(parent, 'dragon-bust'), 'dragon-bust');
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });
  it('suffixes -2, -3 when names are taken', () => {
    const parent = mkdtempSync(join(tmpdir(), 'curio-'));
    try {
      mkdirSync(join(parent, 'dragon-bust'));
      assert.equal(uniqueDirName(parent, 'dragon-bust'), 'dragon-bust-2');
      mkdirSync(join(parent, 'dragon-bust-2'));
      assert.equal(uniqueDirName(parent, 'dragon-bust'), 'dragon-bust-3');
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });
});

describe('extractImageUrls', () => {
  it('pulls og:image and twitter:image meta tags', () => {
    const html = `
      <meta property="og:image" content="https://cdn.site.com/og.jpg">
      <meta name="twitter:image" content="https://cdn.site.com/tw.png">
    `;
    const urls = extractImageUrls(html, 'https://site.com/model/1');
    assert.ok(urls.includes('https://cdn.site.com/og.jpg'));
    assert.ok(urls.includes('https://cdn.site.com/tw.png'));
  });

  it('pulls <img src> and resolves relative URLs against the base', () => {
    const html = `<img src="/images/a.jpg"><img src="https://x.com/b.png">`;
    const urls = extractImageUrls(html, 'https://site.com/model/1');
    assert.ok(urls.includes('https://site.com/images/a.jpg'));
    assert.ok(urls.includes('https://x.com/b.png'));
  });

  it('pulls lazy-loaded data-src and srcset candidates', () => {
    const html = `
      <img data-src="https://cdn.site.com/lazy.jpg">
      <img srcset="https://cdn.site.com/s1.jpg 1x, https://cdn.site.com/s2.jpg 2x">
    `;
    const urls = extractImageUrls(html, 'https://site.com/');
    assert.ok(urls.includes('https://cdn.site.com/lazy.jpg'));
    assert.ok(urls.includes('https://cdn.site.com/s1.jpg'));
    assert.ok(urls.includes('https://cdn.site.com/s2.jpg'));
  });

  it('decodes HTML entities in URLs (e.g. &amp; → &)', () => {
    const html = `<img src="https://x.com/a.jpg?s=1&amp;v=4">`;
    const urls = extractImageUrls(html, 'https://x.com/');
    assert.ok(urls.includes('https://x.com/a.jpg?s=1&v=4'));
    assert.ok(!urls.some((u) => u.includes('&amp;')));
  });

  it('dedupes repeated URLs', () => {
    const html = `<img src="https://x.com/a.jpg"><img src="https://x.com/a.jpg">`;
    const urls = extractImageUrls(html, 'https://x.com/');
    assert.equal(urls.filter((u) => u === 'https://x.com/a.jpg').length, 1);
  });

  it('ignores non-image and data: URLs', () => {
    const html = `<img src="data:image/gif;base64,R0lGOD"><img src="/real.jpg">`;
    const urls = extractImageUrls(html, 'https://site.com/');
    assert.ok(!urls.some((u) => u.startsWith('data:')));
    assert.ok(urls.includes('https://site.com/real.jpg'));
  });
});
