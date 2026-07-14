# Deterministic weighted shuffle in SQLite (creator balancing)

Problem: uniform random over models lets prolific creators dominate (Fluid Prints ~25%
of every shuffle page). Wanted: equal creator airtime by default, per-user multipliers,
deterministic per seed (stable infinite-scroll pagination).

Solution: Efraimidis–Spirakis weighted sampling in log form, pure SQL (routes.js):

- Deterministic u ∈ (0,1] per (model, seed): `u = (((id*a + b) % p) + 1) / (p + 1)`
  with a=1103515245, b=f(seed), p=2^31-1
- Item weight = user_weight(creator) / count(creator)  → equal creator share at weight 1
- Sort key: `ln(u) * creator_count / MAX(COALESCE(ucw.weight,1), 0.02)` ORDER BY DESC

Gotchas:
- Use **ln form**, not `pow(u, 1/w)` — exponents like count/weight = 400+ underflow
  doubles to 0 and the ordering degenerates to ties.
- `ln()`/math fns are available — better-sqlite3 compiles SQLite with math functions
  (verified: `SELECT ln(0.5)` works). Scalar two-arg `MAX()` too.
- Clamp weight 0 → 0.02 instead of WHERE-excluding: keeps page/count queries consistent
  ("hidden" creators sink to the end rather than breaking total/hasMore math).
- The weights JOIN goes only on the page query, not the COUNT query; join params come
  before WHERE params in better-sqlite3 positional order.

Sanity check that proved it: 12-model shuffle page spanned 8 creators, dominant
creator absent (was ~3/12 before).
