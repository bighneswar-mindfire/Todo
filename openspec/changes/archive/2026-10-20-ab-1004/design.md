## Context

AB-1004 adds the first user-scoped resource: notes. `POST/GET /notes`, `GET/PATCH/DELETE /notes/{id}`, `GET /notes/trash` and `POST /notes/{id}/restore`, all behind the AB-1002 `authenticate` middleware. The `Note` table (`content` Json, `contentText`, `deletedAt`, index `[userId, deletedAt, updatedAt]`) already exists, so there is no migration.

**Goals**
- Owner-only CRUD with TipTap JSON content and server-derived `contentText`.
- Soft delete sets `deletedAt` only; restore within 30 days; nothing is ever physically deleted.
- No ownership leak: foreign, unknown and wrong-state notes all return 404 `NOT_FOUND`.
- Every spec scenario has exactly one named test, against the real Postgres.

**Non-Goals**
- Tags, search, sharing, version snapshots, purge job, UI, rate limiting.
- Truncating or sanitizing TipTap node content beyond the `type: "doc"` check.

## Decisions

### D1. Layout
`apps/backend/src/notes/{notes.routes,notes.service,content-text}.ts`, mirroring `auth/`. `createNotesRouter(service, authenticate)` and `createNotesService({ prisma })` are mounted at `/notes` in `app.ts`. Handlers read the owner from `req.auth!.userId`. `parseBody` moves from `auth/auth.routes.ts` to `src/http/parse.ts` and is reused (plus a `parseQuery`/`parseParams` sibling) instead of being copied.

### D2. Route order and ids
`GET /trash` is registered before `/:id` so "trash" is never treated as an id. `:id` is validated with the shared `z.uuid()`; a malformed id is 400 `VALIDATION_ERROR` with `field: "id"`.

### D3. Ownership and state via atomic where-clauses
Every query filters `{ id, userId }` plus state: `deletedAt: null` for get, patch and delete; `deletedAt: { not: null, gte: now - 30d }` for restore. Mutations use `updateMany` with that where and treat `count === 0` as `NOT_FOUND`, then re-read the row for the response. This is atomic (no check-then-act race) and returns the same 404 for missing, foreign and wrong-state notes. Rejected: `findFirst` then `update` (race, extra round trip).

### D4. contentText derivation
Pure `extractText(doc)` in `content-text.ts` walks the node tree, collects `text` nodes and inserts a space between block-level nodes so "Hello" and "world" in separate paragraphs do not fuse. Output is trimmed and whitespace-collapsed. It runs on create and only when `content` is in a patch. Malformed nested nodes are skipped, never thrown on.

### D5. Soft delete, restore and the 30-day window
Delete: `updateMany({ id, userId, deletedAt: null }, { deletedAt: now })`. Restore: sets `deletedAt: null`. The window is a shared constant `TRASH_RETENTION_DAYS = 30`, applied as `deletedAt >= now - 30d` in the trash list and restore. No code path calls `delete`/`deleteMany` on notes. Tests simulate age by writing `deletedAt` through Prisma (5 and 31 days back, so the clock is not on the boundary).

### D6. Pagination and summaries
Shared `pageQuerySchema`: `page` and `limit` through `z.coerce.number().int()`, `page >= 1`, `1 <= limit <= 100`, defaults 1 and 20. `findMany` plus `count` run in one `$transaction`. Active list orders `updatedAt desc` (covered by the existing index); trash orders `deletedAt desc`. Lists select `id, title, contentText, createdAt, updatedAt` (and `deletedAt` for trash) and never `content`; `excerpt = contentText.slice(0, 200)`.

### D7. Shared schemas and errors
All in `packages/shared/src/notes.ts`, exported from `index.ts`: `tipTapDocSchema` (`type: "doc"`, optional `content` array, passthrough), `createNoteRequestSchema` (title trimmed 1 to 200, content defaults to `{ type: "doc", content: [] }`), `updateNoteRequestSchema` (both optional, refine at least one present), `noteSchema`, `noteSummarySchema`, `trashNoteSummarySchema`, `noteListResponseSchema`, `trashListResponseSchema`, `pageQuerySchema`, `TRASH_RETENTION_DAYS`. `NOT_FOUND` is added to `errorCodeSchema` in `auth.ts`. Dates are ISO strings in responses.

### D8. Body limit
`express.json({ limit: "1mb" })` in `app.ts`. An oversized body raises `entity.too.large`, which `middleware/error-handler.ts` already maps to 400 `VALIDATION_ERROR`, so no new status code. The parsed content is cast to Prisma's `InputJsonValue` only at the service boundary.

### D9. PATCH semantics
Only supplied fields change; a content-only patch keeps the title. `updatedAt` advances through Prisma `@updatedAt`. No version snapshot is written (versions belong to a later ticket).

## Files

- Modify: `packages/shared/src/{auth.ts,index.ts}`; `apps/backend/src/{app.ts,auth/auth.routes.ts}` (import moved `parseBody`); `apps/backend/src/auth/test-helpers.ts` (reuse; add a `registerAndLogin` helper if missing); backend README note.
- Create: `packages/shared/src/notes.ts`; `apps/backend/src/http/parse.ts`; `apps/backend/src/notes/{notes.routes,notes.service,content-text}.ts`.
- Tests (titles are scenario names verbatim, `describe("notes: ...")`): `notes.auth`, `notes.create`, `notes.list`, `notes.get`, `notes.update`, `notes.delete`, `notes.trash`, `notes.restore` test files, `content-text.test.ts` (`[design]` helper cases), and a shared-schema test.

## Risks / Trade-offs

- Returning 404 for everything hides ownership but makes client errors less specific (accepted).
- Accepting arbitrary TipTap node shapes means `contentText` quality depends on well-formed input; the extractor skips what it does not understand.
- 1 MB JSON bodies parsed in memory by Express; acceptable for one ticket, revisit if attachments ever arrive.
- The 30-day boundary uses the server clock; tests use wide margins.
- Rows past 30 days stay in the table forever until a purge ticket exists.

## Verification

`pnpm build` (0 errors), `pnpm lint --max-warnings 0`, `pnpm test --coverage`, `openspec validate ab-1004`, plus a manual smoke run (register, login, create, list, patch, delete, see it in trash, restore, 404 for another user's token).
