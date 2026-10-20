## Why

Notes are the core of the app. AB-1002 delivered authentication; AB-1004 delivers the first user-scoped resource: creating, reading, editing and soft-deleting notes with a trash and restore flow. Tags, search, sharing and versions (AB-1005 to AB-1009) build on these endpoints.

## What Changes

- `POST /notes`: create a note (`title`, TipTap JSON `content`). The server derives plain `contentText` from the content (used later by full-text search).
- `GET /notes`: paginated list of the caller's active (not deleted) notes, newest `updatedAt` first, returning summaries with a short excerpt.
- `GET /notes/{id}`: one active note with full content.
- `PATCH /notes/{id}`: partial update of `title` and/or `content`; `contentText` is re-derived when `content` changes.
- `DELETE /notes/{id}`: soft delete. Sets `deletedAt` only; the row is never physically removed.
- `GET /notes/trash`: paginated list of the caller's deleted notes still inside the 30-day restore window, most recently deleted first.
- `POST /notes/{id}/restore`: clears `deletedAt` for a note inside the 30-day window.
- All routes sit behind the `authenticate` middleware. A note that belongs to another user, does not exist, or is in the wrong state (deleted vs active) returns 404 `NOT_FOUND`, never 403, so existence is not leaked.
- Shared Zod schemas and types for notes in `packages/shared` only. New error code `NOT_FOUND`.
- `express.json` body limit raised to 1 MB so large documents fit; larger bodies are rejected by the existing handler as 400 `VALIDATION_ERROR`.

Decisions fixed for this ticket:
- Title: trimmed, 1 to 200 characters. Content: a TipTap document object (`type: "doc"`); when omitted on create it defaults to an empty document.
- Pagination: `page` (default 1) and `limit` (default 20, max 100); response is `{ items, page, limit, total }`.
- The 30-day window is measured from `deletedAt`. Notes past the window disappear from trash and cannot be restored (404). No purge job in this ticket, so no rows are ever deleted.
- `updatedAt` changes on edit; delete and restore do not change `content`.

## Capabilities

### New Capabilities
- `notes`: note CRUD, soft delete, trash listing and restore, all user-scoped.

### Modified Capabilities
None.

## Impact

- Backend: new `/notes` routes, notes service, content-to-text helper, `NOT_FOUND` handling. No Prisma schema or migration change: `Note` from AB-1001 already has `deletedAt`, `content` and `contentText`.
- `packages/shared`: new note schemas, types and `NOT_FOUND` in the error code enum.
- Out of scope: tags (AB-1005), search (AB-1006), sharing, version history (versions are not written yet), permanent purge job, pinning/archiving, the notes UI (AB-1010+), rate limiting.
