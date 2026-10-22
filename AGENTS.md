# AGENTS.md

Full-stack notes app, built ticket by ticket (AB-1001 to AB-1019). Business rules: `docs/FRS.md`. Design: `docs/SDS.md`. Per-ticket changes and current behaviour: `openspec/`.

## Repo structure

```
apps/backend        Express 5 API (src/<feature>/ routes, service, tests; prisma/ schema + migrations)
apps/frontend       React 19 SPA (api/, queries/, stores/, routes/, pages/, components/, lib/, test/)
packages/shared     ONLY place for TypeScript types and Zod schemas (@todo/shared)
packages/repo-checks  Repository rule checks (Vitest)
docs/               FRS.md, SDS.md, decisions/ (ADRs)
openspec/           specs/ = current behaviour, changes/ = active proposals, changes/archive/ = done
```

## Stack (fixed, no substitutions)

- Frontend: React 19, TypeScript, Vite, TanStack Query (server state), Zustand (client state), TipTap, shadcn/ui.
- Backend: Node 22, Express 5, TypeScript (ESM). Database: PostgreSQL 16 + Prisma 7 (`@prisma/adapter-pg`, config `apps/backend/prisma7.config.ts`).
- Search: PostgreSQL full-text search only. Tests: Vitest, Supertest, Playwright.
- Monorepo: pnpm 10 workspaces, Node 22 (`.nvmrc`), `engine-strict` on. Pin exact dependency versions, never `@latest`.

## Commands

- `docker compose up -d` starts Postgres 16. Copy `apps/backend/.env.example` to `apps/backend/.env`.
- Build / types: `pnpm build` (runs `tsc`, 0 errors). Lint: `pnpm lint --max-warnings 0`. Test: `pnpm test` (`--coverage` for the DoD).
- Backend: `pnpm --filter @todo/backend migrate:deploy | generate | dev`. Spec check: `pnpm exec openspec validate <change> --strict`.

## Architecture and conventions

- Contract first: define request/response types and Zod schemas in `packages/shared`, then API, then UI. Never redefine them in an app.
- Backend: `createApp(deps)` builds the app (Supertest imports it); `server.ts` is the only entry that listens. Env comes from `parseEnv`. Routes `safeParse` shared schemas and throw `AppError`.
- Error shape for every failure: `{ error: { code, message, details? } }`. Status codes must match the change's `delta-openapi.yaml`.
- Frontend: all HTTP goes through `api/client.ts`; server data via TanStack Query; the URL holds list/search state.
- Soft delete sets `deletedAt` only. Never physically delete notes inside the 30-day window.
- Per-layer rules live in `apps/backend/CLAUDE.md`, `apps/frontend/CLAUDE.md`, `packages/shared/CLAUDE.md`.

## Auth

JWT access token (15 min, HS256) plus a DB-stored, hashed refresh token (7 days, rotated). Password reset uses a console-logged OTP (no real email). Protected routes use `createAuthenticate`, which sets `req.auth = { userId }`.

## Database summary

`User`, `RefreshToken`, `PasswordResetOtp`, `Note` (generated `searchVector` tsvector, `deletedAt`), `Tag`, `NoteTag`, `ShareLink` (`revokedAt`, expiry, view count), `NoteVersion` (per-note `versionNumber`). Every user-owned query filters by `userId`; other users' resources return 404, not 403.

## Testing

- Every spec scenario has exactly one named test, titled like the scenario. Tests are written before the code.
- Backend: Vitest + Supertest in `src/**/*.test.ts`. Frontend: Vitest + Testing Library (jsdom) in `src/**/*.test.tsx`. E2E: Playwright (AB-1016).
- Coverage of new code must be at least 80%.

## Anti-patterns

- `any`, `@ts-ignore`, `eslint-disable` (needs a ticket ID), weakened or deleted tests to get green.
- Types or Zod schemas outside `packages/shared`; reading `process.env` outside `parseEnv`.
- Logging or returning passwords, tokens, OTPs, request bodies or `err.message`.
- Queries without a `userId` scope; floating dependency versions; new packages the spec did not ask for.
- Out of scope: realtime collaboration, attachments, mobile app, OAuth, folders/nesting, real email.
