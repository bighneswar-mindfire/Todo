## Context

AB-1005 adds user-scoped tags on top of AB-1004 notes: tag CRUD (`/tags`), attach/detach (`PUT|DELETE /notes/{id}/tags/{tagId}`), a `tagId` filter on `GET /notes`, and a `tags` array on note responses. `Tag` and `NoteTag` already exist (`@@unique([userId, name])`, cascade on both `NoteTag` foreign keys), so there is no migration.

**Goals**
- Owner-only tags; foreign, unknown and wrong-state resources all return 404 `NOT_FOUND`.
- Idempotent attach/detach; deleting a tag never touches notes.
- Every spec scenario has exactly one named test, against the real Postgres.

**Non-Goals**
- Search (AB-1006), multi-tag filters, bulk tagging, tag merge, count limits, tags on trash summaries, UI.

## Decisions

### D1. Shared schemas (`packages/shared`)
New `src/tags.ts`, exported from `index.ts`: `TAG_NAME_MAX = 50`, `DEFAULT_TAG_COLOR = "#6b7280"`, `tagNameSchema` (trim, 1 to 50), `tagColorSchema` (`/^#[0-9a-fA-F]{6}$/`), `createTagRequestSchema` (color defaults), `updateTagRequestSchema` (both optional, at least one), `tagIdParamSchema`, `noteTagParamsSchema` (`id`, `tagId` uuids), `tagRefSchema`, `tagSchema`, `tagWithCountSchema`, `tagListResponseSchema` and inferred types.
`src/notes.ts`: `tags: z.array(tagRefSchema)` on `noteSchema` and `noteSummarySchema`; `trashNoteSummarySchema` is rebuilt from the base fields without `tags`; `noteListQuerySchema = pageQuerySchema.extend({ tagId: z.uuid().optional() })`. `src/auth.ts`: add `TAG_NAME_TAKEN` to `errorCodeSchema`.

### D2. Layout
`apps/backend/src/tags/{tags.routes,tags.service}.ts`, mirroring `notes/`. `createTagsRouter(service, authenticate)` is mounted at `/tags` in `app.ts`. Attach/detach routes sit on the notes router (`PUT|DELETE /:id/tags/:tagId`, 204) and delegate to the tags service, which keeps `NotesService` focused; `createNotesRouter` takes the tags service as an extra argument.

### D3. Uniqueness
Create and update catch Prisma `P2002` and throw `AppError("TAG_NAME_TAKEN", 409, ...)`, the same pattern as `EMAIL_TAKEN`. Update is `updateMany({ id, userId })` with `count === 0` as 404, then a re-read. Renaming to the tag's own name does not violate the index, so it succeeds.

### D4. List and noteCount
`findMany({ where: { userId }, orderBy: { name: "asc" } })` with `_count.notes` filtered to `note.deletedAt = null`, mapped to `noteCount`. Ordering follows the Postgres collation; tests use ASCII names.

### D5. Delete
`deleteMany({ id, userId })`, `count === 0` is 404. The FK cascade removes `NoteTag` rows; notes are never modified. Tags are hard deleted (soft-delete rule applies to notes only).

### D6. Attach and detach
One `$transaction` checks `note.findFirst({ id, userId, deletedAt: null })` and `tag.findFirst({ id, userId })`; either missing is 404. Attach is `noteTag.createMany({ skipDuplicates: true })` (idempotent and race-safe); detach is `noteTag.deleteMany`. Soft-deleted notes keep their links, so restore keeps tags.

### D7. Notes expose tags
Note reads include `tags` (via `NoteTag` -> `Tag`, ordered by tag name) and flatten to `{ id, name, color }` in `toNote` and the list mapping. `findOwned` and `get` share this, so create (empty), update and restore all return `tags`. `list` takes `tagId`: first `tag.findFirst({ id, userId })` (404 if missing), then `tags: { some: { tagId } }` is added to the `where` used by both `findMany` and `count`. Trash list is unchanged.

## Risks / Trade-offs
- Check-then-act between tag lookup and filter is harmless: a tag deleted in between yields an empty page.
- Existing note tests that deep-equal note or summary shapes need `tags: []`.
