# Deploy: Vercel (web) + Render (API) + nHost (Postgres)

This repo is a **pnpm monorepo**. Production split:

| Layer        | Suggested host | Role |
|-------------|----------------|------|
| **Database** | **nHost**      | Postgres `DATABASE_URL` (existing pattern in `backend/.env.example`). |
| **API**      | **Render**     | Nest app; listens on `PORT` (Render sets this, usually `10000`; image defaults to `8080`). |
| **Web**      | **Vercel**     | Next.js in `web/`; calls the public API URL. |

---

## 1. nHost (database)

1. In the nHost dashboard, open your project → **Database** → connection string.
2. Use it as **`DATABASE_URL`** for the API (Render environment variables). Prefer `sslmode=require` if offered.
3. Run migrations against that URL from CI or your machine:

   ```bash
   pnpm run db:migrate:env
   ```

   (`backend/.env` or env must point at nHost when you run this.)

---

## 2. Render (backend)

File: [`Dockerfile.api`](../Dockerfile.api) (repo root).

1. In Render, create a **Web Service** connected to this GitHub repository.
2. Choose **Docker** runtime and point it at `Dockerfile.api` in the repo root.
3. Set environment variables in Render (example — adjust to your stack):
   - `DATABASE_URL=postgresql://...`
   - `SESSION_SECRET=<32+ random chars>`
   - `API_URL=https://<your-render-service>.onrender.com`
   - `FRONTEND_URL=https://<your-vercel-domain>`
   - `GOOGLE_CALLBACK_URL=https://<your-vercel-domain>/api/auth/google/callback`
   - `MAPBOX_ACCESS_TOKEN=...`
   - `LEMON_SQUEEZE_API_KEY=...`
   - `LEMON_SQUEEZE_WEBHOOK_SECRET=...`
   - `LEMON_SQUEEZE_STORE_ID=...`
   - `LEMON_SQUEEZE_VARIANT_ID=...`

   Add any other keys from `backend/.env.example` you use in production.

4. **Lemon webhooks:** In the Lemon dashboard, set the webhook URL to:

   `https://<your-render-service>.onrender.com/payments/webhooks/lemon-squeeze`

5. Deploy from Render (auto-deploy on push to your configured branch, or trigger a manual deploy).

6. Confirm: `curl https://<your-render-service>.onrender.com/restaurants` (or health route you expose).

The container exposes **8080**; Render injects **`PORT`** — Nest reads `PORT` from the environment (`backend` config).

---

## 3. Vercel (web)

1. Import the GitHub repo in Vercel.
2. **Root Directory:** `web`
3. **Framework:** Next.js (auto).
4. Install/build are overridden by [`web/vercel.json`](../web/vercel.json): install and build run from the **monorepo root** so `design-system` and `workspace:*` resolve.

**Environment variables (Vercel → Project → Settings → Environment Variables):**

| Variable | Example |
|----------|---------|
| `NEXT_PUBLIC_API_URL` | `https://<your-render-service>.onrender.com` |
| `NEXT_PUBLIC_WS_URL` | `https://<your-render-service>.onrender.com` (Socket.IO uses HTTP(S) origin) |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Your Mapbox token |
| `GOOGLE_CLIENT_ID` | Same as backend OAuth client |
| `GOOGLE_CLIENT_SECRET` | Server-only; for `/api/auth/google` routes |

Copy any other `NEXT_PUBLIC_*` / server keys from `web/.env.example` as needed.

5. **Google OAuth:** Authorized redirect URIs must include  
   `https://<your-vercel-domain>/api/auth/google/callback`.

6. Deploy; verify the site loads and API calls go to Render (browser Network tab).

---

## 4. Mobile / Expo

Set `EXPO_PUBLIC_API_URL` (and payment/Lemon vars) to your **public** API URL (`https://…onrender.com`), not localhost.

---

## 5. Optional: local Docker smoke test

From repo root:

```bash
docker build -f Dockerfile.api -t yamma-api .
docker run --rm -p 8080:8080 -e PORT=8080 -e DATABASE_URL="..." -e SESSION_SECRET="..." yamma-api
```

Use a real `DATABASE_URL` for a meaningful test.
