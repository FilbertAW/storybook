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

## Block 4 — Access and checkout

- **Prompt:** start block 4.
- **Asked first (plan conflicts, per CLAUDE.md):**
  1. The plan says `POST /orders` is for parents, but also expects a creator buying their own book to get `409 ALREADY_OWNED`. Chose parents only: creators get 403 `FORBIDDEN_ROLE` on `/plans`, `/orders` and `/subscriptions/*`. The ownership check stays in `CheckoutService` and is tested at service level.
  2. The dev clock endpoint (a plan cut-line item). Chose an env-gated in-process offset (`ENABLE_DEV_CLOCK`). It works on a local server but resets between serverless invocations, so it is unreliable on Vercel.
- **Result:**
  - `resolveAccess(subject, book, now)`: a pure function, six rules in the plan's order. `AccessService` loads a subject (purchased book ids + the active-marked subscription row) in two queries per request, so a list of N books costs the same as one.
  - Reads: `GET /books` (filters `q`, `age`, `access`), `/books/:id`, `/books/:id/pages`, `/books/:id/pages/:n`. The preview limit is applied in the SQL, so a page the reader may not see is never loaded. Kid tokens get full-access books only and no `priceIdr`; a locked book is a 404 for a kid, not a preview.
  - Checkout: `GET /plans`, `POST /orders` (+ `Idempotency-Key`), `POST /orders/:id/pay`, `GET /orders`, `POST /subscriptions/current/cancel`. `PaymentGateway` interface with `MockPaymentGateway`, injected through `createApp`.
  - `GET /me` now carries the subscription summary and owned book ids (moved to `modules/account`). `POST /events` (204). `GET/POST /dev/clock` behind the flag.
- **Decisions made without asking (open to change):**
  - Idempotency: a replay returns the original order (200 instead of 201) before any rule runs; the same key with a different book or plan is `400 VALIDATION_ERROR`. Keys are scoped per user.
  - Concurrency: `onConflictDoNothing` on `(user, key)` for racing creates; `settlePaid` claims the order with a conditional `pending → paid` update first, then grants in the same transaction. A second concurrent payment finds nothing to claim.
  - If two pending orders exist for the same book or subscription, the second to be paid gets `409 ALREADY_OWNED` / `ALREADY_SUBSCRIBED`, rolls back, and the order is closed as failed.
  - The server logs an `order_paid` event inside the grant transaction (the plan's paywall-conversion metric needs it).
  - Order of checks when buying a book: not found (404) → already owned (409) → not published (409 `BOOK_NOT_PURCHASABLE`) → overlap acknowledgement (409). An owned archived book is `ALREADY_OWNED`, not "not purchasable".
  - `subscriptionOverlapAck` is stored true only when there really was an active subscription.
  - A subscription row still marked `active` past its end is flipped to `expired` inside the grant transaction (lazy expiry), so the partial unique index stays correct.
  - `GET /books` for a creator shows the same published catalog as a parent (their own books as `owner`, no drafts); their drafts are on `/creator/books` and openable by id.
  - `POST /events` rejects an unknown `bookId` with 404 rather than failing on the foreign key.
- **Gap found in the plan (not changed, needs a decision):** rule 2 (draft → not found) runs before rule 3 (purchased → full). A creator can `PATCH` a book with buyers back to `draft`, and the buyers then get 404 on a book they paid for, while `/me` still lists it as owned. That contradicts "a purchase is ownership". Verified with a one-off probe. No test asserts it.
- **Verified:** 187 tests (resolveAccess unit tests for every rule and boundary; catalog, kid, pages and entitlement; checkout, idempotency and races; subscription and cancel; events, `/me`, dev clock), typecheck, lint, and a curl walk-through on a live server. Mutation check: breaking the preview SQL limit turns two tests red.
- **Not verified:** the Turso half of the plan's "done" signal, and the Vercel entry.

## Block 5 — Frontend

- **Prompt:** start block 5.
- **Dependencies added (all on the stack list):** `@tanstack/react-query`, `zustand`, `react-router` (v8). shadcn components added: card, input, label, badge, tabs, dialog, textarea, alert, separator.
- **Result:** login (pick a seeded user), library with All / My books / Locked tabs plus search and age filter, book detail, reader with the paywall after the preview, checkout (review → overlap warning → mock payment → result), account (subscription and cancel, PIN, Kid mode entry, orders), Kid mode (library, reader, PIN pad to leave), creator dashboard and book form.
- **Structure:** `src/api` (typed client, endpoints, query hooks), `src/stores/session.ts` (Zustand: token and mode only), `src/features/*`, `src/app` (router, shells, guards). Responses are parsed with the shared zod schemas; the book form validates with the same `createBookRequestSchema` the server uses.
- **State rules followed:** server data only in TanStack Query. The API client reads the token with `useSessionStore.getState()`. Every parent/kid switch and logout calls `queryClient.clear()` (`features/session/actions.ts`). A successful payment invalidates `books`, `me` and `orders`. Entering Kid mode overwrites the persisted token, so a reload stays in Kid mode.
- **Decisions made without asking (open to change):**
  - Kid mode cannot call `/me`, so `mode` lives in the store; the role comes from `/me` for parents.
  - Checkout is a page (`/checkout/book/:id`, `/checkout/subscription`), not a dialog, so it survives a reload. One `Idempotency-Key` per attempt; "Try again" makes a new one.
  - `SessionGate` pins a device in Kid mode to `/kid`, whatever URL is opened. Role guards only hide screens; the server enforces roles.
  - Reader events: `book_opened` on open, `preview_completed` when the paywall shows.
  - Creator form: new pages and the cover get placeholder `picsum.photos` URLs to fill quickly; the creator can paste real ones.
  - The Vite template's `erasableSyntaxOnly` forbids constructor parameter properties, so web classes use plain fields.
- **Found and fixed:** the reader requested `/plans` in Kid mode, where it is always refused; now parent-only.
- **Verification (no browser tooling was available):** typecheck, lint, production build, and the Vite dev server compiling every screen. A throwaway test (not committed: it needs a test runner in the web package) ran the real frontend client, zod parsing, session store and query cache against the real API, in-process, through all three "done when" journeys: Locked → pay → reading (incl. failed payment, retry, idempotent replay), subscribed purchase with the overlap warning, Kid mode hand-over and PIN return (parent token gone from persisted storage, cache cleared, `/me` and `/plans` refused for a kid, wrong PIN message, lockout message, no-PIN flow), creator create → publish → visible to parents → delete, and a rejected token ending the session.
- **Not verified:** the rendered UI itself (layout, Base UI dialog/tabs/button behaviour, mobile widths). Nobody has clicked through it yet.
- **Still open from block 4:** a creator can unpublish a book with buyers (rule 2 before rule 3). The dashboard's Unpublish button exposes it.

## Follow-up: publishing is one-way

**Prompt:** Asked about the unpublish gap (a creator could unpublish a book with buyers, and buyers then got 404). I proposed refusing unpublish; the user argued draft may not be needed, I pushed back that it still lets a creator check a book before it goes live and that books with sales can't be deleted anyway. The user decided: keep draft only as the first state; once published, a book never goes back to draft.

**Produced:** `BookService.update` rejects `published → draft` with `VALIDATION_ERROR` (400). The dashboard shows Publish only for drafts (Unpublish removed). The book form disables the publish checkbox for an already-published book. The old "unpublishes back to draft" test now asserts the rejection and that the book stays published. Retiring a published book is archive (delete archives when orders exist).

**Rejected:** removing draft entirely (would change the plan's data model, rule 2 and the seed). Refusing only when orders exist (a one-way rule is simpler and has no race with a purchase landing right after the check).

**Also:** migrated and seeded the Turso database (`storylib`) from a gitignored `apps/api/.env.turso`. README added.

## Follow-up: no draft state

**Prompt:** The user decided drafts aren't needed: the app focuses on parents and kids, creators are secondary. A book is published when created, then can only be edited or deleted (archived if it has orders). This supersedes the one-way-draft change above.

**Produced:** Removed `draft` from the status check, shared schemas, `resolveAccess` (rules now 5), the seed (Bobo Learns to Share removed), and the book service (create = published; PATCH no longer takes `status`). The dashboard lost its Publish button; the book form lost the publish checkbox ("Publish book"). `docs/PLAN.md`, `CLAUDE.md` and the README were updated to match. Regenerated the initial migration (`0000_exotic_george_stacy.sql`) since nothing is deployed yet. Tests: 180 pass (draft-only tests removed; delete and cascade tests now use an unordered published book).

**Note:** the Turso database still has the old schema (with `draft` in its check). It needs its tables dropped and `db:setup` re-run; this was not done yet.

## Block 6: deploy

**Prompt:** Deploy the API and web as two Vercel projects against Turso; the user created the Turso database and token and logged in to Vercel.

**Produced:** `storylib-api` (root `apps/api`) and `storylib-web` (root `apps/web`) on Vercel, Turso reset and seeded to the no-draft schema, CORS set to the web origin, SPA rewrite for the web app. The first API deploys failed: `npm install` could not resolve the workspace package from `apps/api`; then Node could not load extensionless TypeScript imports (`ERR_MODULE_NOT_FOUND`); then Vercel wants a static output directory; then a default-exported Hono handler is ignored (needs one export per HTTP method). The fix was an esbuild bundle (`esbuild` added as a devDependency with the user's approval), a placeholder `public/robots.txt`, and per-method exports in `src/vercel.ts`. Node pinned to 22.x.

**Verified on production (curl):** health, login, parent A's library shows 5 locked + 1 purchased, parent B all `subscription`, a locked page fetched directly returns 403, a kid token gets 403 on `/me`, no token is 401, a parent on a creator route is 403, CORS preflight allows only the web origin. Not re-run on production: checkout, PIN lockout and subscription expiry (covered by the 180 API tests and the in-process journeys), and the rendered UI.

## Follow-up: preview modal for locked books

**Prompt:** For a locked book, open a modal instead of navigating, so a parent sees the preview with the price on top.

**Produced:** `BookPreviewDialog` (Base UI dialog): title and author, a price bar with "Buy this book" and "Subscribe" above, then the preview pages with Back/Next and an end-of-preview note. The library's `BookCard` takes an optional `onPreview` and uses it only for locked books; owned and subscription books still open the book page. It logs the same `book_opened` and `preview_completed` events as the reader. The book page and reader still work for direct links. Creators see the preview without buy buttons.

**Not verified:** how it renders (typecheck, lint and build only).
