# Node version vs native modules / CLIs on this machine

Default `node` on PATH is v22.2.0 (fnm default). Two things break against it:

1. **better-sqlite3** in `api/node_modules` is compiled for Node 23 (NODE_MODULE_VERSION 131
   vs 127). Running the API or tests with default node fails with ERR_DLOPEN_FAILED.
   Use: `"/Users/tbird/Library/Application Support/fnm/node-versions/v23.6.1/installation/bin/node"`
   (Docker images unaffected — they compile their own node_modules in-image.)

2. **chrome-devtools-mcp CLI** requires Node ≥ 22.12 and its daemon **dies silently** on
   older node — `chrome-devtools start` exits 0, `status` says "not running", a stale
   socket is left at /tmp/chrome-devtools-mcp-501.sock. The version error only surfaces
   when invoking the package directly (`npx chrome-devtools-mcp`). Fix: prefix PATH with
   the v23 fnm bin for every chrome-devtools call.

Rebuilding better-sqlite3 for v22 would just flip the problem (and v22.2 is below the
chrome-devtools floor anyway). Either keep using the v23 binary explicitly or bump the
fnm default to ≥22.12 / 23.x.
