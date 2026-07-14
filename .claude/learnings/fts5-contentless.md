# SQLite FTS5 Contentless Tables

When using `content=''` (contentless FTS5), the FTS table stores its own copy of the data — it's not backed by another table. This means:

- You must manually INSERT/DELETE rows (no automatic sync)
- DELETE requires matching the exact values that were originally inserted (not just the rowid)
- If you INSERT with tags='a,b' and later try to DELETE with tags='', the delete won't match and FTS gets corrupted
- Triggers with content='' are dangerous because the trigger fires with NEW/OLD row values from the base table, which may not match what's in FTS
- Safest approach: skip triggers entirely, have the indexer read existing FTS values before delete, then re-insert
