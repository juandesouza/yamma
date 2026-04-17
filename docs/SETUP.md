# Yamma – Local setup

## Prerequisites

- Node.js 20.9+
- pnpm 9+
- nHost account (PostgreSQL) or optional local Postgres
- Mapbox account (for geocoding/maps)
- Lemon Squeeze / Coinbase Commerce (optional, for payments)

## 1. Clone and install

```bash
cd yamma
pnpm install
```

## 2. Database (nHost PostgreSQL)

Yamma uses **Postgres in `public`** (tables like `users`, `orders`, `restaurants`, …). **nHost** provides the database; the Drizzle schema in `backend/src/db/schema.ts` is the source of truth, and **`backend/drizzle/*.sql`** is the checked-in migration that creates the same columns on the server.

**Option A – nHost (default)**

1. Create a project at [nhost.io](https://nhost.io).
2. Dashboard → **Database** → copy the PostgreSQL connection string into `backend/.env` as `DATABASE_URL`.
3. Apply schema:

```bash
pnpm run db:migrate:env
```

(`db:migrate:env` reads `DATABASE_URL` from `backend/.env` only, so a `backend/.env.local` Docker URL does not steal the migration target.)

Use `pnpm run db:generate` after you change `schema.ts`, then commit new files under `backend/drizzle/` and run `db:migrate:env` on each environment.

**If migrate fails with “type … already exists”** (schema was applied earlier via `db:push`): run `pnpm run db:push:env` once to align columns, or use a fresh database and `db:migrate:env`.

### Troubleshooting: `getaddrinfo ENOTFOUND` (database host)

If `pnpm run db:restaurants-status` or the backend fails with **ENOTFOUND** for the database hostname:

- The **hostname in `DATABASE_URL` is wrong or outdated** (common after nHost project changes).
- **Fix:** nHost Dashboard → your project → **Database** / PostgreSQL → copy the **current** connection string → update `backend/.env` → `DATABASE_URL`.
- Also check VPN/DNS/network; or use **local PostgreSQL** (Option B).

**Option B – Local PostgreSQL (optional)**

Either install PostgreSQL on your machine, or use Docker (no `sudo` needed if Docker is installed):

```bash
# From the repo root:
docker compose up -d
cp backend/.env.local.example backend/.env.local
# backend loads .env.local over .env for DATABASE_URL
pnpm run db:migrate
```

With Docker, the default URL is:

`postgresql://postgres:yamma_local_dev@localhost:5432/yamma`

Demo restaurants (130 sample rows, names end with `[FAKE]`):

```bash
pnpm --filter backend run seed:restaurants
```

If card images break (old Pexels URLs), refresh URLs from the shared Unsplash map:

```bash
pnpm --filter backend run db:fix-restaurant-images
```

The web home page asks the browser for **location** (HTTPS or `localhost` only) to sort restaurants by distance in **miles**. If permission is denied, it falls back to Washington, DC.

**Option B2 – Native local install**

```bash
createdb yamma
# Example URL (adjust user/password if your Postgres requires them):
# postgresql://postgres:YOUR_PASSWORD@localhost:5432/yamma
```

## 3. Backend env

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

- `DATABASE_URL` – nHost PostgreSQL URL (required). Optional `backend/.env.local` overrides for local Docker.
- `SESSION_SECRET` – At least 32 characters (required).
- `MAPBOX_ACCESS_TOKEN` – From [Mapbox](https://account.mapbox.com/) (optional).
- `LEMON_SQUEEZE_*` / `COINBASE_COMMERCE_*` – For payments (optional).
- `DELIVERY_WEBHOOK_SECRET` – For future driver app webhooks (optional).

## 4. nHost CLI (optional)

To use the nHost CLI for project info or local dev:

**Option A – Install into the project (recommended)**

From the backend directory:

```bash
cd backend
npm run nhost:install
```

This downloads the nHost CLI binary into `backend/bin/nhost`. Then run:

```bash
npm run nhost:info   # project info (after linking)
npm run nhost:link   # link to your nHost cloud project
npm run nhost        # run any nhost command, e.g. npm run nhost -- up
```

**Option B – Install globally**

```bash
curl -sL https://raw.githubusercontent.com/nhost/cli/main/get.sh | bash
```

Then use `nhost` from anywhere. From the project root or backend you can still use `npm run nhost:info` and `npm run nhost:link` (they use the global binary if `backend/bin/nhost` is not present).

## 5. Push database schema

```bash
pnpm run db:push
```

This runs Drizzle and creates tables in your database.

## 6. Run backend

```bash
pnpm run dev:backend
```

API: `http://localhost:3001`

## 7. Web app env

```bash
cp web/.env.example web/.env.local
```

Set:

- `NEXT_PUBLIC_API_URL=http://localhost:3001`
- `NEXT_PUBLIC_WS_URL=ws://localhost:3001`
- `NEXT_PUBLIC_MAPBOX_TOKEN` (optional)

## 8. Run web app

```bash
pnpm run dev:web
```

Web: `http://localhost:3000`

## 9. Mobile (Expo + React Native)

From the **repo root** (after `pnpm install`):

0. **Design system bundle** (required for `@yamma/design-system`):

   ```bash
   pnpm --filter @yamma/design-system run build
   ```

1. **Native project (first time, or after upgrading Expo):** Android is checked in; **iOS** is generated on a Mac with:

   ```bash
   pnpm run prebuild -w mobile -- --platform ios
   ```

2. **Backend** must be running (`pnpm run dev:backend`) on port **3001**.

3. **Start Metro:**

   ```bash
   pnpm run dev:mobile
   ```

4. **Expo Go on a phone:** install **Expo Go** from the App Store / Play Store. With Metro running, scan the QR code from the terminal or Dev Tools page. The phone cannot reach your laptop’s `localhost`, so create `mobile/.env` with  
   `EXPO_PUBLIC_API_URL=http://YOUR_LAN_IP:3001`  
   (see `mobile/.env.example`), then restart Metro. Use the same Wi‑Fi as your computer.

5. **If the QR code won’t connect:** run  
   `pnpm run mobile:expo -- start --tunnel`  
   (from the repo root), or `cd mobile && pnpm exec expo start --tunnel`. Do **not** run `pnpm exec expo start` from the monorepo root — the root package does not depend on `expo`, so the CLI will error.

6. **Android emulator / iOS Simulator (optional):** `pnpm run android -w mobile` or prebuild iOS then `pnpm run ios -w mobile`.

**Note:** Cookie-based auth is limited in React Native; the home/restaurant list works without login. Order tracking and login flows need a session strategy (e.g. token API) for full parity with the web app.

## 10. Seed data (optional)

Insert test user and restaurant via SQL or a small script against the backend (e.g. POST `/auth/register`, then create restaurant with that user as owner). Tables: `users`, `restaurants`, `menus`, `menu_items`.

## API overview

- `POST /auth/register` – Register (email + password).
- `POST /auth/login` – Login (sets cookie `yamma_session`).
- `POST /auth/logout` – Logout.
- `GET /restaurants?lat=&lng=` – Restaurants near location (sorted by distance).
- `GET /restaurants/:id`, `GET /restaurants/:id/menus` – Restaurant and menus.
- `POST /orders` – Create order (requires auth).
- `GET /orders`, `GET /orders/:id` – List / get order (auth).
- `GET /mapbox/geocode?q=`, `GET /mapbox/reverse?lat=&lng=`, `GET /mapbox/route?fromLat=...` – Mapbox proxy.
- `POST /payments/create` – Create payment (Lemon Squeeze / Coinbase Commerce).
- WebSocket: connect to backend, emit `subscribe:order` with `{ orderId }` to get `order:status` and `driver:location` events.

## Troubleshooting

- **Config validation error:** Ensure `SESSION_SECRET` has at least 32 characters and `DATABASE_URL` is set.
- **CORS:** Backend allows `localhost:3000` and `API_URL`. Add your frontend origin if needed in `main.ts`.
- **Cookies:** Web login uses `yamma_session` cookie; ensure frontend calls API with `credentials: 'include'` and same-origin or correct CORS.
