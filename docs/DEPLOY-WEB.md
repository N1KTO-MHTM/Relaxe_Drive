# Web deploy (production)

The web app is deployed as a **static site** on Render (see `render.yaml`).

## What Render does

- **Service:** `relaxdrive-web` (static)
- **Build:** `cd web && npm install --include=dev && npm run build`
- **Publish:** `web/dist`
- **Env at build time:** `VITE_API_URL`, `VITE_WS_URL` (set in render.yaml to the API URL)

So the built JS has the production API and WebSocket URLs baked in. No server-side code; the browser talks to `relaxdrive-api` for API and WS.

## Ensure deploy works

1. **Render dashboard** – For the `relaxdrive-web` service, env vars from `render.yaml` are applied. Do not remove `VITE_API_URL` or `VITE_WS_URL`.

2. **Local prod-like build (optional):**
   ```bash
   # PowerShell
   $env:VITE_API_URL="https://relaxdrive-api.onrender.com"
   $env:VITE_WS_URL="https://relaxdrive-api.onrender.com"
   npm run build:web
   ```
   Then open `web/dist/index.html` via a static server (e.g. `npx serve web/dist`) and test login / API calls.

3. **After git push** – Render rebuilds and redeploys `relaxdrive-web` and `relaxdrive-api` per `render.yaml`. The web will use the current API URL; no extra step needed.

## Backend (API) deploy

- Uses **PostgreSQL** on Render (`schema.postgres.prisma` is copied over `schema.prisma` before build).
- Local dev uses SQLite; production is unchanged.
