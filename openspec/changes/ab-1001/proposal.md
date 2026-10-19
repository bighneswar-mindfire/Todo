## Why

AB-1001 lays the foundation every later ticket (AB-1002 to AB-1016) builds on. Without a pinned monorepo, a database schema, enforced quality gates and Claude Code configuration, none of the SDD workflow rules (build/lint/test checkpoints, conventional commits, Context7, reviewer agent) can be enforced.

## What Changes

- pnpm workspace monorepo: `apps/backend`, `apps/frontend`, `packages/shared`, plus a private test-only `packages/repo-checks` for tooling scenario tests, all tool and dependency versions pinned exactly (no `@latest`, no `^`/`~`).
- Node 22 and pnpm 10 pinned via `.nvmrc`, `engines` and `packageManager`.
- PostgreSQL 16 via `docker-compose.yml`; Prisma schema for User, RefreshToken, PasswordResetOtp, Note, Tag, NoteTag, ShareLink, NoteVersion plus the first migration (including a full-text search `tsvector` column and GIN index on Note).
- `packages/shared` skeleton as the single home for Zod schemas and TypeScript types.
- Quality gates: ESLint (`--max-warnings 0`), TypeScript strict, Vitest in every package, Husky pre-commit (build, lint, test), commitlint (`feat(scope): description AB#1001`).
- Claude Code configuration: root and per-app `CLAUDE.md`, read-only `reviewer` agent, `/spec` `/plan` `/tasks` `/implement` `/review` `/pr` `/parallel` commands, Context7 MCP in `.mcp.json`.
- Minimal `GET /health` endpoint on the backend so the API contract (`delta-openapi.yaml`) and the smoke test have something concrete to verify.

## Capabilities

### New Capabilities
- `project-foundation`: workspace layout, version pinning, database schema, quality gates, Claude Code configuration and the health endpoint.

### Modified Capabilities
None.

## Impact

- New files only (greenfield repo). No existing behavior changes.
- Requires Node 22, pnpm 10 and Docker running locally.
- Out of scope per assignment: auth, notes, tags, search, sharing, versions, frontend UI.
