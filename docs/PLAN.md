# Storybook Library MVP — Product, Design & Build Plan

Nov 6, 2026 · @Filbert

## Decisions & assumptions

We build the required minimum on a clean architecture, in a 12-hour cap, on documented assumptions we defend in the interview instead of asking up front.

| Area | Choice | Why | Trade-off we accept |
| --- | --- | --- | --- |
| Scope | Required features plus Kid mode; clean architecture always; UX polish after the 12 hours | The brief grades thinking more than polish; a kids' app that is not safe for kids fails its main job | A plainer first UI |
| Backend | Node + TypeScript, Hono, zod validation, Drizzle ORM, SQLite through the libSQL client | Hono runs unchanged as a Node server or a serverless function; libSQL reads a local file in dev and a hosted database in production with the same code | SQLite has a single writer; fine for a demo |
| Database and hosting | **Decided:** Turso (hosted SQLite) in production, a local SQLite file in dev; API and web both on Vercel | Free hosts wipe local files: Render's free tier loses a SQLite file on every redeploy, restart or 15-minute idle spin-down | One more account; a remote DB adds a few ms per query |
| Frontend tool | Claude Code builds it, on the stack Lovable generates (React, Vite, TS, Tailwind, shadcn/ui) | One context for business rules and shared types; the brief allows "similar AI-native tools" | The reviewer may have wanted Lovable by name; we justify it in the slides |
| Repo | One pnpm monorepo: API, web, shared types | Types and rules cannot drift between frontend and backend | The "backend repo" link points at a folder, explained in the README |
| Roles | Two account roles: parent and creator. The child uses Kid mode inside the parent account; leaving it needs the parent's PIN | Toddlers cannot log in; child accounts add privacy obligations | Per-child progress waits for child profiles (roadmap) |
| Kid mode | Enforced by the server with a kid-scoped token, not only hidden in the UI | A child can refresh or tap anywhere; a UI-only lock is not a lock | A token swap flow to build and test |
| Buying while subscribed | Allowed after a warning the server insists on; the subscription keeps its dates; owned status takes priority | Parents can keep favourites after the subscription ends | Possible "charged twice" complaints; the stored acknowledgement is the evidence |
| Admin | No admin role; data is seeded | Creators own their books, which covers the CRUD requirement | No moderation of creator uploads |
| Auth | Mock login: pick a seeded email, get a signed JWT | Real middleware path, no password flows | Anyone can log in as any seeded user |
| Payments | Two-step mock: create a pending order, then pay with success or fail, behind a PaymentGateway interface | Shows payment states and idempotency; a real gateway (Midtrans, Xendit) swaps in later | No webhooks or reconciliation |
| Money | IDR, stored as integers | Indonesian market assumption; no rounding bugs | No multi-currency |
| Subscription | One monthly plan, 30-day period, no auto-renew | Enough to show expiry and cancellation rules | Renewal is a manual re-subscribe |
| Ask vs assume | Build on assumptions, list them, discuss next round | No waiting on the recruiter inside a 3-day window | Some assumptions may be wrong; the list makes that cheap to fix |

## Product thinking

The payer and the reader are different people, so every screen answers two questions: can the parent decide quickly, and is the child safe from prices and buttons that spend money.

### Target users

| User | Role in the product | What they need | Why they matter |
| --- | --- | --- | --- |
| Parent of a 2–8 year old | Payer, account owner | Know what is free vs paid, buy without surprises, hand the device to the child safely | Holds the money and the decision |
| Child (2–8) | Reader, inside Kid mode | Big covers, only books they can open, no prices or pop-ups | Usage drives retention and renewals |
| Creator (author or publisher) | Supplies and manages books | Create, edit, publish and retire their own books | No catalog, no product |

### Key product decisions

- **Kid mode is how the child uses the app.** It shows only books the family can read, with no prices and no buy buttons. Leaving it needs the parent's PIN, and the server enforces it.
- **A purchase is ownership.** A bought book stays readable after a subscription ends and after the creator archives it.
- **Subscribers may also buy a book, after a warning.** The warning says the subscription is not refunded and the book stays theirs after the subscription ends or the creator removes it. The server refuses the order until the warning is acknowledged; the subscription keeps its own dates, and owned status takes priority.
- **Locked books stay visible to parents.** Cover, synopsis and the first 2 preview pages show in parent mode; the paywall sits at the end of the preview.
- **Creators only touch their own books.** A book is published when created (no draft state: the product is for parents and kids, not an authoring tool); deleting a book that has buyers archives it instead.
- **Price changes never touch past orders.** Each order stores the price paid.

### Assumptions

- Indonesian market first, mobile-first web, prices in IDR.
- Placeholder prices for the mock, not researched: Rp 15.000–25.000 per book, Rp 49.000 per month.
- Books are short picture books: 8–20 pages, one image and a line or two of text per page.
- One parent account per family in the MVP.

### Roadmap

1. **MVP (this assignment):** catalog, access control, mock subscription and purchase, creator CRUD, Kid mode.
2. **Families:** child profiles with reading progress, real payment gateway (Midtrans or Xendit), receipts, auto-renewal.
3. **Creators:** revenue share and payouts, creator analytics, content review before publishing.
4. **Growth:** audio narration, offline reading, bilingual books (Bahasa Indonesia and English), family plan, recommendations.

### Success metrics

| Metric | Definition | How we measure it |
| --- | --- | --- |
| Paid conversion | Share of new parents who pay within 7 days | Orders with status paid ÷ sign-ups, by cohort |
| Paywall conversion | Preview finished → order paid | Events: preview\_completed, order\_paid |
| Model mix | Subscriptions vs single purchases | Orders grouped by type |
| Activation | First book opened within 24 hours of sign-up | Event: book\_opened |
| Reading engagement | Reading sessions per family per week | Event: book\_opened, deduplicated per session |
| Subscription retention | Share of subscribers who re-subscribe after a period | Subscriptions by user over periods |
| Revenue per paying family | Monthly revenue ÷ paying families | Paid orders, monthly |

The MVP logs these events to one events table so the metrics can be computed with plain SQL; a product analytics tool comes later.

## Access control

One function, `resolveAccess(user, book, now)`, decides access for every endpoint, and the server enforces it: a locked page is never sent to the client, whatever the UI shows.

### Resolution order (first match wins)

1. **Creator of the book** → full access, reason `owner`.
2. **Purchase exists** for this user and book → full access, reason `purchased`, even if the book is archived.
3. **Book is archived** → not found for everyone else.
4. **Active subscription** (period end later than now, cancelled or not) → full access, reason `subscription`.
5. **Otherwise** → preview access, reason `locked`: metadata plus the first `preview_page_count` pages.

Every book in a list or detail response carries `access: { level: 'full' | 'preview', reason }`, so the UI picks badges and buttons from the same rule the server enforces. Expiry is computed from `current_period_end` at request time, so no background job is needed.

### Kid mode

1. The parent sets a 4 digit PIN once. It is stored as a scrypt hash from `node:crypto`, so no new dependency.
2. Entering Kid mode swaps the parent token for a **kid token** (scope `kid`, 7-day expiry). The client deletes the parent token, so a reload or reopen stays in Kid mode.
3. A kid token can only list and read books with full access, and log events. The server strips prices from those responses. Every other endpoint answers 403 `KID_MODE_FORBIDDEN`.
4. Leaving Kid mode sends the PIN and gets a parent token back. After 5 wrong attempts the PIN locks for 5 minutes; the counter lives in the database so it holds on serverless hosts.
5. Forgotten PIN in the MVP: log out and log in again as the parent. A real product would ask for a password or a one-time code.

Parent mode itself is the purchase gate, so checkout needs no extra adult check.

### Edge cases handled in the MVP

| Case | Behaviour | Enforced in |
| --- | --- | --- |
| Subscription period ends | Falls back to purchased books only | Access service, by date |
| Subscription cancelled | Access continues until period end; no refund | Subscription service |
| Subscribe while already subscribed | 409 `ALREADY_SUBSCRIBED` | Checkout service |
| Buy a book already owned | 409 `ALREADY_OWNED` | Unique (user, book) on purchases |
| Buy a book while subscribed, not acknowledged | 409 `SUBSCRIPTION_OVERLAP_ACK_REQUIRED` with the subscription end date, so the UI can show the warning | Checkout service |
| Buy a book while subscribed, acknowledged | Order proceeds; subscription keeps its dates; access reason becomes `purchased`; the acknowledgement is stored on the order | Checkout and access services |
| Double-click on Pay | Same `Idempotency-Key` returns the same order; paying a paid order is a no-op | Unique (user, key) on orders |
| Payment fails | Order marked failed, no entitlement; retry creates a new order | Checkout service |
| Payment still pending | No access until paid | Access service reads purchases only |
| Price changes after purchase | Past orders keep the price paid | Order stores amount and price snapshot |
| Creator deletes a book that has buyers | Archived instead; buyers keep reading; hidden from catalog | Book service |
| Creator deletes a book with no orders | Hard delete with its pages | Book service |
| Creator edits another creator's book | 404, so other creators' IDs are not confirmed | Book service ownership check |
| Parent calls a creator endpoint | 403 `FORBIDDEN_ROLE` | Role middleware |
| Creator buys their own book | 409 `ALREADY_OWNED` (owner access) | Checkout service |
| Locked page fetched directly by URL | 403 `ENTITLEMENT_REQUIRED` | Content endpoint |
| Purchase of an archived book | 409 `BOOK_NOT_PURCHASABLE` | Checkout service |
| Kid token calls checkout, account or creator endpoints | 403 `KID_MODE_FORBIDDEN` | Scope middleware |
| Kid mode catalog | Only full-access books, no prices in the payload | Book service, by token scope |
| Enter Kid mode with no PIN set | 409 `PIN_NOT_SET`; the UI asks the parent to set one | Auth service |
| Wrong PIN 5 times | Locked for 5 minutes, 429 `PIN_LOCKED` | Auth service, counter in DB |
| Child reloads or reopens the app | Stays in Kid mode: the parent token was deleted on entry | Client token storage |
| Forgotten PIN | MVP: log out and log in again as the parent | Auth (mock) |

### Thought of, not built (out of scope)

- Refunds and chargebacks, and revoking access after them.
- Real gateway webhooks, signature checks and reconciliation.
- Auto-renewal, free trials, promo codes.
- Credit for past purchases when upgrading to a subscription.
- Family sharing across several parent accounts; device or session limits.
- Tax (PPN) and regional pricing.
- Review of creator uploads for age-appropriate content.
- Account deletion and data retention rules for child data.
- Time zones: everything is stored in UTC; local display is a UI concern.

## Data model

Ten SQLite tables (eight core, plus two for translations); the key split is **orders** (payment attempts, many, can fail) versus **purchases** and **subscriptions** (entitlements, what access reads). IDs are UUID text; timestamps are UTC epoch milliseconds; money is integer IDR.

| Table | Purpose | Key constraints | Edge cases it covers |
| --- | --- | --- | --- |
| users | Parents and creators | `email` unique; `role` in (parent, creator); `pin_hash` nullable | Role checks, Kid mode exit, PIN lockout |
| books | Catalog items | `creator_id` → users; `status` in (published, archived); `price_idr` > 0; `preview_page_count` ≥ 0 | Archive instead of delete when there are buyers |
| book\_pages | Book content | unique (`book_id`, `page_number`); cascade delete with book | Preview cut-off, locked pages by URL |
| plans | Subscription offers | `price_idr` > 0; `period_days` > 0 | Price snapshot on orders |
| subscriptions | Subscription entitlement | `user_id` → users; partial unique index on `user_id` where `status = 'active'` | One active subscription, expiry by date, cancel at period end |
| orders | Every payment attempt | unique (`user_id`, `idempotency_key`); `type` = book needs `book_id`, `type` = subscription needs `plan_id`; `status` in (pending, paid, failed) | Double-click, failed and pending payments, price changes, buying while subscribed |
| purchases | Book entitlement | unique (`user_id`, `book_id`); `order_id` → orders | Already owned, access survives archive and subscription end |
| book\_translations, book\_page\_translations | A book's title, description and page text in Indonesian | Primary key (book, locale) and (page, locale); cascade with the book | Books readable in the parent's language; a missing translation falls back to the original |
| events | Product analytics | indexed on (`name`, `created_at`) | Success metrics |

### Columns

**users** — `id`, `email`, `name`, `role`, `pin_hash`, `pin_failed_attempts`, `pin_locked_until`, `created_at`

**books** — `id`, `creator_id`, `title`, `author_name`, `description`, `cover_url`, `age_min`, `age_max`, `price_idr`, `status`, `preview_page_count` (default 2), `created_at`, `updated_at`, `archived_at`

**book\_pages** — `id`, `book_id`, `page_number`, `text`, `image_url`

**plans** — `id`, `name`, `price_idr`, `period_days`, `is_active`

**subscriptions** — `id`, `user_id`, `plan_id`, `status` (active, expired), `current_period_start`, `current_period_end`, `cancel_at_period_end`, `created_order_id`, `created_at`

**orders** — `id`, `user_id`, `type`, `book_id`, `plan_id`, `amount_idr`, `status`, `idempotency_key`, `subscription_overlap_ack` (boolean), `provider` (mock), `provider_ref`, `failure_reason`, `created_at`, `paid_at`

**purchases** — `id`, `user_id`, `book_id`, `order_id`, `price_paid_idr`, `purchased_at`

**events** — `id`, `user_id`, `name`, `book_id`, `props` (JSON text), `created_at`

### Rules the schema leans on

- **Lazy expiry.** A subscription whose `current_period_end` has passed is treated as expired on read; the checkout service flips its status to expired before creating a new one, so the partial unique index stays correct.
- **Grant in one transaction.** Paying an order sets it to paid and inserts the purchase or subscription in the same transaction; the unique indexes stop a second grant.
- **Indexes for the hot path:** `purchases (user_id)`, `subscriptions (user_id, status)`, `books (status, created_at)`, `books (creator_id)`.

### Seed data

- Parent A with no subscription and 1 purchased book.
- Parent B with an active subscription.
- Parent C whose subscription has expired, plus 1 purchased book (shows the fallback).
- Two creators, about 8 books between them: 6 published, 1 archived with a buyer.

## API design

REST under `/api/v1`, JSON in and out, a Bearer JWT on everything except login and health, and one checkout path for both monetization models.

| Method | Path | Who | Purpose | Notable errors |
| --- | --- | --- | --- | --- |
| GET | /health | Public | Liveness for the host | — |
| POST | /auth/login | Public | Body `{ email }` of a seeded user → `{ token, user }` | 400, 404 |
| POST | /auth/kid-mode | Parent | Swap the parent token for a kid token | 409 `PIN_NOT_SET` |
| POST | /auth/parent-unlock | Kid | `{ pin }` → parent token | 401 `PIN_INVALID`, 429 `PIN_LOCKED` |
| PUT | /me/pin | Parent | Set or change the PIN: `{ pin, currentPin? }` | 400, 401 `PIN_INVALID` |
| GET | /me | Parent, creator | User, PIN set or not, subscription summary (active, ends at, cancelling), owned book IDs | 401 |
| GET | /books | Any, incl. kid | Parent: published catalog with `access` per book; filters `q`, `age`, `access=all\|full\|locked`. Kid: full-access books only, no prices | 400 |
| GET | /books/:id | Any, incl. kid | Detail with `access`, page count, price (no price for kid) | 404 |
| GET | /books/:id/pages | Any, incl. kid | Allowed pages; preview users get the first N plus `lockedFrom` and `totalPages` | 404 |
| GET | /books/:id/pages/:n | Any, incl. kid | One page; past the preview without access → 403 | 403 `ENTITLEMENT_REQUIRED`, 404 |
| GET | /creator/books | Creator | Own books in every status | 403 `FORBIDDEN_ROLE` |
| POST | /books | Creator | Create a book with its pages; published immediately | 400, 403 |
| PATCH | /books/:id | Creator, owner | Edit fields and replace pages | 400, 403, 404 |
| DELETE | /books/:id | Creator, owner | Hard delete if no orders, otherwise archive; returns `{ result: 'deleted' \| 'archived' }` | 403, 404 |
| GET | /plans | Parent | Active subscription plans | — |
| POST | /orders | Parent | `{ type: 'book', bookId, acknowledgeSubscriptionOverlap? }` or `{ type: 'subscription', planId }` + `Idempotency-Key` header → pending order | 400, 409 `ALREADY_OWNED` / `ALREADY_SUBSCRIBED` / `SUBSCRIPTION_OVERLAP_ACK_REQUIRED` / `BOOK_NOT_PURCHASABLE` |
| POST | /orders/:id/pay | Parent, owner | Mock gateway: `{ simulate: 'success' \| 'fail' }`; success grants access in one transaction | 402 `PAYMENT_FAILED`, 404, 409 `ORDER_NOT_PENDING` |
| GET | /orders | Parent | Own order history | — |
| POST | /subscriptions/current/cancel | Parent | Sets cancel at period end; access stays until then | 404 `NO_ACTIVE_SUBSCRIPTION` |
| POST | /events | Any, incl. kid | Log a product event `{ name, bookId?, props? }` | 400 |

A kid token on any endpoint not marked "incl. kid" gets 403 `KID_MODE_FORBIDDEN`.

### Error format

Every error has one shape: `{ "error": { "code": "ALREADY_OWNED", "message": "You already own this book.", "details": {} } }`. The `code` is stable for the UI to branch on; the `message` is safe to show a parent.

| Status | Codes |
| --- | --- |
| 400 | `VALIDATION_ERROR` (zod issues in `details`) |
| 401 | `UNAUTHENTICATED`, `PIN_INVALID` |
| 402 | `PAYMENT_FAILED` |
| 403 | `FORBIDDEN_ROLE`, `ENTITLEMENT_REQUIRED`, `KID_MODE_FORBIDDEN` |
| 404 | `NOT_FOUND`, `NO_ACTIVE_SUBSCRIPTION` |
| 409 | `ALREADY_OWNED`, `ALREADY_SUBSCRIBED`, `SUBSCRIPTION_OVERLAP_ACK_REQUIRED`, `BOOK_NOT_PURCHASABLE`, `ORDER_NOT_PENDING`, `PIN_NOT_SET` |
| 429 | `PIN_LOCKED` (`details.retryAt`) |
| 500 | `INTERNAL` (no stack traces in responses) |

### Checkout flow

1. The parent, in parent mode (which the PIN protects), taps Buy or Subscribe.
2. `POST /orders` with a fresh `Idempotency-Key`; the service checks the rules and stores a pending order with the current price.
3. Buying a book while subscribed returns `SUBSCRIPTION_OVERLAP_ACK_REQUIRED` with the subscription end date. The UI warns that the subscription is not refunded and the book stays theirs even after the subscription ends or the creator removes it. On confirm it resends with `acknowledgeSubscriptionOverlap: true`.
4. The UI shows a mock payment screen with Pay and Simulate failure.
5. `POST /orders/:id/pay` calls the PaymentGateway; on success the order becomes paid and the purchase or subscription is created in the same transaction.
6. The UI refetches `/me` and `/books`; the badge flips from Locked to Owned or Subscribed, and Owned wins when both apply.

## Architecture

A pnpm monorepo with three parts: the API, the web app, and a shared package of zod schemas and types, so the frontend and backend cannot drift apart.

&#91;embedded content: API architecture · four layers, shared contracts\]

The web app and the routes import the same zod schemas, and only the services hold rules such as `resolveAccess`, so a rule is written once and tested once.

### Backend layers

- **Routes** parse and validate input with zod, call one service method, and map the result to HTTP. No business rules here.
- **Services** hold every rule: AccessService (`resolveAccess`), BookService, CheckoutService, SubscriptionService. They throw typed `AppError`s.
- **Repositories** are the only code that touches Drizzle and SQLite.
- **PaymentGateway** is an interface; MockPaymentGateway implements it today, a Midtrans or Xendit adapter later.
- **Clock** is injected, so tests and a dev-only endpoint can move time to demo subscription expiry.
- One error middleware turns `AppError` into the error format; anything else becomes `INTERNAL`.

### Repository layout

```
apps/
  api/
    src/
      app.ts                 # Hono app, middleware, route mounting
      server.ts              # entry point
      config/env.ts          # zod-validated env vars
      db/
        schema.ts            # Drizzle tables
        client.ts
        migrations/
        seed.ts
      modules/
        auth/                # login route, JWT, auth + role middleware
        books/               # routes, service, repository
        access/              # resolveAccess + tests
        checkout/            # orders routes, service, PaymentGateway, mock
        subscriptions/       # cancel route, service
        events/
      shared/                # AppError, error middleware, clock
    test/
  web/
    src/
      api/                   # typed fetch client, TanStack Query hooks
      features/
        auth/  library/  book/  reader/  checkout/  account/  creator/
      components/            # shadcn/ui wrappers, LockBadge, PinPad
      stores/                # Zustand: session (token, mode), UI state
      app/                   # router, providers
packages/
  shared/                    # zod schemas, DTO types, error codes
```

### Frontend

React, Vite, TypeScript, Tailwind, shadcn/ui, TanStack Query, Zustand and React Router. State rule: everything that comes from the server (books, access, me, orders) lives only in TanStack Query; Zustand holds client state only (session token, parent or kid mode, UI state) and never copies server data. Entering Kid mode replaces the persisted token, so a reload cannot restore the parent token. Screens: login (pick a seeded user), library with All / My books / Locked tabs, book detail, reader with the paywall at the end of the preview, checkout with the subscription-overlap warning, Kid mode with a PIN pad to exit, account (subscription and orders), and the creator dashboard with the book form.

### Deployment

- Database: a local SQLite file in development, Turso in production, through the same libSQL client. The data lives on Turso, not on the API host, so redeploys and restarts lose nothing.
- API: Hono as a Vercel function. Migrations and seed run from a deploy script against Turso.
- Web: Vercel, a second project from the same repo, with the API URL as an env var and CORS limited to that origin.
- Repo: one public GitHub monorepo with a README covering setup, seeded accounts, the PIN for the demo parent, and the deployed links.

## 12-hour build plan

Backend and its rules first (5.75 h), frontend with Kid mode second (3 h), deploy and verify (1 h), slides last (2.25 h). A skeleton is deployed in hour one so hosting never surprises us at the end.

| Hours | Block | Deliverable | Done when |
| --- | --- | --- | --- |
| 0:00–1:00 | Scaffold and deploy skeleton | Monorepo, TS config, lint, Hono app, Vite shell; Turso database created; API and web as two Vercel projects | `/health` answers on the live URL |
| 1:00–2:00 | Schema and seed | Drizzle schema, migrations, seed script with the scenarios above, demo parent PIN | Seeded DB opens locally and in production |
| 2:00–4:00 | Auth, Kid mode and books | Mock login, JWT with role and scope, PIN set and unlock with lockout, kid token, book CRUD with ownership and archive rule, error middleware | A creator can CRUD; a parent gets 403; a kid token gets 403 everywhere except reading |
| 4:00–5:45 | Access and checkout | `resolveAccess` with unit tests, pages endpoints, orders with idempotency and the overlap acknowledgement, mock gateway, cancel subscription | Every MVP edge case in the table passes a test or a scripted request |
| 5:45–8:45 | Frontend | Login, library tabs and lock badges, detail, reader with paywall, checkout with the overlap warning, Kid mode with PIN pad, account, creator dashboard | A parent goes from Locked to reading, hands over Kid mode and gets back with the PIN; a creator publishes a book |
| 8:45–9:45 | Deploy and verify | Both apps live, CORS set, README with seeded accounts, PIN and links | The edge-case walkthrough works on production |
| 9:45–12:00 | Slides | Product thinking, assumptions, edge cases, trade-offs, architecture, data model, roadmap, metrics, AI usage | Deck exported to PDF and links checked |

### Rules for the 12 hours

- Keep a running `AI_LOG.md` from minute one: prompt, what came back, what we changed and why. The AI-usage slide is written from it in 15 minutes instead of from memory.
- Commit at the end of every block; the history is part of the story.
- Cut line at 5:45: if the backend is not done, drop the events endpoint and the dev clock endpoint before touching frontend time.
- Cut line at 8:45: search, filters and order history go first. Never cut server-side access checks, Kid mode, the edge-case tests, or the slides.
- After the 12 hours: UX polish and anything the walkthrough exposed.
