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
