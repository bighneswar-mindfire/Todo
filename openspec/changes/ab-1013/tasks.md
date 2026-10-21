## Conventions

- Shell: prefix PATH for Node 22 / pnpm 10 on every command (`$env:Path = "$env:APPDATA\fnm\node-versions\v22.23.3\installation;" + $env:Path`).
- Tests first: write the failing test, then the code. One test per spec scenario, titled exactly as the scenario (53 scenarios: 49 in `frontend-search`, 4 in `frontend-notes-list`). Extra unit tests are labelled "Unit".
- Tests stub `fetch` with `src/test/fake-api.ts`; timer tests use `vi.useFakeTimers({ shouldAdvanceTime: true })`.
- No new dependency, no `packages/shared` change, no backend change. Verify React Router and TanStack Query APIs with Context7 before use.
- One task, one commit: `feat(frontend): description AB#1013`. Each group ends with a checkpoint.

## 1. Pure helpers, API and queries (no UI)

- [x] 1.1 Unit tests then `src/lib/highlight.ts` `parseHighlight(s)` -> `{ text, marked }[]` (unbalanced marks, entity unescape after split); verify with `pnpm --filter @todo/frontend test highlight`
- [x] 1.2 Unit tests then `src/lib/search-params.ts` `parseSearchParams` / `buildSearchParams` (trim, blank `q` dropped, page and tag normalised); verify with its test file
- [x] 1.3 Unit tests then `src/api/search.ts` `searchNotes` using `request()` and `searchResponseSchema` (rejects a malformed reply); verify with `src/api/search.test.ts`
- [x] 1.4 Unit tests then `src/hooks/useDebouncedCallback.ts` (300 ms, last call wins, cleared on unmount); verify with its test file
- [x] 1.5 Extend `src/test/fixtures.ts` with `makeSearchResult(overrides)` and `searchPage(items, total)` (valid `searchResponseSchema`)
- [x] 1.6 Test then `src/queries/search.ts` (`searchKeys`, `useSearch`, disabled for blank or over-length `q`, `keepPreviousData`); verify with `src/queries/search.test.tsx`
- [x] 1.7 Checkpoint: `pnpm build` (0 errors), `pnpm lint --max-warnings 0`, `pnpm test`

## 2. Components

`src/components/search/HighlightedText.test.tsx` - Requirement: Safe highlight rendering
- [ ] 2.1 Test "Matched words are marked"
- [ ] 2.2 Test "Several marks are rendered"
- [ ] 2.3 Test "Entities are shown as characters"
- [ ] 2.4 Test "Escaped markup stays text"
- [ ] 2.5 Test "Unexpected markup is not interpreted"
- [ ] 2.6 Test "Unbalanced marks do not break rendering"
- [ ] 2.7 Test "Text without marks"
- [ ] 2.8 Implement `HighlightedText` (renders `parseHighlight` tokens; no `innerHTML`)
- [ ] 2.9 Extract `src/components/notes/NoteMeta.tsx` (tag chips + `<time>`) from `NoteListItem`; existing notes-list tests stay green (Unit: render test)
- [ ] 2.10 Implement `SearchResultItem` (highlighted title link to `/notes/<id>`, snippet omitted when empty, `NoteMeta`, no rank)
- [ ] 2.11 Implement `SearchBox` (landmark, "Search notes" input; `live` mode with debounced `onQuery`, `submit` mode with a **Search** button) (Unit tests for both modes)
- [ ] 2.12 Checkpoint: `pnpm build` (0 errors), `pnpm lint --max-warnings 0`, `pnpm test`

## 3. Search page

`src/pages/SearchPage.test.tsx`, Requirement: Search page access
- [ ] 3.1 Test "Unauthenticated visit is redirected"
- [ ] 3.2 Test "Rejected refresh ends the session"

Requirement: Query state lives in the URL
- [ ] 3.3 Test "Input is prefilled from the URL"
- [ ] 3.4 Test "Bad page falls back to 1"
- [ ] 3.5 Test "Malformed tag is ignored"
- [ ] 3.6 Test "Search can be reloaded"

Requirement: Debounced search box
- [ ] 3.7 Test "Request waits for the debounce"
- [ ] 3.8 Test "Request is sent after the debounce"
- [ ] 3.9 Test "Rapid typing sends one request"
- [ ] 3.10 Test "Query is trimmed"
- [ ] 3.11 Test "Typing replaces history"
- [ ] 3.12 Test "New query resets the page"
- [ ] 3.13 Test "Blank input sends no request"

Requirement: Query validation
- [ ] 3.14 Test "Over-length query is rejected locally"
- [ ] 3.15 Test "Exactly 200 characters is searched"

Requirement: Result list
- [ ] 3.16 Test "Results are listed with their details"
- [ ] 3.17 Test "Tags are shown on each result"
- [ ] 3.18 Test "API order is kept"
- [ ] 3.19 Test "Empty snippet is omitted"
- [ ] 3.20 Test "Rank is not displayed"
- [ ] 3.21 Test "Result title opens the note"

Requirement: Search states
- [ ] 3.22 Test "Blank query shows a prompt"
- [ ] 3.23 Test "Loading state"
- [ ] 3.24 Test "No results"
- [ ] 3.25 Test "Server error offers retry"
- [ ] 3.26 Test "Validation error from the server is handled"
- [ ] 3.27 Test "Network failure offers retry"
- [ ] 3.28 Test "Previous results stay while loading"
- [ ] 3.29 Test "Result count is announced"

- [ ] 3.30 Implement `src/pages/SearchPage.tsx` (header with `useLogout`, `SearchBox` live, status line, list, states, URL read/write via `search-params`); extract `useLogout` from `NotesPage` without behaviour change
- [ ] 3.31 Add the `/search` route under `RequireAuth` in `routes/router.tsx`
- [ ] 3.32 Checkpoint: `pnpm build` (0 errors), `pnpm lint --max-warnings 0`, `pnpm test`

## 4. Pagination and tag filter

Requirement: Search pagination (in `SearchPage.test.tsx`)
- [ ] 4.1 Test "Pagination hidden for one page"
- [ ] 4.2 Test "Next page is requested"
- [ ] 4.3 Test "Previous is disabled on the first page"
- [ ] 4.4 Test "Next is disabled on the last page"
- [ ] 4.5 Test "Page past the end falls back"

Requirement: Tag filter
- [ ] 4.6 Test "Selecting a tag filters results"
- [ ] 4.7 Test "Clearing the tag"
- [ ] 4.8 Test "Active tag is pressed"
- [ ] 4.9 Test "Changing the tag resets the page"
- [ ] 4.10 Test "Unknown tag is recoverable"
- [ ] 4.11 Test "Tag list failure does not block results"
- [ ] 4.12 Wire `PaginationBar` and `TagFilter` into `SearchPage` (page and tag changes push history; typing replaces)
- [ ] 4.13 Checkpoint: `pnpm build` (0 errors), `pnpm lint --max-warnings 0`, `pnpm test`

## 5. Notes-list header and freshness

`src/pages/NotesPage.test.tsx` - Requirement: Search entry in the notes-list header
- [ ] 5.1 Test "Submitting opens the search page"
- [ ] 5.2 Test "Search button submits"
- [ ] 5.3 Test "Blank submit does nothing"
- [ ] 5.4 Test "Typing alone sends no request"
- [ ] 5.5 Add `SearchBox` in `submit` mode to the `NotesPage` header

`src/queries/search.test.tsx` - Requirement: Results stay fresh
- [ ] 5.6 Test "Saved edit is reflected"
- [ ] 5.7 Test "Deleted note is not shown from cache"
- [ ] 5.8 Invalidate `searchKeys.all` in `useInvalidateLists` (`queries/note.ts`), keeping detail queries excluded
- [ ] 5.9 Checkpoint: `pnpm build` (0 errors), `pnpm lint --max-warnings 0`, `pnpm test --coverage` (>= 80% on new code); `pnpm exec openspec validate ab-1013 --strict`

## Workflow follow-up

- Verify in a fresh context with the `reviewer` sub-agent on `git diff main...HEAD`.
- `/create-pr ab-1013`, then after merge `/opsx:sync ab-1013` and `/opsx:archive ab-1013`.
