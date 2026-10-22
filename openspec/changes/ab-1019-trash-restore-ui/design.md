# Design

## Context

Frontend only. The backend (AB-1004) and the shared schemas (`trashListResponseSchema`, `trashNoteSummarySchema`, `noteSchema`) already exist. `NotesPage` is the model: URL-driven pagination through `lib/list-params.ts` (`parseListParams`, `buildListParams`), `useNotesList` with `keepPreviousData`, `PaginationBar`, an `Alert` with Retry, and the past-the-end fallback effect. Query keys live in `queries/notes.ts` (`notesKeys.lists = ["notes","list"]`); `useInvalidateLists` in `queries/note.ts` marks lists, tags and search stale; `useDeleteNote` removes the note detail and calls it. All HTTP goes through `api/client.ts`. See proposal.md for scope and the assumptions this design builds on.

## Goals / Non-Goals

**Goals:**
- Reuse the notes-list page structure, pagination bar, list-params parsing and alert pattern so the trash page behaves like the list.
- One test per spec scenario; no new dependency.

**Non-Goals:**
- No backend, shared or dependency change; no permanent delete, preview or bulk actions.

## Decisions

**D1. Contract first, nothing new in shared.** `listTrash({ page, limit }): Promise<TrashListResponse>` and `restoreNote(id): Promise<Note>` go in `api/notes.ts` beside `listNotes` and `deleteNote`. `listTrash` builds the query like `listNotes` and parses with `trashListResponseSchema`; `restoreNote` sends `POST /notes/{id}/restore` through `request` with `auth: "bearer"` and `schema: noteSchema`. Alternative: a new `api/trash.ts`; rejected, a two-function file adds nothing and the notes file already owns note endpoints.

**D2. Query keys.** `trashKeys` in `queries/notes.ts` (see D9); the hooks `useTrashList` and `useRestoreNote` live in a new `queries/trash.ts`: `all = ["notes","trash"]`, `list(params) = ["notes","trash",params]`. The trash key sits under `["notes"]` but not under `["notes","list"]`, so `useInvalidateLists` leaves it alone and a trash refetch never fires on every note save. `useTrashList(page)` mirrors `useNotesList` (`keepPreviousData`, `limit: PAGE_SIZE`).

**D3. Page parameters reuse the list parser.** `parseListParams` already normalizes `page` (bad value becomes 1) and also reads `tagId`, which the trash page ignores. The page calls it and uses only `page`, and builds URLs with `buildListParams({ page })`, so `?tagId=` never appears. Alternative: a separate `parseTrashParams`; rejected, it would duplicate the regex for no behavioural gain. If the tagId read ever causes trouble, extract then.

**D4. Restore is one mutation per row.** `useRestoreNote()` returns a `useMutation` with `mutationFn: restoreNote`. Each `TrashListItem` calls the hook itself, so `isPending` is per row (spec: other rows stay usable, double press sends one request). A ref flag plus `isPending` guard the handler, same pattern as the share dialog's `revokingRef`. Cache effects live in the hook options, not in `mutate()` callbacks, so they still run if the row unmounts while the request is in flight. Alternative: one page-level mutation with a `pendingId`; rejected, `useMutation` would track only the latest variables and a second row's restore would clobber the first row's state.

**D5. Cache handling.** On success, `onSuccess` first filters the id out of every cached trash list with `queryClient.setQueriesData` (so the restored row does not flash while the refetch runs), then invalidates `trashKeys.all` (the spec requires the refetch, and it also drives the past-the-end fallback when the last row of a page was restored). It also calls `useInvalidateLists` (lists, tags, search) so the restored note and the tag `noteCount` come back, and sets `noteKeys.detail(id)` to the returned note so opening it is instant (an addition beyond the spec's observable behaviour, harmless and not tested separately). On 404 or any other failure the hook does not touch caches; the component asks for a trash refetch through `invalidateQueries(trashKeys.all)` in `onError`, which covers 404, 5xx, network and malformed-body failures uniformly.

**D6. Error messages in the component.** `TrashPage` holds `restoreError: string | null`, set by an `onRestoreError(error)` callback passed to each row (`ApiError` with status 404 gives "That note can't be restored", everything else "Couldn't restore that note. Try again"). It is cleared on a successful restore and on page change. Alternative: per-row messages; rejected, the spec and the notes-list use one page-level alert and a 404 row disappears on refetch, so a row-level message would vanish with it.

**D7. Session handling for free.** The 401 refresh-once flow is in `api/client.ts` (AB-1010). Tests assert it for the two new calls; there is no new code. A rejected refresh redirects through the existing session store and `RequireAuth`.

**D8. Route and link.** `{ path: "/trash", Component: TrashPage }` goes inside the `RequireAuth` group in `routes/router.tsx`, giving the unauthenticated redirect scenario for free. `NotesPage` gets `<Link to="/trash" className={buttonVariants({ variant: "outline" })}>Trash</Link>` in the header actions, rendered outside the list-state branches so it shows in every state. Alternative: a nav bar shared by pages; rejected, there is none today and it is a larger change than the ticket.

**D9. Delete refreshes the trash.** `useDeleteNote.onSuccess` additionally calls `invalidateQueries({ queryKey: trashKeys.all })`. `queries/note.ts` already imports `notesKeys` from `./notes`, and `queries/trash.ts` needs `useInvalidateLists` from `./note`, so `trashKeys` is defined in `queries/notes.ts` next to `notesKeys` to avoid an import cycle (D2 refers to it there).

**D10. Rendering.** `TrashListItem` reuses the card classes of `NoteListItem` but renders the title as an `<h2>` without a link, the excerpt when non-empty, and a `<time dateTime={deletedAt}>` formatted with the same `Intl.DateTimeFormat` as `NoteMeta` (`Deleted <date>`). The button is `aria-label` "Restore {title}". The date formatter is exported from `NoteMeta.tsx` rather than copied.

**D11. Tests reuse the harness.** `renderApp("/trash")` with `fake-api.ts` routes (`GET /notes/trash`, `POST /notes/:id/restore`, `GET /notes`, `GET /tags`), a new `makeTrashNote(overrides)` fixture, and the AB-1010 session test pattern for the two 401 scenarios. Cache-staleness scenarios assert refetch requests through `callsTo`, not private cache state.

## Risks / Trade-offs

- [A note is restored by another tab, so the row's Restore returns 404] → handled as the 404 scenario: message plus refetch; the row disappears.
- [Restore succeeds but the response is malformed] → treated as failure with a refetch, so the UI converges on the server state (the row vanishes if the restore did happen).
- [`parseListParams` also reads `tagId`] → ignored on this page (D3); covered by building URLs without it.
- [A deleted note's tags are not shown in trash] → by API design (summary has no tags); tags return on restore (FR-NOTE-7, FR-TAG-6).
- [The trash list can be stale after a delete in another tab] → acceptable; Retry and reload refetch, and the default stale time refetches on mount.

## Migration Plan

None: no data, API or dependency change. Rollback is reverting the commits; notes already restored stay active.
