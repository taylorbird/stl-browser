# STL Browser Web UI Design

**Goal:** A containerized web app that indexes 3D print model files from a NAS and provides a browsable, searchable gallery interface.

**Architecture:** Docker Compose with two services — a Node.js/Express API backend and a React SPA frontend served by nginx. SQLite database stores the index; files are streamed from the NAS on demand.

**Tech Stack:** Docker, Node.js, Express, React, Vite, Tailwind CSS, SQLite (better-sqlite3), FTS5

---

## Container Layout

Fixed paths inside the container — flexibility comes from Docker volume mapping:

- `/data` — NAS mount (read-only), contains `<creator>/<date-title>/` model folders
- `/config` — persistent config volume, holds the SQLite database (`stl-browser.db`)

```yaml
# docker-compose.yml example
services:
  api:
    volumes:
      - /mnt/nas/3dprint:/data:ro
      - ./config:/config
  web:
    # proxies /api to api service
```

## Data Model

### Tables

**models**
- `id` INTEGER PRIMARY KEY
- `folder_path` TEXT UNIQUE — relative to `/data` (e.g. `KozaDesign/2025-04-20-cool-vase`)
- `title` TEXT
- `creator` TEXT
- `date` TEXT — ISO date (YYYY-MM-DD)
- `patreon_url` TEXT
- `post_id` INTEGER
- `content` TEXT — markdown body from metadata.md
- `files` TEXT — JSON array of filenames
- `preview_filename` TEXT — first jpg/png found in folder
- `indexed_at` TEXT — ISO timestamp

**model_tags**
- `model_id` INTEGER FK → models.id
- `tag` TEXT
- UNIQUE(model_id, tag)

**models_fts** (FTS5 virtual table)
- Content from: `title`, `creator`, `content`
- Enables full-text search across all metadata

### Indexer

Walks `/data/<creator>/<date-title>/metadata.md`:
1. Parses YAML frontmatter (title, creator, date, patreon_url, post_id, tags)
2. Extracts markdown body as content
3. Lists all non-metadata files in the folder
4. Identifies preview image (first .jpg/.png)
5. Upserts into `models` keyed on `folder_path`
6. Syncs tags into `model_tags`
7. Updates FTS index

Idempotent — re-index picks up new models without duplicating. Full scan of ~1,149 models takes under a second.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/models` | List/search models (paginated) |
| GET | `/api/models/:id` | Single model detail |
| GET | `/api/models/:id/preview` | Stream preview image from NAS |
| GET | `/api/models/:id/files/:filename` | Stream file download from NAS |
| POST | `/api/reindex` | Trigger re-scan of `/data` |
| GET | `/api/creators` | List all creators |
| GET | `/api/tags` | List all tags |

### Query params for `/api/models`

- `q` — full-text search query
- `creator` — filter by creator name
- `tag` — filter by tag
- `page` / `limit` — pagination (default limit 24)
- `sort` — `date`, `title`, `creator` (default `date` desc)

## Frontend

### Browse view (main page)
- Top bar: search input, creator dropdown, tag filter chips
- Responsive card grid (CSS Grid, ~3-4 columns desktop, 1 mobile)
- Each card: preview image, title, creator badge, date, tag chips
- Pagination or infinite scroll

### Detail view
- Large preview image
- Title, creator, date, Patreon link
- Full description text
- File list table: filename, extension badge, file size
- Download button per file
- Tag chips (read-only now, editable in Phase 3)

### Styling
- Tailwind CSS
- Dark mode default (3D print previews look better on dark backgrounds)
- Clean, minimal

## Docker Compose

```yaml
services:
  api:
    build: ./api
    ports:
      - "3001:3001"
    volumes:
      - /mnt/nas/3dprint:/data:ro
      - ./config:/config
    environment:
      - NODE_ENV=production

  web:
    build: ./web
    ports:
      - "3000:80"
    depends_on:
      - api
```

## Future (Phase 3+)
- Custom tagging via UI (POST /api/models/:id/tags)
- Bulk tag operations
- STL thumbnail generation (3D preview renderer)
- Favorites / collections
