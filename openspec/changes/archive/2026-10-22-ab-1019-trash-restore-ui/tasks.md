# Tasks

## Conventions

- Shell: prefix PATH for Node 22 / pnpm 10 on every command (`$env:Path = "$env:APPDATA\fnm\node-versions\v22.23.3\installation;" + $env:Path`).
- Tests first: write the failing test, then the code. One test per spec scenario, titled exactly as the scenario (37 scenarios: 34 in `frontend-trash`, 3 in `frontend-notes-list`). Extra unit tests are labelled "Unit".
- Tests stub `fetch` with `src/test/fake-api.ts`. Paths in the fake exclude the `/api` prefix.
- Frontend only: no backend, `packages/shared` or dependency change. Verify TanStack Query v5 (`useMutation`, `setQueriesData`, `invalidateQueries`, `keepPreviousData`) and react-router (`useSearchParams`) with Context7 before use.
- One task, one commit: `feat(frontend): description AB#1019`. Each group ends with a checkpoint.
- Branch: `feature/frontend/AB-1019-trash-restore-ui` from `main`.

## 1. API functions, keys and fixture (no UI)

- [x] 1.1 Unit test then code: add `makeTrashNote(overrides)` to `src/test/fixtures.ts` and parse it with `trashNoteSummarySchema` in `fixtures.test.ts`; verify with `pnpm --filter @todo/frontend test fixtures`

`src/api/notes.test.ts` - Requirement: Trash API functions
- [x] 1.2 Test "listTrash builds the query"
- [x] 1.3 Test "restoreNote posts to the note"
- [x] 1.4 Unit test: both functions reject when the response fails its schema
- [x] 1.5 Implement `listTrash` and `restoreNote` in `src/api/notes.ts` and add `trashKeys` to `src/queries/notes.ts`; verify with `pnpm --filter @todo/frontend test api/notes`
- [x] 1.6 Checkpoint: `pnpm build` (0 errors), `pnpm lint --max-warnings 0`, `pnpm test`

## 2. Trash link on the notes list

`src/pages/NotesPage.test.tsx` - Requirement: Trash entry in the notes-list header
- [x] 2.1 Test "Trash link is shown"
- [x] 2.2 Test "Trash link is shown for an empty account"
- [x] 2.3 Test "Trash link opens the trash page" (needs the route from 3.x; write it now, it passes after 3.15)
- [x] 2.4 Add the **Trash** link to the `NotesPage` header outside the list-state branches; verify 2.1 and 2.2 pass and the existing `NotesPage` tests stay green unchanged
- [x] 2.5 Checkpoint: `pnpm build` (0 errors), `pnpm lint --max-warnings 0`, `pnpm test` (2.3 may be the only failure until 3.15; record it, do not skip it)

## 3. Trash page: list, pagination, states

`src/pages/TrashPage.test.tsx` (through `renderApp("/trash")`) - Requirement: Trash page
- [x] 3.1 Test "Trashed notes are listed with their details"
- [x] 3.2 Test "Empty excerpt is omitted in trash"
- [x] 3.3 Test "Trash order is kept"
- [x] 3.4 Test "Trash titles are not links"
- [x] 3.5 Test "Trash first request uses defaults"
- [x] 3.6 Test "Back to notes"
- [x] 3.7 Test "Unauthenticated trash visit is redirected"

Requirement: Trash pagination in the URL
- [x] 3.8 Test "Trash pagination hidden for a single page"
- [x] 3.9 Test "Trash Next loads the next page"
- [x] 3.10 Test "Trash page restored from the URL"
- [x] 3.11 Test "Invalid trash page treated as 1"
- [x] 3.12 Test "Trash page beyond the end falls back to the last page"

Requirement: Trash loading, empty and error states
- [x] 3.13 Tests "Trash loading indicator", "Empty trash", "Trash request failure with retry", "Trash network failure shown", "Malformed trash response becomes an error state" (five separate tests)
- [x] 3.14 Implement `useTrashList` in `src/queries/trash.ts` and `src/components/trash/TrashListItem.tsx` (title, excerpt, `<time>`, **Restore** button that does nothing yet; export the date formatter from `NoteMeta.tsx`)
- [x] 3.15 Implement `src/pages/TrashPage.tsx` (header, Back to notes, states, `PaginationBar`, past-the-end fallback using `parseListParams` and `buildListParams({ page })`) and the `/trash` route inside `RequireAuth`; verify 3.1 to 3.13 and 2.3 pass
- [x] 3.16 Checkpoint: `pnpm build` (0 errors), `pnpm lint --max-warnings 0`, `pnpm test`

## 4. Restore

`src/pages/TrashPage.test.tsx` - Requirement: Restore a note
- [x] 4.1 Test "Restoring a note removes it from trash"
- [x] 4.2 Test "Restoring refreshes notes, tags and search"
- [x] 4.3 Test "Restored note is back in the notes list"
- [x] 4.4 Test "Restore double press sends one request"
- [x] 4.5 Test "Other rows stay usable during a restore"
- [x] 4.6 Test "Restoring the last row of a page"
- [x] 4.7 Implement `useRestoreNote` in `src/queries/trash.ts` (per-row mutation; `onSuccess` filters the id from cached trash lists, invalidates `trashKeys.all` and, through `useInvalidateLists`, lists, tags and search; sets the note detail cache) and wire **Restore** in `TrashListItem` (ref plus `isPending` guard); verify 4.1 to 4.6 pass
- [x] 4.8 Checkpoint: `pnpm build` (0 errors), `pnpm lint --max-warnings 0`, `pnpm test`

## 5. Failures, session handling, delete refresh, accessibility

Requirement: Restore failures
- [x] 5.1 Test "Restore of a note that is no longer restorable"
- [x] 5.2 Test "Server failure keeps the row"
- [x] 5.3 Test "Network failure on restore"
- [x] 5.4 Test "Malformed restore response"
- [x] 5.5 Test "Retry after a failed restore"
- [x] 5.6 Unit test: the restore alert clears on page change
- [x] 5.7 Implement `onError` (refetch trash through `invalidateQueries(trashKeys.all)`) and the page-level `restoreError` alert with the 404 versus generic messages, cleared on success and page change; verify 5.1 to 5.6 pass

Requirement: Session handling on the trash page (patterned on the AB-1010 session tests)
- [x] 5.8 Test "Expired session on the trash list"
- [x] 5.9 Test "Expired token is refreshed once for restore"; verify both pass with no new production code (if one fails, fix in `api/client.ts` only after checking AB-1010 specs)

Requirement: Deleting a note refreshes the trash (`src/pages/NoteEditorPage.test.tsx` or `TrashPage.test.tsx`)
- [x] 5.10 Test "Deleted note appears in trash"
- [x] 5.11 Add `trashKeys.all` invalidation to `useDeleteNote.onSuccess`; verify 5.10 passes and the existing delete tests stay green

Requirement: Trash page accessibility
- [x] 5.12 Test "Restore buttons name their note"; verify (the `aria-label`, list semantics and `role="status"`/`role="alert"` come from 3.14 to 5.7; fix any gap here)
- [x] 5.13 Checkpoint: `pnpm build` (0 errors), `pnpm lint --max-warnings 0`, `pnpm test`

## 6. Docs and integration check

- [x] 6.1 Document the feature in `apps/frontend/CLAUDE.md` (an "AB-1019 trash" section: files, `trashKeys` placement, the per-row restore mutation, the refetch-on-failure rule, why rows are not links) and verify the text matches the code by reading the files it names
- [x] 6.2 Verify scenario coverage: every one of the 37 scenario names in the two spec deltas appears as exactly one test title (`pnpm test` in `packages/repo-checks` if it covers frontend titles, otherwise a grep) and `pnpm exec openspec validate ab-1019-trash-restore-ui --strict` passes
- [x] 6.3 Definition of done: `pnpm build`, `pnpm lint --max-warnings 0`, `pnpm test --coverage` (new code at least 80%), no new `any`, `@ts-ignore` or `eslint-disable`
- [x] 6.4 Manual smoke with the `run` skill: start Postgres, backend and frontend; with curl register a user, create and delete a note, check `GET /notes/trash` lists it, `POST /notes/{id}/restore` answers 200 and a second restore answers 404; then, if a browser is available, open `/trash` and restore from the page. Record what was checked and what could not be run. Status (2026-10-22): not run by Claude. Postgres was up, but the permission layer denied curl and sleep, so the API sequence and the browser check were left for the user to run. Update (2026-10-22): the user ran the manual smoke test and reported that everything worked; no per-step details were recorded

## Workflow follow-up

- Review `git diff main...HEAD` against this change in a fresh session (`/review ab-1019-trash-restore-ui`), then `/create-pr ab-1019-trash-restore-ui`.
- At sync, change the `docs/SDS.md` section 10 AB-1019 row from Gap to Implemented.
- After merge: `/opsx:sync ab-1019-trash-restore-ui`, then `/opsx:archive ab-1019-trash-restore-ui`.
