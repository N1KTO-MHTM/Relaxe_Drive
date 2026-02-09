# Deploy to Render (dashboard.render.com)

## 1. Git: pull → commit → push

From the project root:

```powershell
# Get latest from GitHub (in case someone else pushed)
git pull origin main

# Stage all changes
git add -A

# Commit with a message
git commit -m "Your message here"

# Push to GitHub (main branch)
git push origin main
```

## 2. Deploy on Render

Your repo has a **Blueprint** (`render.yaml`) with:
- **relaxdrive-api** (Node backend, Frankfurt)
- **relaxdrive-web** (static frontend)
- **relaxdrive-db** (PostgreSQL, free plan)

Both services have **autoDeploy: true**, so a push to `main` triggers a new deploy if the repo is connected.

### First-time setup on Render

1. Go to **[dashboard.render.com](https://dashboard.render.com)** and sign in.
2. **Connect the repo**
   - **Blueprint**: Dashboard → **New** → **Blueprint** → connect **GitHub** and select `N1KTO-MHTM/Relaxe_Drive`.
   - Render will read `render.yaml` and create **relaxdrive-api**, **relaxdrive-web**, and **relaxdrive-db**.
3. **Environment**
   - `JWT_SECRET` is auto-generated.
   - `DATABASE_URL` is linked to the blueprint database.
   - Adjust `CORS_ORIGINS` and `VITE_API_URL` / `VITE_WS_URL` if you use different Render URLs.

### After repo is connected

- **Push to `main`** → Render automatically builds and deploys both **relaxdrive-api** and **relaxdrive-web**.
- To deploy manually: Dashboard → select the service (e.g. **relaxdrive-web**) → **Manual Deploy** → **Deploy latest commit**.

### URLs (from your blueprint)

- Web: `https://relaxdrive-web.onrender.com`
- API: `https://relaxdrive-api.onrender.com`

Free-tier services spin down after inactivity; the first request after idle may take 30–60 seconds to wake.
