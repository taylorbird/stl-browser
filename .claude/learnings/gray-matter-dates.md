# gray-matter YAML Date Parsing

gray-matter automatically converts YAML date values (e.g., `date: 2025-03-15`) into JavaScript Date objects. Using `String(date).slice(0,10)` produces "Fri Mar 14" instead of "2025-03-15".

Fix: check `instanceof Date` and use `.toISOString().slice(0,10)` for ISO format.
