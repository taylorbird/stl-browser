# Docker Hub Push

User's Docker Hub account: taylorlbird (note: one 'l' in taylor)
Login: `docker login -u taylorlbird`

Image naming (current, CURIO): taylorlbird/curio-api, taylorlbird/curio-web
Older names (pre-rename): taylorlbird/stl-browser-api, taylorlbird/stl-browser-web

Docker images only contain what the Dockerfile COPYs — working directory secrets (gallery-dl.conf etc.) are not included as long as they're not in the build context or are in .dockerignore.

## ARM64 cross-arch push from an Apple-silicon Mac

CURIO deploys to a Raspberry Pi, so images must be linux/arm64. Pushing a cross-arch image to a registry from an Apple-silicon Mac requires a buildx builder with the **docker-container driver** — the default `docker` driver builder CANNOT push multi-platform / cross-arch manifests (it only loads a single-arch image into the local daemon).

One-time builder setup:
```
docker buildx create --name X --driver docker-container --bootstrap
```

Build + push in one step:
```
docker buildx build --builder X --platform linux/arm64 -t taylorlbird/curio-api:latest --push ./api
```

OrbStack provides the Docker daemon and must be started first: `open -a OrbStack`. Its socket is at `~/.orbstack/run/docker.sock`.

## Verifying pushed manifests are the correct architecture

After pushing a cross-arch image, verify it was actually built and pushed as the intended platform:

```bash
docker buildx imagetools inspect taylorlbird/curio-api:latest
```

Output will include the architecture line(s) and may also show an "unknown/unknown" entry. **The "unknown/unknown" entry is the SLSA attestation manifest** (build provenance metadata, also called the buildx attestation), not a real architecture. This is normal and expected in modern Docker builds.

**Correct output** for ARM64:
```
Name:      index.docker.io/taylorlbird/curio-api:latest
MediaType: application/vnd.docker.distribution.manifest.list.v2+json
Digest:    sha256:...

Manifests:
  Name:      index.docker.io/taylorlbird/curio-api:latest@sha256:...
  MediaType: application/vnd.docker.distribution.manifest.v2+json
  Platform:  linux/arm64   <-- CORRECT
  
  Name:      index.docker.io/taylorlbird/curio-api:latest@sha256:...
  MediaType: application/vnd.docker.distribution.manifest+json
  Platform:  unknown/unknown  <-- SLSA attestation, harmless, normal
```

Presence of `linux/arm64` in the Manifests section confirms the push succeeded for the target platform. The "unknown/unknown" entry below it is not a sign of a failed or multi-platform build — it's the attestation manifest added by buildx automatically.

## Checking a live image is current

When troubleshooting whether a live Docker Hub image contains current code, compare the image's config `created` timestamp against the last code commit in the tracked directories:

```bash
# Get the image's created timestamp (UTC)
docker buildx imagetools inspect <image>:latest --format '{{json .Image}}' | jq '.created'

# Get the last commit time for the directories that affect the image (api/ and web/)
git log -1 --format='%h %ci' -- api web
```

If the image `created` timestamp is **after** the last code commit timestamp, the image is current and contains all committed code. If it's before, the code has been updated since the image was built, so a rebuild and push are needed.

Example: image created at `2026-08-05T18:59:00Z` (UTC) and last code commit at `2026-08-05 18:10 PDT` (2026-08-05T01:10:00Z UTC) — image postdates code by hours, so it's current. Verify with both the image's own `created` field and the timestamp of the last commit touching the relevant directories.
