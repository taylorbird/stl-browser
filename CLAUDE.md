# CURIO (stl-browser)

Containerized web UI for browsing/searching 3D print files on the NAS: Node/Express API
(`api/`) + React/Vite (`web/`), SQLite+FTS5, deployed as ARM64 Docker images to a Raspberry Pi.

Work state lives in `.claude/work/` — start every session by reading:
- `current.md` — objective, always-on constraints, new-machine setup, next actions
- `questions.md` — open questions and blockers
- `working-style.md` — confirmed rules for working with Taylor
- the newest entry at the top of `log.md`

Load on demand: `constraints.md` (full constraint ledger), `preferences.md` (unconfirmed
candidate preferences — not rules), and `.claude/learnings/<topic>.md` when a task touches that topic.
