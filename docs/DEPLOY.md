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
   Recent migrations add missing legacy columns (e.g. `menu_items.available`, `orders.user_id`); run migrate on production after pull or checkout will fail.

### Demo data (buyer homepage)

After migrations, the DB may be empty. The public restaurant list **only includes venues that have at least one available menu item** (`findNearby` in the API filters on `menu_items`).

Seed fake venues (names end with `[FAKE]`) **and** menus:

- **Hosted DB** (`DATABASE_URL` in `backend/.env` only; ignores `.env.local`):

  ```bash
  pnpm --filter backend run seed:buyer-demo:env
  ```

- **Local dev** (uses `backend/.env.local` Docker URL when present):

  ```bash
  pnpm --filter backend run seed:buyer-demo
  ```

Run from the **monorepo root**. The restaurant insert phase can take ~30–90s on remote Postgres; menu seeding adds more round-trips.

To run steps separately: `seed:restaurants:env` then `seed:menus:env` (or the non-`:env` variants locally).

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

### Render: pushes not deploying / service looks stale

Check these in the Render dashboard for your Web Service (e.g. `yamma-api` → **Settings** / **Events**):

1. **Auto Deploy** — Under **Build & Deploy**, ensure **Auto-Deploy** is **On** for the branch you push to (usually `main`). If it is **Off** or limited to another branch, new commits will not build.
2. **Connected repository** — Confirm the service is linked to **`juandesouza/yamma`** (not a fork or an old repo) and the **production branch** matches where you push.
3. **Failed deploy** — Open **Logs** for the latest deploy. If the Docker build failed, Render will not roll out a new version until the failure is fixed; fix the error and use **Manual Deploy → Clear build cache & deploy** if needed.
4. **Suspended service** — Free-tier services suspend when idle; waking or redeploying is separate from “new code” — still verify the **latest deploy commit SHA** on the service matches GitHub `main`.
5. **Root directory** — For this repo, the Docker **context** should be the **repository root** so `Dockerfile.api` can `COPY backend ./backend`. If **Root Directory** is set to `backend` (or anything other than empty/root), the image build can fail or use the wrong paths.

To see what Render actually shipped: in the service **Events** tab, open the latest **Deploy** and note the **commit**; it should match the commit you expect on GitHub.

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
