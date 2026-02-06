# Using Your Own Domain (RelaxeDrive) Instead of Render URL

To serve the app as **RelaxeDrive** on your own domain (e.g. `app.relaxdrive.com`) instead of `relaxdrive-web.onrender.com`:

## 1. Add a Custom Domain on Render

1. Open [Render Dashboard](https://dashboard.render.com).
2. Select the **relaxdrive-web** (static site) service.
3. Go to **Settings → Custom Domains**.
4. Click **Add Custom Domain** and enter your domain (e.g. `app.relaxdrive.com` or `relaxdrive.com`).
5. Add the CNAME (or A) record Render shows you in your DNS provider (e.g. Cloudflare, Namecheap).  
   Example: `app.relaxdrive.com` → `relaxdrive-web.onrender.com` (CNAME).
6. Repeat for **relaxdrive-api** if you want the API on a subdomain (e.g. `api.relaxdrive.com` → `relaxdrive-api.onrender.com`).

## 2. Update Environment Variables on Render

After the custom domain is active:

- **relaxdrive-api** → **Environment**:
  - Set **CORS_ORIGINS** to include your frontend URL, e.g.  
    `https://app.relaxdrive.com,https://relaxdrive-web.onrender.com,http://localhost:5173`

- **relaxdrive-web** → **Environment** (then **Manual Deploy** to apply):
  - **VITE_API_URL** = `https://api.relaxdrive.com` (or your API custom domain; if you kept API on Render, use `https://relaxdrive-api.onrender.com`).
  - **VITE_WS_URL** = same as VITE_API_URL.

## 3. White Label in the App

1. Log in as **Admin** and open **White Label**.
2. Set **Domain** to your public domain, e.g. `app.relaxdrive.com` (used for links/branding where the app shows the domain).
3. Optionally set **Logo URL** and **Primary color** for RelaxeDrive branding.
4. Click **Save**.

## 4. Optional: Change `render.yaml` for New Deploys

In `render.yaml` you can replace the default Render URLs with your domain so new deploys use it:

- Under **relaxdrive-api** → **envVars** → **CORS_ORIGINS**: use `https://app.relaxdrive.com,...` (and keep `http://localhost:5173` for local dev).
- Under **relaxdrive-web** → **envVars**: set **VITE_API_URL** and **VITE_WS_URL** to your API URL (e.g. `https://api.relaxdrive.com`).

The app name is already **RelaxeDrive** in the UI; the custom domain only changes the URL in the browser and in White Label.
