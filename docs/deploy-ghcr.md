# Deploy with GHCR

This repo now publishes two container images to GHCR on every push to `main` and on semver tags such as `v0.1.0`.

- Backend image: `ghcr.io/arnaubennassar/fitracker-backend`
- Frontend image: `ghcr.io/arnaubennassar/fitracker-frontend`

## What Arnau needs in GitHub

- Repo setting `Settings > Actions > General > Workflow permissions`: set to `Read and write permissions`.
- No GitHub Actions secrets are required for publishing. The workflow pushes to GHCR with the built-in `GITHUB_TOKEN`.
- No repo variables are required.
- Optional but recommended: make the GHCR packages public if the deploy host should pull without logging in.

If the packages stay private, the server that runs `docker compose` must log in to GHCR with a token that can read packages. That token is a server-side secret, not a repo secret required by the workflow.

## First deploy

1. Publish once by pushing `main`, or publish a release tag:

```bash
git tag v0.1.0
git push origin v0.1.0
```

2. Copy `docker-compose.ghcr.yml` to the server.

3. Set the minimum env needed by compose:

```bash
export ADMIN_SEED_TOKEN='replace-with-a-long-random-value'
export WEBAUTHN_ORIGIN='https://fitracker.example.com'
export WEBAUTHN_RP_ID='fitracker.example.com'
```

4. If the GHCR packages are private, log in on the server before pulling:

```bash
echo "$GHCR_READ_TOKEN" | docker login ghcr.io -u YOUR_GITHUB_USER --password-stdin
```

5. Start the stack:

```bash
docker compose -f docker-compose.ghcr.yml pull
docker compose -f docker-compose.ghcr.yml up -d
```

The backend runs migrations automatically on startup. Seed demo data only when you want the sample dataset and seeded admin token:

```bash
docker compose -f docker-compose.ghcr.yml run --rm backend node dist/db/seed.js
```

## Validate the deploy

```bash
curl http://localhost:3001/health
curl http://localhost:3000/health
```

You can also open:

- `http://localhost:3000`
- `http://localhost:3001/docs`

## Recommendation

For the current app, the simplest deploy is to keep frontend and backend in the same compose project and keep the backend service name as `backend`.

The published frontend image is built with `BACKEND_ORIGIN=http://backend:3001`, so it works out of the box in compose. If later you want the frontend to talk to a backend on another host or behind another proxy, rebuild the frontend image with a different `BACKEND_ORIGIN` or put a reverse proxy in front of both services.
