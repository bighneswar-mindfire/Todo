## Conventions

- Shell: prefix PATH for Node 22 / pnpm 10 on every command (`$env:Path = "$env:APPDATA\fnm\node-versions\v22.23.3\installation;" + $env:Path`).
- Model per task: Haiku = boilerplate, Sonnet = implementation. No Opus task (design.md is approved).
- No task is estimated over 45 minutes, so no subagent is needed. `[PARALLEL]` marks tasks that touch separate files and can run in separate worktrees.
- Test files hold one test per scenario, titled exactly as the scenario. 30 scenarios, 30 test tasks (1 in section 1, 29 in section 4: 6 + 6 + 7 + 3 + 6 + 1). The three AB-1010 tests that move with `HomePage` ("Logout revokes and clears", "Logout succeeds locally when the API fails", "Home shows the signed-in user") keep their titles and are not counted.
- Frontend tests stub `fetch` through `src/test/fake-api.ts` (no MSW). `test-setup.ts` already resets the session, `localStorage` and the fake API before each test.
- `@todo/shared` is consumed from `dist/`. No shared change is planned; if one becomes necessary run `pnpm --filter @todo/shared build` first.
- No new dependency. TanStack Query `placeholderData: keepPreviousData` and react-router `useSearchParams` / `setSearchParams(next, { replace })` were verified in the plan; re-check any other API with Context7 before using it.
- One commit per phase after its checkpoint: `feat(frontend): description AB#1011`.

## 1. API functions and test infrastructure

- [x] 1.1 Create `src/api/notes.ts`: `listNotes({ page, limit, tagId })` (query built with `URLSearchParams` in order `page`, `limit`, `tagId`, `tagId` only when set; `auth: "bearer"`, `schema: noteListResponseSchema`) and `listTags()` (`tagListResponseSchema`) (Sonnet)
- [x] 1.2 [PARALLEL] Extend `src/test/fake-api.ts`: `FakeRequest` and `FakeCall` gain `query: URLSearchParams`; route key still ignores the query string (Haiku)
- [x] 1.3 [PARALLEL] Extend `src/test/fixtures.ts`: `makeNote`, `makeTag`, `notesPage({ items, page, limit, total })`, `routeEmptyNotes()` (empty `GET /notes` and `GET /tags`), and a `deferred()` helper for held responses (Haiku)
- [x] 1.4 Update the existing tests that open `/` (`App.test.tsx`, `foundation.test.tsx`) to call `routeEmptyNotes()` where they now trigger list requests (Haiku)

`src/api/notes.test.ts` - Requirement: Notes API functions
- [x] 1.5 Test "listNotes builds the query"

- [x] 1.6 Checkpoint: `pnpm build` (0 errors), `pnpm lint --max-warnings 0`, `pnpm test`

## 2. URL state, tag color and queries

- [x] 2.1 Create `src/lib/list-params.ts`: `PAGE_SIZE = 20`, `parseListParams(URLSearchParams)` (`page` must match `^[1-9]\d*$` else 1; `tagId` validated with `noteListQuerySchema.shape.tagId.safeParse` from `@todo/shared`, invalid dropped) and `buildListParams({ page, tagId })` (bare for page 1 without a tag; key order `page`, `tagId`) (Sonnet)
- [x] 2.2 [PARALLEL] Create `src/lib/tag-color.ts`: `textColorFor(hex)` returns black or white from relative luminance (Haiku)
- [x] 2.3 [PARALLEL] Create `src/queries/notes.ts`: `notesKeys`, `useNotesList({ page, tagId })` with `placeholderData: keepPreviousData`, and `useTags()` as a separate query (Sonnet)
- [x] 2.4 Unit tests (not scenarios) in `src/lib/list-params.test.ts` and `src/lib/tag-color.test.ts`: page parsing edge cases (`abc`, `0`, `-1`, `1.5`, `2`), tagId validity, build output order, black and white thresholds (Haiku)
- [x] 2.5 Checkpoint: `pnpm build` (0 errors), `pnpm lint --max-warnings 0`, `pnpm test`

## 3. Components

- [x] 3.1 [PARALLEL] Create `src/components/notes/TagChip.tsx` (`<span>` with `backgroundColor` and `textColorFor`) (Haiku)
- [x] 3.2 [PARALLEL] Create `src/components/notes/PaginationBar.tsx`: `<nav aria-label="Pagination">`, **Previous**, "Page X of Y" from the response, **Next**, disabled at the bounds; renders nothing when Y <= 1; takes an `onPageChange` callback (Sonnet)
- [x] 3.3 Create `src/components/notes/NoteListItem.tsx`: `<li>` with title in a heading, excerpt only when non-empty, `TagChip`s, `<time dateTime={updatedAt}>` formatted by a module-level `Intl.DateTimeFormat` (Sonnet)
- [x] 3.4 Create `src/components/notes/TagFilter.tsx`: `role="group"` labelled "Filter by tag", **All notes** and one `aria-pressed` button per tag showing name and `noteCount`; tags error shows `role="alert"` "Couldn't load tags" with **Retry** (Sonnet)
- [x] 3.5 Checkpoint: `pnpm build` (0 errors), `pnpm lint --max-warnings 0`, `pnpm test`

## 4. Page, route and page tests

- [x] 4.1 `git mv` `pages/HomePage.tsx` and `HomePage.test.tsx` to `NotesPage.*`; keep header (email, **Log out**) and the logout mutation unchanged; update `routes/router.tsx` so `/` renders `NotesPage` (Sonnet)
- [x] 4.2 Implement `NotesPage` per design D3 to D6: read `useSearchParams` through `parseListParams`; wire queries, `TagFilter`, list, `PaginationBar` and the render order (404 with tag, generic error with **Retry**, loading `role="status"` "Loading notes", empty states, list); tag change drops `page`; pagination pushes, out-of-range effect replaces (guarded by `!isPlaceholderData`) (Sonnet)
- [x] 4.3 Keep the three relocated AB-1010 tests (logout and home) green in `NotesPage.test.tsx` with `routeEmptyNotes()` (Haiku)

`src/pages/NotesPage.test.tsx` - Requirement: Notes list page
- [x] 4.4 Test "Notes are listed with their details"
- [x] 4.5 Test "Tags are shown on each note"
- [x] 4.6 Test "Empty excerpt is omitted"
- [x] 4.7 Test "API order is kept"
- [x] 4.8 Test "First request uses defaults"
- [x] 4.9 Test "Unauthenticated visit is redirected"

`src/pages/NotesPage.test.tsx` - Requirement: Pagination
- [x] 4.10 Test "Pagination hidden for a single page"
- [x] 4.11 Test "Pagination shows position"
- [x] 4.12 Test "Next loads the next page"
- [x] 4.13 Test "Last page disables Next"
- [x] 4.14 Test "Previous page stays visible while loading"
- [x] 4.15 Test "Page beyond the end falls back to the last page"

`src/pages/NotesPage.test.tsx` - Requirement: Tag filter
- [x] 4.16 Test "Filter buttons list the tags"
- [x] 4.17 Test "Choosing a tag filters the list"
- [x] 4.18 Test "Choosing a tag resets the page"
- [x] 4.19 Test "Clearing the filter"
- [x] 4.20 Test "All notes clears the filter"
- [x] 4.21 Test "Notes do not wait for tags"
- [x] 4.22 Test "Tags failure does not block the list"

`src/pages/NotesPage.test.tsx` - Requirement: URL-driven view state
- [x] 4.23 Test "View restored from the URL"
- [x] 4.24 Test "Invalid page treated as 1"
- [x] 4.25 Test "Malformed tagId ignored"

`src/pages/NotesPage.test.tsx` - Requirement: Loading, empty and error states
- [x] 4.26 Test "Loading indicator"
- [x] 4.27 Test "Empty account"
- [x] 4.28 Test "Empty filter result"
- [x] 4.29 Test "Request failure with retry"
- [x] 4.30 Test "Network failure shown"
- [x] 4.31 Test "Unknown tag in the URL"

`src/pages/NotesPage.test.tsx` - Requirement: Notes API functions
- [x] 4.32 Test "Malformed response becomes an error state" (page level: a 200 body failing the schema shows the failure alert with **Retry**)

- [x] 4.33 Checkpoint: `pnpm build` (0 errors), `pnpm lint --max-warnings 0`, `pnpm test`

## 5. Docs, audit and smoke

- [x] 5.1 Update `apps/frontend/CLAUDE.md` with an AB-1011 section: list page structure, URL state helpers, query keys and the `routeEmptyNotes()` test helper (Haiku)
- [x] 5.2 Manual smoke with the `run` skill: start Postgres, backend and frontend; create 25 notes and two tags through the Vite proxy with curl; verify the list, paging, tag filter, bad `page`/`tagId` in the URL, and Retry with the backend stopped. No browser is available, so record what was checked by curl and tests (Playwright is AB-1016) (Sonnet)
- [x] 5.3 Scenario audit: confirm each of the 30 scenario titles in `specs/frontend-notes-list/spec.md` has exactly one test with that exact name (Haiku)
- [x] 5.4 Final checkpoint: `pnpm build` (0 errors), `pnpm lint --max-warnings 0`, `pnpm test --coverage`
