## 1. Workspace and tooling (Haiku: boilerplate)

- [x] 1.1 Root `package.json`, `pnpm-workspace.yaml`, `.npmrc` (`save-exact`, `engine-strict`), `.nvmrc` (22), `packageManager` pnpm 10, `engines` Node 22
- [x] 1.2 `.gitignore`, `.editorconfig`, `tsconfig.base.json` (strict)
- [x] 1.3 Root ESLint flat config (typescript-eslint) and root scripts `build`, `lint`, `test`
- [x] 1.4 Verify every dependency version with `npm view` and Context7 before pinning

## 2. Shared package

- [x] 2.1 `packages/shared` skeleton (`@todo/shared`): `package.json`, `tsconfig`, `src/index.ts`, build to `dist`
- [x] 2.2 Env Zod schema and `Health` schema/type exported from shared
- [x] 2.3 Vitest config and tests for shared schemas

## 3. Database (Opus + ultrathink: schema design) [PARALLEL with 4 and 5]

- [x] 3.1 `docker-compose.yml` with `postgres:16` and `.env.example`
- [x] 3.2 Prisma schema: User, RefreshToken, PasswordResetOtp, Note (`deletedAt`, `searchVector`), Tag, NoteTag, ShareLink, NoteVersion
- [x] 3.3 First migration; hand-edit SQL to add generated `tsvector` column and GIN index
- [x] 3.4 Tests: migration applies to clean DB, `deletedAt` column, tsvector + GIN index

## 4. Backend skeleton (Sonnet) [PARALLEL with 3 and 5]

- [x] 4.1 `apps/backend` package, tsconfig, Prisma client wiring
- [x] 4.2 `createApp()` factory and server entry using validated env
- [x] 4.3 `GET /health` (200 ok, 503 error when DB unreachable)
- [x] 4.4 Supertest tests: "Healthy", "Database down", "Shared export is consumed"

## 5. Frontend skeleton (Haiku) [PARALLEL with 3 and 4]

- [x] 5.1 `apps/frontend` Vite + React 19 + TypeScript scaffold with placeholder App
- [x] 5.2 Vitest + Testing Library config and one smoke test

## 6. Quality gates

- [x] 6.1 Husky `pre-commit` (build, lint, test) and `commit-msg` (commitlint)
- [x] 6.2 commitlint config requiring `type(scope): description AB#ticket`
- [x] 6.3 Tests: "No floating versions", "Workspace packages resolve", "Wrong runtime rejected", "Clean checkpoint", "Failing check blocks commit", "Bad commit message rejected"

## 7. Claude Code configuration

- [x] 7.1 Root `CLAUDE.md` and `apps/backend`, `apps/frontend`, `packages/shared` `CLAUDE.md`
- [x] 7.2 `.claude/agents/reviewer.md` (Read, Grep, Glob only)
- [x] 7.3 `.claude/commands/` for `/spec`, `/plan`, `/tasks`, `/implement`, `/review`, `/pr`, `/parallel`
- [x] 7.4 `.mcp.json` with Context7 pinned
- [x] 7.5 Tests: "Reviewer is read-only", "Context7 configured"

## 8. Checkpoint and close-out

- [x] 8.1 `pnpm build` (0 errors), `pnpm lint --max-warnings 0`, `pnpm test --coverage` (>=80%)
- [x] 8.2 `openspec validate ab-1001`
- [x] 8.3 Smoke test: `docker compose up`, migrate, call `/health`
- [ ] 8.4 Conventional commit `feat(setup): project foundation AB#1001`
- [ ] 8.5 `/review` in a fresh terminal (all ✅), `openspec archive ab-1001`, `/pr`
