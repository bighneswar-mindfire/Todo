## Context

`delta-openapi.yaml` for AB-1008 is approved. The `ShareLink` table (`token` unique, `expiresAt`, `revokedAt`, `viewCount`, FK to `Note` with cascade, index on `noteId`) already exists from AB-1001, so there is no migration. Adds owner-managed share links (create, list, revoke) and a public read-only `GET /shared/{token}` with an atomic view count. No new status or error code.

## Goals / Non-Goals

**Goals:** every scenario in `specs/sharing/spec.md` passes with exactly one named test; status codes match `delta-openapi.yaml`; the view count is atomic.

**Non-Goals:** password-protected links, per-view analytics, editing through a link, rate limiting of the public endpoint, vanity tokens, extending an expiry, the sharing UI.

## Decisions

1. **Atomic count is one SQL statement.** `getShared(token)` in `sharing.service.ts` runs a single `$queryRaw`:
   `UPDATE "ShareLink" s SET "viewCount" = s."viewCount" + 1 FROM "Note" n WHERE s."noteId" = n.id AND s.token = $1 AND s."revokedAt" IS NULL AND (s."expiresAt" IS NULL OR s."expiresAt" > now()) AND n."deletedAt" IS NULL RETURNING n.title, n.content, n."updatedAt"`.
   An empty result is 404 `NOT_FOUND`. Postgres row locking serialises concurrent increments (READ COMMITTED re-evaluates the WHERE after the lock), so 25 concurrent opens add exactly 25, and once a revoke commits no later open is counted. Expiry uses the database `now()` so validation and counting share one clock. Alternative rejected: `findFirst` then Prisma `increment` (check and count become two steps, so a revoked link could be counted).
2. **Token:** `randomBytes(32).toString("base64url")` in `sharing/token.ts` (43 characters). Stored as-is because the owner must list it again. Never logged. Collision on the unique column is not practically possible, so no retry loop.
3. **Ownership.** Create and list first load the note with `findFirst({ id, userId, deletedAt: null })`, else 404. Revoke is one `updateMany({ where: { id: shareId, noteId, revokedAt: null, note: { userId, deletedAt: null } }, data: { revokedAt: new Date() } })`; `count === 0` is 404, which covers foreign, other-note, already-revoked and deleted-note cases. Same convention as notes and tags.
4. **Routes.** `POST|GET /notes/:id/shares` and `DELETE /notes/:id/shares/:shareId` are added to the existing notes router (already behind `authenticate`, like the tag attach routes) and delegate to the sharing service. The public route is a separate router mounted at `/shared` in `app.ts` with no `authenticate`; the 200 response sets `Cache-Control: no-store` and `Referrer-Policy: no-referrer`. All public failures use the standard 404 envelope, so the bodies are identical.
5. **Validation lives in `packages/shared/src/sharing.ts`** (exported from `index.ts`): `createShareLinkRequestSchema` (`expiresAt` optional `z.iso.datetime()` refined to be in the future, strict object), `shareIdParamsSchema` (`id`, `shareId` uuid), `sharedTokenParamSchema` (`^[A-Za-z0-9_-]{43}$`), plus `shareLinkSchema`, `shareLinkListResponseSchema`, `sharedNoteSchema` (`title`, `content`, `updatedAt`). `parseBody` already treats a missing body as `{}`.
6. **Response shaping.** Dates use `toISOString()`. The public response is built from exactly three fields, so no id, owner, tags or count can leak. The list is ordered `createdAt desc`.
7. **Soft delete.** Deleting a note leaves its links untouched; the live check reads `Note.deletedAt` on every open, so links stop resolving at once and resume on restore.

## Files

- `packages/shared/src/sharing.ts` (new), `packages/shared/src/index.ts` (export).
- `apps/backend/src/sharing/token.ts`, `sharing.service.ts`, `sharing.routes.ts` (public router) (new).
- `apps/backend/src/notes/notes.routes.ts`: three owner routes; `createNotesRouter` gains a sharing service argument.
- `apps/backend/src/app.ts`: build the sharing service, pass it to the notes router, mount `/shared`.
- Tests in `apps/backend/src/sharing/`: `sharing.auth`, `sharing.create`, `sharing.list`, `sharing.revoke`, `sharing.public`, `sharing.viewcount` (`.test.ts`), one test per scenario including the 25-way `Promise.all` and the revoke race. Reuse `registerAndLogin`, `createNote`, `setDeletedAt` from `src/notes/test-helpers.ts`; expired links are simulated by writing `expiresAt` through Prisma.
- `apps/backend/CLAUDE.md`: short AB-1008 section.

## Risks / Trade-offs

- Raw SQL: all values bound through the tagged `$queryRaw`, no string building. `content` is `jsonb` and returns parsed; tests check the shape.
- The token is a bearer secret stored in plaintext (needed for re-listing). A database read exposes live links; accepted in the proposal.
- Concurrency tests need the real Postgres and a pool larger than 1.
- Verify `UPDATE ... FROM ... RETURNING` with Prisma 7 `$queryRaw` and `@prisma/adapter-pg` via Context7 before implementing.
