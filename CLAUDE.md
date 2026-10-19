# Note Taking App

Full-stack notes app built ticket by ticket (AB-1001 to AB-1016) with spec-driven development (OpenSpec). Spec scope and rules are in `openspec/` and the assignment brief.

## Stack (fixed, no substitutions)

Frontend: React 19, TypeScript, Vite, TanStack Query, Zustand, TipTap, shadcn/ui. Backend: Node 22, Express 5, TypeScript. Database: PostgreSQL 16 + Prisma 7 (driver adapter `@prisma/adapter-pg`, config in `apps/backend/prisma7.config.ts`). Auth: JWT access (15 min) + DB-stored refresh token (7 days). Search: PostgreSQL full-text search only. Tests: Vitest, Supertest, Playwright. Monorepo: pnpm workspaces (`apps/backend`, `apps/frontend`, `packages/shared`, `packages/repo-checks`).

## Commands

- Use Node 22 (`.nvmrc`) and pnpm 10 (`packageManager`). `engine-strict` is on.
- `docker compose up -d` starts Postgres 16. Copy `apps/backend/.env.example` to `apps/backend/.env`.
- `pnpm build` · `pnpm lint --max-warnings 0` · `pnpm test` (add `--coverage` for the DoD).
- Backend: `pnpm --filter @todo/backend migrate:deploy | generate | dev`.

## Workflow (non-negotiable)

- One ticket per session; `/clear` between tickets. `/compact` at ~70% context.
- Spec -> plan -> tasks -> implement, each approved by a human before the next: `/spec`, `/plan`, `/tasks`, `/implement`. OpenSpec change names are lowercase (`ab-1002`).
- Ask `[y/n]` before every file write. Verify library APIs with Context7 before use. Never use `@latest`; pin exact versions.
- All types and Zod schemas live only in `packages/shared`.
- Soft delete sets `deletedAt` only. Never physically delete notes inside the 30-day window.
- Checkpoint after every phase: `pnpm build` (0 errors), `pnpm lint --max-warnings 0`, `pnpm test` all green. Husky enforces this on commit.
- Commits: `feat(scope): description AB#1234` (commitlint).
- Before a PR: `/review AB-xxxx` in a fresh terminal must be all ✅, then `openspec archive`, then `/pr`.
- Out of scope: realtime collaboration, attachments, mobile app, OAuth, folders/nesting, real email (log OTPs to console).
- Every spec scenario has exactly one named test; error status codes must match `delta-openapi.yaml`.
