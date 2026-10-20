## Context

`delta-openapi.yaml` for AB-1009 is approved. The `NoteVersion` table (`noteId`, `versionNumber`, `title`, `content`, `contentText`, unique `noteId + versionNumber`, cascade on note delete) already exists from AB-1001, so there is no migration. Adds per-note version history: every save is recorded as an immutable version, with list, read and restore endpoints. No new status or error code.

## Goals / Non-Goals

**Goals:** every scenario in `specs/versions/spec.md` and the added `specs/notes/spec.md` scenarios passes with exactly one named test; status codes match `delta-openapi.yaml`; concurrent saves get consecutive numbers with no gaps.

**Non-Goals:** diff view, retention caps, naming versions, deleting single versions, backfilling old notes, restoring tags, the history UI.

## Decisions

1. **One transactional save helper.** `versions/record-save.ts` exports `saveNoteState(tx, { userId, noteId, next })`, always called inside `prisma.$transaction(async tx => ...)`:
   1. `tx.$queryRaw` `SELECT id, title, content, "contentText" FROM "Note" WHERE id = ${noteId}::uuid AND "userId" = ${userId}::uuid AND "deletedAt" IS NULL FOR UPDATE` (same pattern as the per-user lock in `auth.service.ts`). No row is 404 `NOT_FOUND`. The lock also does the owner and not-deleted check, replacing the old `updateMany` count check.
   2. Merge `next` (`title?`, `content?`) over the current values. If title and content both deep-equal the current ones (`isDeepStrictEqual`, which ignores JSONB key order), return without writing.
   3. `tx.note.update` with title, content and re-derived `contentText` (`extractText`); `@updatedAt` advances.
   4. `versionNumber` = max for the note + 1, or 1 when it has none (pre-existing note). The row lock serialises allocators, so there are no gaps and no unique-constraint failures; no retry loop and no `P2002` path. READ COMMITTED is enough: once the lock is granted the re-read sees the winner's committed row.
   Alternative rejected: `INSERT ... SELECT max()+1` with a retry on `P2002`; it leaves gaps under contention and burns attempts.
2. **Create** is one nested write: `prisma.note.create({ data: { ..., versions: { create: { versionNumber: 1, title, content, contentText } } } })`, atomic by itself.
3. **Update** runs `saveNoteState` in a transaction, then `findOwned` for the tag-bearing response as today. Trash `restore` and `softDelete` are unchanged and create no version.
4. **No-op PATCH writes nothing**, so `updatedAt` does not advance (an autosave resending the same text would otherwise reorder the list). This narrows the existing "`updatedAt` SHALL advance" wording in the notes spec to "when something changed"; the notes delta states it explicitly. Same for restoring a version equal to the current state.
5. **Versions service** (`versions/versions.service.ts`, `createVersionsService({ prisma })`):
   - `list(userId, noteId, { page, limit })`: assert active owned note (404), then `$transaction([findMany orderBy versionNumber desc skip/take, count])`, items `{ id, versionNumber, title, excerpt, createdAt }` using `excerpt()` from `notes/summary.ts`.
   - `get(userId, noteId, n)`: `findFirst({ where: { noteId, versionNumber: n, note: { userId, deletedAt: null } } })`; null is 404. Unknown version, foreign note, deleted note and another note's version are indistinguishable.
   - `restore(userId, noteId, n)`: in one transaction read the version (404 when absent, note unchanged), then call `saveNoteState` with its title and content. Returns the note (same shape as `GET /notes/{id}`) through the notes `get`. Tags and share links are never touched.
6. **Routes** are added to `notes.routes.ts` beside the shares routes (already behind `authenticate`): `GET /:id/versions`, `GET /:id/versions/:versionNumber`, `POST /:id/versions/:versionNumber/restore`. `createNotesRouter` gains a `VersionsService` argument; `app.ts` builds it.
7. **Validation lives in `packages/shared/src/versions.ts`** (exported from `index.ts`): `versionNumberParamSchema` (`id` uuid, `versionNumber` `z.coerce.number().int().min(1)`), `noteVersionSummarySchema`, `noteVersionListResponseSchema` (with `listMeta`), `noteVersionSchema`; types by `z.infer`. Reuses `pageQuerySchema`, `noteIdParamSchema`, `tipTapDocSchema`, `NOTE_EXCERPT_LENGTH`.
8. **Dates** use `toISOString()`. List items never include `content`.

## Files

- `packages/shared/src/versions.ts` (new), `packages/shared/src/index.ts` (export).
- `apps/backend/src/versions/record-save.ts`, `versions.service.ts`, `test-helpers.ts` (new).
- `apps/backend/src/notes/notes.service.ts` (create and update), `notes.routes.ts` (three routes), `apps/backend/src/app.ts` (wiring).
- Tests in `apps/backend/src/versions/`: `versions.auth`, `versions.record`, `versions.list`, `versions.get`, `versions.restore` (`.test.ts`), plus the new scenarios in `notes/notes.create.test.ts` and `notes.update.test.ts`. One test per scenario including the 5-way `Promise.all` PATCH. Pre-existing notes are simulated with `prisma.noteVersion.deleteMany`.
- `apps/backend/CLAUDE.md`: short AB-1009 section.

## Risks / Trade-offs

- Raw SQL for the lock: values bound through tagged `$queryRaw`, no string building. `content` returns parsed JSON; tests check the shape.
- A save now holds a row lock for the transaction, so concurrent saves to one note serialise (intended). Concurrency tests need real Postgres and a pool larger than 1.
- Every changed save stores a full copy of title and content; no pruning (out of scope).
- Verify `FOR UPDATE` via `$queryRaw` inside an interactive transaction with Prisma 7 and `@prisma/adapter-pg` via Context7 before implementing.
