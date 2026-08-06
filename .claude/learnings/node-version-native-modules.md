# Node version vs native modules / CLIs on this machine

**Current state (as of 2026-08-05)**: Default `node` on PATH is v22.23.1 (fnm default). **better-sqlite3 is compiled for Node 22** (NODE_MODULE_VERSION 127). Use the default node — the old v23 constraint is now SUPERSEDED.

## Previously (2026-07-16 and earlier)

**SUPERSEDED**: better-sqlite3 was compiled for Node 23 (NODE_MODULE_VERSION 131), requiring `fnm v23.6.1` binary instead of default v22. The constraint was documented at the time because deps had been installed under Node 23. **This is no longer true as of 2026-08-05** — deps were reinstalled somewhere between sessions, and better-sqlite3 is now built for v22. Using the old fnm v23.6.1 binary now fails with ERR_DLOPEN_FAILED.

**Action**: Delete any scripts, aliases, or documentation that mandated fnm v23.6.1. Run API and tests with `node` (v22.x) directly.

## chrome-devtools-mcp CLI requirement (separate)

**chrome-devtools-mcp CLI** requires Node ≥ 22.12 and its daemon **dies silently** on older node — `chrome-devtools start` exits 0, `status` says "not running", a stale socket is left at /tmp/chrome-devtools-mcp-501.sock. The version error only surfaces when invoking the package directly (`npx chrome-devtools-mcp`).

Since the default node is now v22.23.1 (which is ≥22.12), this constraint is automatically satisfied. No special binary selection needed.

## Summary

| Tool | Required | Current | Status |
|------|----------|---------|--------|
| better-sqlite3 | NODE_MODULE_VERSION 127 (Node 22) | Compiled for v22 | ✓ Default node works |
| chrome-devtools-mcp | Node ≥22.12 | v22.23.1 | ✓ Default node works |
| Docker images | N/A | Compile their own in-image | ✓ No constraint |

Use `node` directly. The old fnm v23.6.1 workaround is no longer needed and now breaks the build.
