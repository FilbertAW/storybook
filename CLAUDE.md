# CLAUDE.md — Storybook Library MVP

A paid digital storybook library for kids aged 2–8, built as a take-home assignment.
Parents pay (subscription or one-time purchase), children read in Kid mode, creators manage books.

**Source of truth: `docs/PLAN.md`.** It holds the decisions, edge cases, data model, API design
and the 12-hour build plan. Read it before every block. If something here conflicts with it,
stop and ask.

## How we work

- Work **one block at a time** from the 12-hour plan in `docs/PLAN.md`. When the block's
  "Done when" is met, stop, summarize what changed, and wait for me.
- **Ask before** adding any dependency not listed below, changing a decision in `docs/PLAN.md`,
  or changing the data model or API shape.
- Keep it minimal: build what the block asks for, no extra features or speculative abstractions.
- After every block, append an entry to `AI_LOG.md`: the prompt, what you produced,
  what I changed or rejected, and why. Never rewrite earlier entries.
- Commit at the end of each block: `block N: <what was done>`.

## Stack

pnpm monorepo, TypeScript strict everywhere, Node 22.

```
apps/api        Hono, zod, @hono/zod-validator, Drizzle ORM + drizzle-kit, @libsql/client,
                hono/jwt (built in), vitest, tsx
apps/web        React, Vite, Tailwind, shadcn/ui, @tanstack/react-query, zustand, react-router
packages/shared zod schemas, DTO types, error codes (imported by api and web)
```

- Database: SQLite file in dev, Turso in production, same libSQL client. Config from env only.
- Hosting: API as a Vercel function, web as a second Vercel project from the same repo.
- Secrets never go in the repo. Keep `.env.example` up to date for every env var.

## Backend architecture (non-negotiable)

- **Routes** validate input with zod, call one service method, map the result to HTTP. No rules.
- **Services** hold every business rule: AccessService, BookService, CheckoutService,
  SubscriptionService, AuthService. They throw typed `AppError`s.
- **Repositories** are the only code that touches Drizzle.
- **PaymentGateway** is an interface; `MockPaymentGateway` is the only implementation for now.
- **Clock** is injected into services. Never call `Date.now()` directly in a service.
- One error middleware maps `AppError` to the error shape; anything else becomes `INTERNAL`.

## Access control

`resolveAccess(user, book, now)` in AccessService is the only place access is decided.
List, detail and pages endpoints all use it. First match wins:

1. Creator of the book → full, reason `owner`
2. Purchase exists → full, reason `purchased` (even if archived)
3. Book is archived → not found for everyone else
4. Subscription with `current_period_end` > now → full, reason `subscription`
5. Otherwise → preview (first `preview_page_count` pages), reason `locked`

- The server never sends a page the user cannot read. Hiding it in the UI is not enough.
- Subscription expiry is computed from dates at request time. No cron jobs.
- Purchases outrank subscriptions: owned books show as owned even while subscribed.
- Buying a book while subscribed requires `acknowledgeSubscriptionOverlap: true`;
  without it, return 409 `SUBSCRIPTION_OVERLAP_ACK_REQUIRED` with the subscription end date.
- Paying an order and granting the purchase or subscription happen in one transaction.

## Kid mode

- Entering Kid mode swaps the parent token for a kid token (scope `kid`). The client deletes
  the parent token from memory **and** persisted storage.
- A kid token may only: list and read full-access books (no prices in responses) and post events.
  Everything else returns 403 `KID_MODE_FORBIDDEN`.
- Leaving Kid mode: PIN + kid token → fresh parent token. No re-login.
- PIN: 4–6 digits, hashed with scrypt from `node:crypto`. 5 wrong attempts → locked 5 minutes
  (429 `PIN_LOCKED`). The attempt counter lives in the database, not in memory.

## Frontend state

- **Server data lives only in TanStack Query**: books, access, `/me`, orders, plans.
- **Zustand holds client state only**: session token, mode (parent or kid), UI state.
  Never copy server data into Zustand.
- After a successful payment, invalidate `books` and `me`.
- On every parent ↔ kid switch, clear the TanStack Query cache.
- The API client reads the token with `useSessionStore.getState()`.

## API conventions

- Base path `/api/v1`, JSON only, Bearer JWT on everything except login and health.
- Error shape: `{ "error": { "code", "message", "details"? } }`. Codes come from
  `packages/shared`; never invent one inline. Messages are safe to show a parent.
- No stack traces in responses.
- `POST /orders` requires an `Idempotency-Key` header.
- Money: integer IDR (`price_idr`, `amount_idr`). No floats.
- Time: UTC epoch milliseconds in the DB; ISO strings in responses.
- IDs: UUID strings.

## Testing

- vitest. `resolveAccess` gets unit tests for every rule above.
- Every "Edge cases handled in the MVP" row in `docs/PLAN.md` needs a test or a scripted
  request that proves it before the block counts as done.

## Never cut

Server-side access checks, Kid mode, the edge-case tests, clean layering, the slides.
If time runs short, follow the cut lines in `docs/PLAN.md` instead of improvising.
