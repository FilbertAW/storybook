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

## Seeded accounts

Log in with the email only (mock login, no password).

| Email | Role | Scenario |
| --- | --- | --- |
| `parent.a@example.com` | parent | No subscription, owns a book, PIN `1234` |
| `parent.b@example.com` | parent | Active subscription, PIN `1234` |
| `parent.c@example.com` | parent | Expired subscription, owns an archived book, **no PIN set** |
| `sari@example.com` | creator | Has published books |
| `budi@example.com` | creator | Has published books |

The demo parent PIN is **1234**. Entering Kid mode needs a PIN, so parent C is the "set a PIN first" flow. Five wrong PINs lock Kid-mode exit for five minutes.

Payments are mocked: the checkout page lets you choose success or failure.

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
