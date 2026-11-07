# Storybook Library

A paid digital storybook library for kids aged 2–8. Parents buy books or subscribe, children read in Kid mode, creators manage books. Built as a take-home MVP; the decisions and edge cases are in [`docs/PLAN.md`](docs/PLAN.md) and the AI-assisted build history is in [`AI_LOG.md`](AI_LOG.md).

This is one pnpm monorepo, so the "backend repo" is `apps/api`.

```
apps/api         Hono + Drizzle + libSQL (routes → services → repositories)
apps/web         React + Vite + Tailwind + shadcn/ui, TanStack Query, Zustand
packages/shared  zod schemas, DTO types and error codes used by both
```

## Run locally

Needs Node 22+ and pnpm.

```sh
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env   # only if you want to change the API URL
pnpm api db:setup     # migrate + seed a local SQLite file
pnpm api dev          # API on http://localhost:8787
pnpm web dev          # web on http://localhost:5173
```

Checks: `pnpm typecheck`, `pnpm lint`, `pnpm test` (API tests, in-memory SQLite).

## Languages

The app is in Indonesian by default and can be switched to English with the **ID | EN** toggle (top right, on the sign-in page and in Kid mode too). The choice is remembered in the browser. Texts live in `apps/web/src/i18n` (`en.ts` defines the keys, `id.ts` must translate every one). API error codes are translated in the client, so error messages follow the chosen language. Book titles and descriptions are content from the seed data and stay in English.

## Account credentials

The sign-in page only asks for an email. Login is a mock, so there is no password. Use one of the seeded accounts:

| Email | Role | What it shows |
| --- | --- | --- |
| `parent.a@example.com` | parent | No subscription, owns one book, PIN `1234`. The locked → buy → read journey. |
| `parent.b@example.com` | parent | Active subscription, PIN `1234`. Every book is open; buying one shows the overlap warning. |
| `parent.c@example.com` | parent | Subscription ended, owns a retired book, **no PIN yet**. The set-a-PIN flow. |
| `sari@example.com` | creator | Three published books. Create, edit and delete. |
| `budi@example.com` | creator | Three published books and a retired one. |

The parent PIN for Kid mode is **1234** (parents A and B). Five wrong PINs lock Kid-mode exit for five minutes.

## Payments

Payments go through a `PaymentGateway` interface; the only implementation is `MockPaymentGateway`, so no real money moves. The checkout page has a single **Pay** button, which succeeds.

### Simulating a failed payment

The failure path is built and tested but its button is hidden. To show it:

1. In `apps/web/src/features/checkout/CheckoutPage.tsx`, uncomment the **Simulate failure** button in the payment step (the commented block next to the Pay button). It calls `pay.mutate('fail')`.
2. Pay with it: the order is marked `failed`, the page shows "Payment failed", and nothing is granted. "Try again" starts a new order, because a failed order cannot be paid.

Or call the API directly: `POST /api/v1/orders/:id/pay` with `{ "simulate": "fail" }` returns 402 `PAYMENT_FAILED`.

## Demonstrating subscription expiry

Set `ENABLE_DEV_CLOCK=true` on the API to mount `GET/POST /api/v1/dev/clock`, which shifts the API's clock. Do not enable it in production.

## Deployment

API and web are two Vercel projects from this repo. The database is Turso in production (same libSQL client, config from env only).

- API env: `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `JWT_SECRET` (32+ chars), `CORS_ORIGIN` (the web origin).
- Web env: `VITE_API_URL`.
- Run `pnpm api db:setup` against Turso with the production env to migrate and seed.

Deployed links:

- Web: https://storylib-web.vercel.app
- API: https://storylib-api.vercel.app/api/v1/health

The API is bundled with esbuild for Vercel (`pnpm api build`, see `apps/api/scripts/build-vercel.mjs`). Deploy each project from the repo root with its Vercel project root directory set to `apps/api` or `apps/web`.
