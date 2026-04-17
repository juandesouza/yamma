# Yamma

Production-ready food delivery platform (iFood-style). Monorepo: design-system, backend, web, mobile.

## Structure

- **design-system** – Shared UI/UX, tokens, components (React + React Native compatible)
- **backend** – NestJS API, Lucia auth, PostgreSQL (nHost), WebSockets, Mapbox, payments
- **web** – Next.js 16 app (customer + restaurant web)
- **mobile** – Expo + React Native app (see [docs/SETUP.md](docs/SETUP.md) § Mobile)

## Quick start

**Database:** set `DATABASE_URL` in `backend/.env` to your **nHost** Postgres URL, then apply the schema (same columns as `backend/src/db/schema.ts` / `backend/drizzle/0000_initial.sql`):

```bash
pnpm install
cp backend/.env.example backend/.env    # edit DATABASE_URL + SESSION_SECRET, etc.
cp web/.env.example web/.env
pnpm run db:migrate:env                 # nHost URL from backend/.env (ignores .env.local Docker URL)
pnpm run dev:backend &
pnpm run dev:web
```

Optional local Postgres: `docker compose up -d` and `cp backend/.env.local.example backend/.env.local` (overrides `DATABASE_URL`). See [docs/SETUP.md](docs/SETUP.md).

## Tech stack

- **Language:** TypeScript everywhere
- **Backend:** Node.js LTS, NestJS, Lucia, nHost (PostgreSQL), WebSockets
- **Web:** Next.js 16, design-system
- **Mobile:** React Native, design-system
- **Maps:** Mapbox
- **Payments:** Lemon Squeeze (card), Coinbase Commerce (crypto)
