## Context

Greenfield repo. AB-1001 creates the foundation for AB-1002 to AB-1016. The stack is fixed by the assignment: Node 22, Express 5, React 19 + Vite, PostgreSQL 16, Prisma, Vitest, pnpm workspaces. Rule 20 requires exact version pinning. Rule 11 requires types and Zod schemas to live only in `packages/shared`.

## Goals / Non-Goals

**Goals:**
- A repo where `pnpm build`, `pnpm lint --max-warnings 0` and `pnpm test` pass from day one and are enforced on every commit.
- The complete database schema and first migration, so later tickets add no structural migrations.
- Claude Code workflow configuration the assignment requires.

**Non-Goals:**
- Auth, notes, tags, search, sharing, versions and any frontend UI.

## Decisions

1. **Layout:** `apps/backend`, `apps/frontend`, `packages/shared` (name `@todo/shared`), root `pnpm-workspace.yaml`. Shared is built to `dist` with `tsc` and consumed as a workspace dependency; apps build after it via `pnpm -r build` (topological order).
2. **Pinning:** `.npmrc` sets `save-exact=true`; `packageManager` pins pnpm 10.x; `engines` plus `engine-strict=true` pins Node 22 (`>=22 <23`); `.nvmrc` holds `22`. Exact versions are looked up with `npm view` and verified in Context7 docs before use (Rule 9).
3. **Database:** `docker-compose.yml` runs `postgres:16`. Prisma schema covers all eight models. Note gets `deletedAt DateTime?` (soft delete) and a search vector. Prisma cannot declare generated `tsvector` columns natively, so the migration SQL is hand-edited to add `searchVector tsvector GENERATED ALWAYS AS (...) STORED` and a GIN index; the column is declared `Unsupported("tsvector")?` in the schema. Alternative considered: compute vectors at query time. Rejected, too slow for AB-1007.
4. **IDs and timestamps:** UUID primary keys, `createdAt`/`updatedAt` on all mutable tables. Refresh tokens and OTPs store hashes only, never raw values. Share links use an unguessable token column with `expiresAt`, `revokedAt` and `viewCount`. NoteVersion stores title, content, version number and `createdAt`.
5. **Backend:** Express 5 app factory (`createApp()`) separate from `listen`, so Supertest can import it without opening a port. `GET /health` runs `SELECT 1` through Prisma; 200 `{status:"ok"}` or 503 `{status:"error"}`. Config read through a Zod env schema from `packages/shared`.
6. **Frontend:** Vite + React 19 + TypeScript skeleton only, with a placeholder App and one Vitest test. No TanStack/Zustand/TipTap/shadcn wiring until AB-1010+.
7. **Quality gates:** TypeScript strict via shared `tsconfig.base.json`; one flat ESLint config at root (typescript-eslint); Vitest per package; root scripts `build`, `lint`, `test` run recursively. Husky `pre-commit` runs build, lint, test; `commit-msg` runs commitlint with a rule requiring the `AB#<number>` suffix via a custom header pattern.
8. **Claude config:** root `CLAUDE.md` (stack, rules, commit format, definition of done) plus `apps/backend/CLAUDE.md`, `apps/frontend/CLAUDE.md`, `packages/shared/CLAUDE.md`. `.claude/agents/reviewer.md` with tools limited to Read, Grep, Glob. Commands `/spec`, `/plan`, `/tasks`, `/implement`, `/review`, `/pr`, `/parallel` wrap the OpenSpec workflow with the approval gates. `.mcp.json` pins Context7 to an exact version.
9. **Models (Rule 8):** Haiku for boilerplate (configs, skeletons), Sonnet for implementation, Opus + ultrathink only for the schema design.

## Risks / Trade-offs

- [Local Node is 24, not 22] -> User switches before `/implement`; engine-strict makes install fail loudly otherwise.
- [Docker Desktop not running] -> Database tasks and the migration scenarios are blocked until it is started.
- [Hand-edited migration for `tsvector`] -> Keep the SQL in the migration file, never regenerate it; documented in `apps/backend/CLAUDE.md`.
- [Husky running full build/lint/test per commit is slow] -> Accepted; the assignment requires it (Rule 13).
- [Custom commitlint pattern] -> Covered by the "Bad commit message rejected" scenario test.

## Open Questions

- None blocking. Exact dependency versions are resolved at implement time against npm and Context7.
