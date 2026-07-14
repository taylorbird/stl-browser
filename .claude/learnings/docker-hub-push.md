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
