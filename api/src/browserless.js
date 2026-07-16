// Fetches a page through a self-hosted browserless instance (stealth-mode headless
// Chrome) instead of a plain HTTP fetch. Only used by importers that opt into
// `render: true` (see importers/index.js) because their site blocks plain fetches
// outright — e.g. Thangs returns a Cloudflare managed-challenge shell with zero page
// content to a bare `fetch()`, but a stealth-mode browser session gets past it and
// receives the fully client-rendered page.
// Callers (importers/index.js scrapeUrl()) check BROWSERLESS_URL is set before
// calling this, so it can be assumed present here.
export async function fetchRenderedHtml(url) {
  const BROWSERLESS_URL = process.env.BROWSERLESS_URL;
  const BROWSERLESS_TOKEN = process.env.BROWSERLESS_TOKEN;
  const endpoint = new URL('/content', BROWSERLESS_URL);
  endpoint.searchParams.set('stealth', 'true');
  if (BROWSERLESS_TOKEN) endpoint.searchParams.set('token', BROWSERLESS_TOKEN);

  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url,
      gotoOptions: { waitUntil: 'networkidle2' },
      waitForTimeout: 10000,
    }),
  });
  if (!resp.ok) throw new Error(`browserless HTTP ${resp.status}`);
  return resp.text();
}
