# Proposal

## Why

Ticket AB-1019 implements FR-FE-11 (trash page with restore) on top of FR-NOTE-6 (list trash) and FR-NOTE-7 (restore a trashed note), see `docs/FRS.md` sections 2.2 and 2.7. The backend (AB-1004) already serves `GET /notes/trash` and `POST /notes/{id}/restore`, but the app has no page for them: a deleted note disappears and cannot be recovered from the UI inside its 30-day window. FR-FE-3 once claimed a trash view that AB-1011 never built; the FRS now excludes it from FR-FE-3. The Playwright journey (AB-1016) also needs this ("delete and restore from trash" step).

## What Changes

- **New `/trash` page** behind the existing auth guard. It lists the user's trashed notes from `GET /notes/trash`, newest deletion first (the API order), 20 per page, with a "Trash" heading, a link back to the notes list, and loading, empty and error (with Retry) states.
- **Row content**: title (plain text, not a link), excerpt (omitted when empty) and the deletion time in a `<time>` element. A trashed note has no tags in the trash summary and cannot be opened.
- **Restore button per row.** It sends `POST /notes/{id}/restore`. On 200 the row leaves the list and the notes list, tag counts and search results are refreshed, so the note is back with its tags. While a restore is in flight that row's button is disabled; other rows stay usable.
- **Failures.** 404 (not deleted, outside the 30 days, or not owned) shows "That note can't be restored" and refetches the trash list. Any other failure keeps the row and shows an alert. An expired session follows the AB-1010 refresh flow.
- **URL state.** The page number is in the URL (`/trash?page=2`), parsed like the notes list: a bad `page` is treated as 1, and a page past the end falls back to the last page, which also covers restoring the last row of a page.
- **Entry point.** A **Trash** link in the notes-list header, beside **New note**.
- **API functions and queries.** `listTrash` and `restoreNote` in `api/notes.ts`, validated with `trashListResponseSchema` and `noteSchema` from `@todo/shared`; `useTrashList` and `useRestoreNote` in `queries/`. Deleting a note from the editor also marks the trash list stale so a later visit shows it.
- **Out of scope**: backend, database, dependency and `packages/shared` changes; permanent delete or "empty trash"; opening, previewing or editing a trashed note; restoring from the editor or from search; bulk restore; undo toast after delete; showing days left before purge (no rule for it in the FRS); the Playwright journey (AB-1016); button colour (AB-1017).

Decisions assumed (no user answer needed, change them at the gate if wrong): the route is `/trash` as listed in SDS section 6; the trash link lives in the notes-list header only; a restored note is not opened automatically, the user stays on the trash page; there is no confirm dialog because restore is non-destructive and reversible (delete again); rows are not links because the API cannot read a deleted note (404); the page size is the notes-list `PAGE_SIZE` of 20.

Rollback: remove the route, page, components, API functions, query hooks and the header link. No data or API is touched; notes already restored stay active.

Docs follow-up (at sync): update the `docs/SDS.md` section 10 row for AB-1019 from Gap to Implemented.

## Capabilities

### New Capabilities
- `frontend-trash`: the `/trash` page (list, states, pagination in the URL), the Restore action and its failure handling, session handling, and the `listTrash` and `restoreNote` API functions with their cache refresh.

### Modified Capabilities
- `frontend-notes-list`: ADDED requirement "Trash entry in the notes-list header", the same way "New note entry point" was added. No existing requirement text changes; existing scenarios stay true as written.

## Impact

- Frontend only: `apps/frontend/src/api/notes.ts`, `src/queries/trash.ts` (new), `src/queries/note.ts` (`useDeleteNote` invalidates the trash key), `src/pages/TrashPage.tsx`, `src/components/trash/TrashListItem.tsx`, `src/routes/router.tsx`, `src/pages/NotesPage.tsx` (link), `src/test/fixtures.ts` (`makeTrashNote`), tests. `lib/list-params.ts` is reused as is.
- No change to the backend, Prisma, `packages/shared` or dependencies. `delta-openapi.yaml` has empty `paths` and records how the UI reacts to the two endpoints.
- Existing `frontend-notes-list` and `frontend-note-editor` scenarios must stay green unchanged.
