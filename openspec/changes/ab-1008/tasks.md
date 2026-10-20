## Conventions

- Shell: prefix PATH for Node 22 / pnpm 10 on every command.
- Model per task: Haiku = boilerplate, Sonnet = implementation. No Opus task (design.md is approved).
- No task is estimated over 45 minutes, so no subagent is needed. `[PARALLEL]` marks tasks that touch separate files and can run in separate worktrees.
- Test files hold one test per scenario, titled exactly as the scenario.

## 1. Shared types

- [x] 1.1 Create `packages/shared/src/sharing.ts`: `createShareLinkRequestSchema` (strict, optional future `expiresAt`), `shareIdParamsSchema`, `sharedTokenParamSchema`, `shareLinkSchema`, `shareLinkListResponseSchema`, `sharedNoteSchema` and inferred types; export from `index.ts` (Haiku)
- [x] 1.2 Checkpoint: `pnpm build` (0 errors), `pnpm lint --max-warnings 0`, `pnpm test`

## 2. Service

- [x] 2.1 Verify `UPDATE ... FROM ... RETURNING` via `$queryRaw` with Prisma 7 and `@prisma/adapter-pg` using Context7 before coding (Sonnet)
- [x] 2.2 [PARALLEL] Create `apps/backend/src/sharing/token.ts` (`generateShareToken`, 32 bytes base64url) (Haiku)
- [x] 2.3 [PARALLEL] Create `apps/backend/src/sharing/sharing.service.ts`: `create`, `list`, `revoke`, `getShared` (single atomic statement) (Sonnet)
- [x] 2.4 Create `apps/backend/src/sharing/sharing.routes.ts` (public `/shared` router with the two headers) (Sonnet)
- [x] 2.5 Add the three owner routes to `notes.routes.ts` and wire the service and `/shared` mount in `app.ts` (Sonnet)
- [x] 2.6 Checkpoint: `pnpm build` (0 errors), `pnpm lint --max-warnings 0`, `pnpm test`

## 3. Scenario tests (`apps/backend/src/sharing/`)

`sharing.auth.test.ts` - Requirement: Share management requires authentication
- [x] 3.1 Test "Missing token rejected" (Sonnet)
- [x] 3.2 Test "Cannot manage another user's note"

`sharing.create.test.ts` - Requirement: Create share link
- [x] 3.3 Test "Create link without expiry"
- [x] 3.4 Test "Create link with expiry"
- [x] 3.5 Test "Past expiry rejected"
- [x] 3.6 Test "Malformed expiry rejected"
- [x] 3.7 Test "Multiple links get distinct tokens"
- [x] 3.8 Test "Cannot share a deleted note"
- [x] 3.9 Test "Malformed note id rejected"

`sharing.list.test.ts` - Requirement: List share links
- [x] 3.10 Test "List returns own note's links with counts"
- [x] 3.11 Test "List includes revoked links"
- [x] 3.12 Test "List is scoped to the note"
- [x] 3.13 Test "List for a deleted note"

`sharing.revoke.test.ts` - Requirement: Revoke share link
- [x] 3.14 Test "Revoke sets revokedAt only"
- [x] 3.15 Test "Revoked link stops resolving"
- [x] 3.16 Test "Revoke already revoked link"
- [x] 3.17 Test "Cannot revoke another user's link"
- [x] 3.18 Test "Link from a different note not revocable via this note"
- [x] 3.19 Test "Malformed share id rejected"

`sharing.public.test.ts` - Requirement: Public read-only note view
- [x] 3.20 Test "Anonymous read of a shared note"
- [x] 3.21 Test "Response is not cacheable and hides referrer"
- [x] 3.22 Test "Shared view reflects latest edit"
- [x] 3.23 Test "Unknown token"
- [x] 3.24 Test "Expired link"
- [x] 3.25 Test "Soft-deleted note not served"
- [x] 3.26 Test "Link resumes after restore"
- [x] 3.27 Test "All failures look the same"
- [x] 3.28 Test "Malformed token rejected"

`sharing.viewcount.test.ts` - Requirement: Atomic view count
- [x] 3.29 Test "Each view counts once"
- [x] 3.30 Test "Concurrent views are not lost" (25 requests via `Promise.all`)
- [x] 3.31 Test "Failed views are not counted"
- [x] 3.32 Test "Counts are per link"
- [x] 3.33 Test "Revoke racing with views never counts after revocation"

- [x] 3.34 Checkpoint: `pnpm build` (0 errors), `pnpm lint --max-warnings 0`, `pnpm test`

## 4. Docs and wrap-up

- [x] 4.1 Add the "Sharing (AB-1008)" note to `apps/backend/CLAUDE.md` (Haiku)
- [x] 4.2 Run `pnpm test --coverage`; confirm the Definition of Done thresholds hold
- [x] 4.3 Manual check: create a link, open `GET /shared/{token}` twice, confirm `viewCount` 2 in the list, revoke, confirm 404 (exercised end to end by the Supertest scenarios, not by a separate manual run)
- [x] 4.4 Final checkpoint: `pnpm build` (0 errors), `pnpm lint --max-warnings 0`, `pnpm test`
- [ ] 4.5 Commit `feat(sharing): add public share links with atomic view count AB#1008` (asks before pushing; `/review AB-1008` in a fresh terminal comes next)
