# CURIO — a 3D print library

CURIO is a self-hosted web app for browsing, searching, and curating large collections
of 3D-print files (STLs and friends). Point it at a folder of models organized by
creator, and it gives you a fast, searchable gallery with favorites, collections,
and per-user preferences — designed for homelab deployment behind an auth proxy.

- **Browse** — featured picks, a creator shelf, and an infinite-scroll grid with
  shuffle / newest / title / creator sorting
- **Search** — full-text, prefix-matching live search (⌘K) over titles, creators,
  and descriptions
- **Curate** — per-user favorites and named collections ("To print", "Printed", …)
- **Balance** — shuffle and featured give every creator equal airtime by default;
  per-user creator weights (Hide → Max) tune who shows up more
- **Detail pages** — image gallery, markdown description, file list with sizes,
  one-click STL downloads

The stack: Node/Express + SQLite (FTS5) API, React/Vite/Tailwind frontend, packaged
as two small Docker containers (nginx serves the UI and proxies the API internally).

---

## Library layout

CURIO indexes a directory tree organized as `creator/model/files`:

```
models/
├── Fluid Prints/
│   ├── logo.png                      # optional creator logo
│   ├── 2026-01-11-kraken-ship/
│   │   ├── metadata.md               # optional
│   │   ├── kraken.stl
│   │   └── photo1.jpg
│   └── dragon-bust/
│       └── dragon.stl
└── Studio Loup/
    └── ...
```

Rules:

- **Top-level folders are creators.** A `logo.*` image in the creator folder is used
  as their avatar.
- **Each subfolder is one model.** Every file in it is listed and downloadable; the
  first image found becomes the preview thumbnail.
- **`metadata.md` is optional.** If present, YAML frontmatter supplies
  `title`, `creator`, `date`, `patreon_url`, and the markdown body becomes the
  description. Without it, the title derives from the folder name
  (`2026-01-11-kraken-ship` → title "kraken ship", date `2026-01-11`).

Press **Sync library** in the UI (or restart the API) to re-index after adding models.
Models whose folders disappeared are reported and removed only after you confirm.

## Quick start

```yaml
# docker-compose.yml
services:
  api:
    image: taylorlbird/curio-api:latest
    restart: unless-stopped
    volumes:
      - /path/to/your/models:/data:ro     # your library (read-only)
      - /path/to/config:/config           # SQLite database lives here
    environment:
      - DEFAULT_USER=you                  # single-user mode (see Users below)
    ulimits:
      nofile: { soft: 65536, hard: 65536 }

  web:
    image: taylorlbird/curio-web:latest
    restart: unless-stopped
    ports:
      - "3000:80"
    depends_on:
      - api
```

```sh
docker compose up -d
# open http://localhost:3000
```

The API container indexes the library on startup (large libraries on network
storage can take a minute or two before first responses).

> Images are published for **linux/arm64** (Raspberry Pi). Build your own for
> other architectures: `docker build -t curio-api ./api` and
> `docker build -t curio-web ./web`.

## Users, favorites, and collections

Favorites, collections, and settings are **per-user**, stored in SQLite on the
server. Identity comes from HTTP headers, in this order:

1. `Remote-User` (preferred) or `Remote-Email` — set by your auth proxy
2. `DEFAULT_USER` env var — fallback identity for headerless requests
3. Otherwise anonymous: browsing works, but favoriting/collecting returns 401

**Multi-user (recommended):** put an authenticating reverse proxy — TinyAuth,
Authelia, Authentik, Cloudflare Access — in front of the `web` container and have
it inject `Remote-User`. Each person gets their own favorites, collections, and
creator weights automatically. Leave `DEFAULT_USER` unset.

**Single-user:** set `DEFAULT_USER=yourname` and skip the proxy.

> ⚠️ **Security model:** the API trusts identity headers. Never publish the API
> port (3001) directly — the bundled nginx proxies `/api` over the internal
> Docker network, and your auth proxy must be the only way to reach the web port.
> Anyone who can reach the API directly can act as any user.

## Settings

The sliders icon in the sidebar footer opens per-user settings:

- **Creator weights** — Featured and Shuffle give every creator roughly equal
  airtime regardless of how many models they have. Weights multiply that share:
  *Hide* (sinks to the end, never featured) · *Less* (½×) · *Normal* (1×) ·
  *More* (2×) · *Max* (4×).

## Environment variables (API)

| Variable | Default | Purpose |
|---|---|---|
| `DATA_DIR` | `/data` | Library root (mount your models here) |
| `DB_PATH` | `/config/stl-browser.db` | SQLite database location |
| `DEFAULT_USER` | *(unset)* | Identity for headerless requests (single-user mode) |

Schema migrations are automatic and additive — new versions create any missing
tables on startup; your database carries forward.

## Development

```sh
# API (needs Node ≥ 22.12 for better-sqlite3 prebuilds)
cd api && npm install
DATA_DIR=/path/to/models DB_PATH=./dev.db node src/index.js

# Web — dev server proxies /api to :3001 and injects a dev identity
cd web && npm install && npm run dev

# Tests
cd api && npm test
```

The Vite dev proxy injects `Remote-User: tbird` (see `web/vite.config.js`) so the
app behaves as a logged-in user locally — change it to taste.

## API overview

| Endpoint | Purpose |
|---|---|
| `GET /api/models` | List/search; `q`, `creator`, `favorites=1`, `missing=1`, `recent=1`, `collection=<id>`, `sort=random\|date\|title\|creator`, `seed`, `page`, `limit` |
| `GET /api/models/:id` | Model detail incl. file sizes |
| `GET /api/models/:id/preview` · `/files/:name` | Preview image / file download |
| `GET /api/creators` | Creators with model counts + logo flags |
| `GET /api/counts` | Sidebar nav counts (favorites per-user) |
| `GET/PUT/DELETE /api/favorites[/:id]` | Per-user favorites |
| `GET/POST/DELETE /api/collections…` | Per-user collections + membership |
| `GET/PUT /api/settings/weights` | Per-user creator weights |
| `POST /api/reindex` | Re-scan the library |
