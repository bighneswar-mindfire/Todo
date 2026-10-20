## Why

The brief defines AB-1009 as version history for notes. Today `PATCH /notes/{id}` overwrites the title and content, so a bad edit or an accidental clear is unrecoverable. Users need to see earlier states of a note and bring one back. The `NoteVersion` table (`noteId`, `versionNumber`, `title`, `content`, `contentText`, unique on `noteId + versionNumber`, cascade on note delete) already exists from AB-1001, so no migration is needed. The version-history UI (a later frontend ticket) needs these endpoints.

## What Changes

- Every state a note is saved in is recorded as an immutable version, numbered 1, 2, 3 per note:
  - `POST /notes` records version 1.
  - `PATCH /notes/{id}` records a new version when the title or content actually changed.
  - Restoring a version records a new version (history is append-only; nothing is rewritten or removed).
- New endpoints (all Bearer token, owner only):
  - `GET /notes/{id}/versions` lists versions newest first, paginated, as summaries (`id`, `versionNumber`, `title`, `excerpt`, `createdAt`), no `content`.
  - `GET /notes/{id}/versions/{versionNumber}` returns one version in full, including `content`.
  - `POST /notes/{id}/versions/{versionNumber}/restore` copies that version's title and content onto the note and returns the updated note (200).
- Note update and version insert happen in **one transaction**, and the note row is locked (`SELECT ... FOR UPDATE`) while the next `versionNumber` is allocated. Concurrent saves therefore get distinct, consecutive numbers with no gaps and no unique-constraint failures.
- New request/response types and Zod schemas live only in `packages/shared`.

Decisions fixed for this ticket:
- **Versions record the state after a save**, so the newest version always equals the current note (title and content).
- **No-op saves are not versioned.** A PATCH whose title and content equal the current ones (editor autosave resending the same text) returns 200 and creates no version. Same for restoring a version that already equals the current state: 200, no new version.
- **Restore is non-destructive.** Restoring version 2 of a note at version 5 creates version 6 (copy of 2). Versions 1 to 5 stay. `updatedAt` advances. Tags and share links are untouched.
- **Existing notes** created before this ticket have no versions. Their history starts at their next saved change (that save is their version 1). No backfill migration.
- **Soft-deleted notes:** all three version endpoints return 404 `NOT_FOUND`, like every other note endpoint. Versions are kept and become visible again if the note is restored within 30 days. Trash restore (`POST /notes/{id}/restore`) does not create a version. A hard purge of a note cascades to its versions (existing FK).
- **Identifier:** the public handle for a version is its `versionNumber` (integer >= 1), unique per note. Responses also carry the version `id` (uuid).
- **Ownership:** all routes filter by `userId`; another user's note or an unknown version is 404 `NOT_FOUND`, never 403. A non-integer or < 1 `versionNumber` is 400 `VALIDATION_ERROR`, like malformed ids elsewhere.
- **Pagination** reuses the existing `page` (default 1) / `limit` (default 20, max 100) query and `{ items, page, limit, total }` envelope.
- No Prisma schema or migration change. No new error code.

## Capabilities

### New Capabilities
- `versions`: immutable per-note version history with list, read and restore.

### Modified Capabilities
- `notes`: create records version 1; update records a version when something changed.

## Impact

- Backend: new `src/versions/` (`versions.routes.ts`, `versions.service.ts`); `notes.service.ts` create/update gain the in-transaction version write; routes mounted under `/notes/:id/versions` via the notes router in `app.ts`.
- `packages/shared`: new `versions.ts` schemas and types, exported from `index.ts`.
- Out of scope: diff/compare view between versions, version retention caps or pruning, naming/labelling versions, deleting individual versions, backfilling history for pre-existing notes, restoring tags, the version-history UI.
