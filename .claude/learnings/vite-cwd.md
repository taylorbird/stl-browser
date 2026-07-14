# Vite Dev Server CWD

`npx --prefix /path/to/web vite --config /path/to/web/vite.config.js` starts Vite but doesn't change the working directory. Vite's `root` defaults to cwd, so it can't find `index.html` and returns 404.

Fix: `cd /path/to/web && npx vite` — or set `root` explicitly in vite.config.js.
