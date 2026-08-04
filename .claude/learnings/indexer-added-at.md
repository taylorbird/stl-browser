# "Recently added" needs its own timestamp column — indexed_at and date both lie

## Problem

The "Recently added" shelf (`routes.js` `recent=1` filter + `countRecent`) was
filtering on `models.date`, which is the model's **publish** date (sourced
from `metadata.md`'s `date:` field). Scraped models (Patreon/Thangs) carry
their *original* publish date forward, so a model added to the library today
but published long ago (e.g. Thangs "The Rail v2", `date: 2025-08-08`) never
showed up under "Recently added." In practice the feature meant "recently
published," not "recently added."

## The indexed_at trap

The `models` table already had an `indexed_at` column, and it looks like the
obvious fix — except it's unusable for this purpose. The indexer's upsert
does:

```sql
ON CONFLICT(folder_path) DO UPDATE SET ..., indexed_at=@indexed_at
```

It's overwritten on **every** re-index, and this codebase runs a full reindex
on every API startup (`index()` is called from `api/src/index.js` on
listen). A plain-node dev server with no `--watch` restarts often, so
`indexed_at` collapses to ~"now" for the *entire* library after any restart —
it can't distinguish a model added a year ago from one added ten seconds ago.

## Solution: a dedicated added_at column, deliberately excluded from the UPDATE clause

**Schema (`api/src/db.js`)**
- Add `added_at TEXT` to the `CREATE TABLE models` definition, plus
  `CREATE INDEX IF NOT EXISTS idx_models_added_at`.
- For existing DBs, add a migration:
  ```sql
  ALTER TABLE models ADD COLUMN added_at TEXT;
  UPDATE models SET added_at = COALESCE(date, indexed_at) WHERE added_at IS NULL;
  ```
- **Ordering caveat**: this migration must run *before* any
  `CREATE INDEX ... ON models(added_at)` statement that runs against existing
  databases — otherwise the index references a column that doesn't exist yet
  and errors. In this codebase the migration was placed alongside the other
  pre-migrations, ahead of the main `db.exec` block.

**Indexer (`api/src/indexer.js`)**
- The INSERT sets `added_at = now`.
- The `ON CONFLICT(folder_path) DO UPDATE SET ...` clause **deliberately
  omits `added_at`**, so the first-seen timestamp survives every subsequent
  re-index. `added_at` is still passed in the run params (the INSERT branch
  needs it) — it's just never referenced in the UPDATE branch.

**Query (`api/src/routes.js`)**
- Both the recent filter and `countRecent` key off
  `added_at >= date('now','-30 day')`.
- ISO timestamps (`2026-07-16T...`) compare correctly (lexicographic) against
  `date('now','-30 day')`'s date-only output, and against backfilled
  date-only `added_at` values — no format conversion needed.

## Backfill rationale

Backfill `added_at` from `COALESCE(date, indexed_at)` — i.e. from the
publish date — not from `indexed_at`. Backfilling from `indexed_at` would
mark the entire existing library (1341 models) as "recently added" for the
next 30 days, flooding the shelf. Backfilling from publish date keeps
existing library contents looking historically accurate.

For a model known to have just been added, bump its `added_at` individually,
e.g.:
```sql
UPDATE models SET added_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
WHERE folder_path='loftedgoods/the-rail-v2';
```

## WAL note

A one-off `sqlite3` CLI write like the above works fine while the API holds
the DB open, because the DB runs in WAL mode (readers + one writer) and
better-sqlite3 re-reads fresh on every query, so it picks up the externally
committed change immediately.

## Tests

- `api/src/indexer.test.js`: `added_at` is set on insert and preserved across
  re-index.
- `api/src/routes.test.js`: `recent=1` keys off `added_at`, not publish
  `date`.
- Full suite: 106/106 passing.
