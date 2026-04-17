# Yamma – Architecture

## High-level

- **Monorepo:** `design-system`, `backend`, `web`, `mobile`.
- **Backend:** NestJS, REST + WebSockets, PostgreSQL (nHost), session auth (Lucia-style).
- **Web:** Next.js 16, App Router, design-system.
- **Mobile:** React Native, shared design tokens, same API and WebSockets.

## Design system

- **Location:** `/design-system`.
- **Contents:** Tokens (colors, typography, spacing, motion), theme, shared components (Button, RestaurantCard, MenuItemCard, CartDrawer, Input, Modal, Toast, ThemeProvider).
- **Usage:** Web uses components and Tailwind; mobile can use tokens and RN-specific wrappers (or mirror components with StyleSheet).

## Backend modules

| Module       | Responsibility                          |
|-------------|------------------------------------------|
| Config      | Env validation (Zod), ConfigService      |
| Auth        | Session create/validate, guards, cookies  |
| Users       | CRUD, password hash (bcrypt), roles      |
| Restaurants | List by proximity, menus, menu items     |
| Orders      | Create, list, get, status updates        |
| Reviews     | Create, list by restaurant, avg rating    |
| Payments    | Provider abstraction, Lemon/Coinbase     |
| Mapbox      | Geocode, reverse, route/ETA             |
| Delivery    | Drivers, driver assignment, webhook, status |
| Events      | WebSocket gateway (order/driver events)  |

## Data flow

- **Auth:** Login/register → session in DB → cookie (web) or Bearer token (mobile). Guards on protected routes.
- **Restaurants:** GET with `lat`/`lng` → haversine sort → return list.
- **Orders:** POST with items and address → order + order_items → optional payment → WebSocket status updates.
- **Payments:** Create payment with provider → redirect to checkout URL → webhook updates order and payment status.
- **Delivery:** Driver app (future) sends webhooks and location; backend updates `driver_assignments` and emits WebSocket events.

## Database (Drizzle + PostgreSQL)

- **Tables:** users, sessions, restaurants, menus, menu_items, orders, order_items, payments, reviews, drivers, driver_assignments.
- **Enums:** role, order_status, payment_status, payment_provider.
- **Indexes:** On FKs and query fields (user_id, restaurant_id, order status, created_at, etc.).

## Real-time

- **WebSocket:** Single namespace, rooms `order:{id}`, `restaurant:{id}`, `admin`.
- **Events:** `order:status`, `driver:location`, `restaurant:order`, `admin:alert`.
- **Client:** Subscribe with `subscribe:order` and `orderId` to receive status and driver location.

## Security

- Session secret for signing; no secrets in frontend.
- Input validation (Zod) on API boundaries.
- Role guard for admin/restaurant routes.
- Payment and delivery webhooks verified with HMAC.
