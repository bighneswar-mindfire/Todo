## Why

AB-1004 delivered note CRUD. Users now need to organise notes without folders (out of scope). Tags are the organising primitive: a user creates named, coloured tags, attaches them to notes, and filters their note list by tag. Search (AB-1006) and the UI (AB-1010+) build on this.

## What Changes

- `POST /tags`: create a tag (`name`, optional `color`).
- `GET /tags`: list the caller's tags, ordered by name, each with `noteCount` (active notes only).
- `PATCH /tags/{id}`: rename and/or recolor a tag.
- `DELETE /tags/{id}`: delete a tag and detach it from all notes. Notes are untouched.
- `PUT /notes/{id}/tags/{tagId}`: attach a tag to an active note (idempotent).
- `DELETE /notes/{id}/tags/{tagId}`: detach a tag from an active note (idempotent).
- `GET /notes` gains an optional `tagId` filter; note summaries and `Note` responses gain a `tags` array (`id`, `name`, `color`).
- Everything sits behind `authenticate` and is user-scoped. A tag or note that does not exist or belongs to another user returns 404 `NOT_FOUND`, never 403.
- Shared Zod schemas and types in `packages/shared` only. New error code `TAG_NAME_TAKEN` (409).

Decisions fixed for this ticket:
- Name: trimmed, 1 to 50 characters, unique per user. Uniqueness is case-sensitive, matching the existing `@@unique([userId, name])` constraint (`Work` and `work` are different tags).
- Color: `#RRGGBB` hex, default `#6b7280` (the existing column default).
- No tag-count cap per user or per note.
- Tags are real (hard) deletes. The soft-delete rule applies to notes only; a tag has no restore window.
- Soft-deleted notes keep their tag links, so restoring a note restores its tags. Deleted notes cannot be tagged or untagged, and do not count toward `noteCount`.
- `GET /notes?tagId=` with a tag the caller does not own returns 404 `NOT_FOUND`; with a malformed id, 400.
- Filtering by one tag only (no multi-tag AND/OR).
- No Prisma schema or migration change: `Tag` and `NoteTag` exist from AB-1001.

## Capabilities

### New Capabilities
- `tags`: tag CRUD, attach/detach on notes, tag exposure on note responses, all user-scoped.

### Modified Capabilities
- `notes`: `GET /notes` list requirement gains the `tagId` filter and `tags` in summaries.

## Impact

- Backend: new `/tags` routes and service, tag sub-routes under `/notes/{id}/tags`, notes service includes tags and the filter, 409 handling for `TAG_NAME_TAKEN`.
- `packages/shared`: tag schemas and types, `tags` added to note schemas, `TAG_NAME_TAKEN` in the error code enum.
- Out of scope: search (AB-1006), multi-tag filters, bulk tagging, tag merge, tag count limits, tags on trash summaries, the tags UI (AB-1010+).
