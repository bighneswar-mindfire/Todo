# Proposal

## Why

Ticket AB-1013 implements FR-FE-6 (and FR-FE-9, never render unsanitized HTML) from `docs/FRS.md` section 2.7. The backend already serves `GET /search` with ranked results and `highlight: { title, snippet }`, but the app has no way to use it: users cannot search their notes.

## What Changes

- **New `/search` page** (protected): a search box with a 300 ms debounce bound to the `q` URL parameter, ranked results, pagination and a tag filter. State lives in the URL (`?q=&page=&tagId=`), as on the notes list.
- **Search box in the notes-list header**: submitting it opens `/search?q=<text>`.
- **Highlighted title and snippet rendered safely**: the server string is split on `<mark>` / `</mark>`, the five entities the server emits are unescaped, and the parts are rendered as React text and `<mark>` elements. No `dangerouslySetInnerHTML`, no sanitizer library.
- **States**: prompt for blank `q`, loading, empty ("No results"), retryable error, over-length message (`q` longer than 200 characters sends no request), and unknown-tag recovery.
- **Fresh results**: saving or deleting a note invalidates cached searches so edits and deletions are reflected (FR-SRCH-7 seen from the UI).
- **Out of scope**: backend changes, search sorting (ranking is server-side), search inside the trash, saved searches, search suggestions, the `/trash` and share routes.

Decisions fixed with the user: dedicated `/search` page plus the header box; split-on-`<mark>` rendering with entity unescaping.

Assumptions recorded: typing updates the URL with `replace` so Back does not step through keystrokes; the previous results stay visible while a new query loads; `q` is trimmed before it is sent; the tag filter reuses the existing tag list and counts (counts are note totals, not search-result counts).

Rollback: remove the `/search` route and the header box; no data or API is touched.

## Capabilities

### New Capabilities
- `frontend-search`: the `/search` page, its URL state, debounced query, safe highlight rendering, result list, states, pagination, tag filter and cache freshness.

### Modified Capabilities
- `frontend-notes-list`: adds the search box to the notes-list header (ADDED requirement; existing requirements are unchanged).

## Impact

- Frontend only: `apps/frontend/src` (`pages/SearchPage.tsx`, `components/search/*`, `api/search.ts`, `queries/search.ts`, `lib/` helpers, `routes/router.tsx`, `pages/NotesPage.tsx`, `queries/note.ts`).
- `packages/shared`: no new schemas; `searchQuerySchema`, `searchResponseSchema` and `SearchResult` already exist.
- No new dependency. No API, database or backend change; `delta-openapi.yaml` has empty `paths`.
- Links: ticket AB-1013, FRS FR-FE-6 and FR-FE-9, SDS sections 4.4, 6.
