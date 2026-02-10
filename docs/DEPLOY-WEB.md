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

## Create first admin on production ("Invalid credentials" fix)

Production has a **separate** database; it starts with no users. To create the admin (admin / admin):

1. **Render Dashboard** → open the **relaxdrive-api** service → **Environment**.
2. Add (or set) an env var: **`ALLOW_BOOTSTRAP`** = **`true`**. Save. Wait for the service to redeploy if it does.
3. Call the bootstrap endpoint once (PowerShell, or any HTTP client):
   ```powershell
   Invoke-RestMethod -Uri "https://relaxdrive-api.onrender.com/auth/bootstrap" -Method POST -ContentType "application/json" -Body '{"nickname":"admin","password":"admin"}'
   ```
   Or with curl: `curl -X POST https://relaxdrive-api.onrender.com/auth/bootstrap -H "Content-Type: application/json" -d "{\"nickname\":\"admin\",\"password\":\"admin\"}"`
4. Log in at the **web** URL with **admin** / **admin**.
5. **(Recommended)** In Render, set **`ALLOW_BOOTSTRAP`** back to **`false`** or remove it, so the bootstrap endpoint is disabled.

Optional: set **`BOOTSTRAP_SECRET`** to a random string and send it as header **`X-Bootstrap-Secret`** when calling bootstrap; then only someone with that secret can create/reset the admin.
