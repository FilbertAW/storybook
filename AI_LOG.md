# AI log

One entry per prompt: what was asked, what came back, what we changed and why.
The AI-usage slide is written from this file.

## 2026-11-06

- **Prompt:** start the project from `docs/PLAN.md`; create the monorepo foundation first.
- **Result:** project folder, pnpm workspace root, plan copied to `docs/PLAN.md`, `CLAUDE.md`.
- **Changed:** nothing yet.

- **Prompt:** use the `CLAUDE.md` from Downloads instead.
- **Result:** replaced the drafted `CLAUDE.md` with the provided one (block-by-block workflow, stack, layering, access rules, Kid mode, frontend state, API conventions, testing).
- **Changed:** my first draft discarded; the provided file is the project's working contract.

## Block 1 — Scaffold (local; deploy waits on Turso and the Vercel projects)

- **Prompt:** do the hour-0 block with ESLint, and commit the foundation alongside the scaffold.
- **Result:** `packages/shared` (error codes, error response and health schemas), `apps/api` (Hono, `/api/v1/health`, CORS from env, zod-validated env, `server.ts`, Vercel entry `api/index.ts` + `vercel.json`, vitest health test), `apps/web` (Vite, React, Tailwind v4, shadcn/ui init, shell page that calls `/health`), root ESLint flat config, `tsconfig.base.json`.
- **Asked first:** `@hono/node-server` (not on the stack list); approved.
- **Changed / rejected:** the Vite template shipped oxlint and TypeScript 7. Dropped oxlint for ESLint as chosen; pinned TypeScript to ~6.0.3 because `typescript-eslint` only supports TypeScript below 6.1.
- **Not verified yet:** the Vercel entry (`handle(...)` + rewrite) has not run on Vercel; the live `/health` check needs the deploy.
- **Verified locally:** typecheck, lint and tests pass; `curl /api/v1/health` returns `{"status":"ok"}`; web builds.

## Block 2 — Schema and seed (production half waits on Turso)

- **Prompt:** skip the deploy for now and start block 2.
- **Result:** Drizzle schema for the 8 tables (`apps/api/src/db/schema.ts`), initial migration `0000_init.sql`, `createDb` client, `migrateDb`, `seedDatabase(db, now)`, a `db:*` CLI (`migrate`, `seed`, `setup`), `hashPin` (scrypt, `node:crypto`), seed content (`seed-data.ts`), `DATABASE_URL` and `DATABASE_AUTH_TOKEN` env vars.
- **Seed:** 5 users (parents A/B/C, creators Sari and Budi), 1 plan, 8 books (6 published, 1 draft, 1 archived), 64 pages. A owns a published book; B has an active subscription; C has a subscription that ended 10 days ago (row still `active`, since expiry is lazy) and owns the archived book. Demo PIN `1234` for A and B; C has no PIN to demo `PIN_NOT_SET`.
- **Beyond the plan's table (constraints only, no new columns):** CHECKs for `age_min <= age_max`, `page_number >= 1`, `orders.amount_idr > 0`, `current_period_end > current_period_start`. The plan's separate `purchases (user_id)` index is skipped: the unique `(user_id, book_id)` index already serves it.
- **Changed / rejected:** my first constraint tests used bare `toThrow()`, which would pass for the wrong error; rewrote them to assert the exact SQLite message after checking each fails for the intended reason.
- **Verified:** typecheck, lint, 13 tests pass; migrate + seed on a local file; reseed is repeatable; FK enforcement and cascade work on libSQL.
- **Not verified:** migrate/seed against Turso (no account yet).

## Block 3 — Auth, Kid mode and books

- **Prompt:** start block 3.
- **Result:** mock login with a signed JWT (`hono/jwt`, HS256, `sub` + `scope` + `exp`), `authenticate` middleware, role and scope guards, Kid mode (`POST /auth/kid-mode`, `POST /auth/parent-unlock`), `PUT /me/pin`, `GET /me`, creator book CRUD (`GET /creator/books`, `POST/PATCH/DELETE /books`), the error middleware, injected `Clock`. Zod schemas for all of it in `packages/shared`. Layered as routes → services → repositories under `src/modules/{auth,books}`.
- **Kid token enforcement:** one allowlist in `kidScopeGuard` (the book reads, `POST /events`, `POST /auth/parent-unlock`); everything else is `KID_MODE_FORBIDDEN`. The read and event routes named there do not exist yet, they arrive in blocks 4 and 5.
- **Decisions made without asking (open to change):**
  - Both token types live 7 days; the plan only fixed the kid token.
  - The 5th wrong PIN answers `429 PIN_LOCKED` itself (not a 6th request); the attempt counter resets when the lock starts, so a lock gives 5 fresh attempts.
  - Changing a PIN needs the current one and shares the same lockout, so the endpoint cannot be used to guess it.
  - Wrong-format PINs (not 4–6 digits) are a 400 and do not count as attempts.
  - Role is read from the database on every request, not from the token, so a reseeded database invalidates old tokens (401).
  - Editing an archived book returns `400 VALIDATION_ERROR`; there is no error code for "archived" and adding one changes the API shape.
  - A hard delete nulls `events.book_id` first, because events reference books.
  - `GET /me` has only `user` and `pinSet` for now; subscription summary and owned book ids come with block 4.
- **Bug found by tests:** `pageCount` was always 0. Drizzle drops the table qualifier in a single-table select, so `${books.id}` inside the subquery resolved to `book_pages.id`. Fixed with an explicit `"books"."id"`.
- **Rejected / changed:** my first draft of the auth test file contained a nonsensical "user no longer exists" test; replaced with a forged-for-unknown-user token. A helper sent a body on GET requests; fixed.
- **Verified:** 71 tests, typecheck, lint; a real server smoke test with curl (login, Kid mode, wrong PIN, role gating, creator list).
