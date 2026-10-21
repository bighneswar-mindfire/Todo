# Design

## Context

Frontend only; the backend (`GET /search`, `highlight`) and the shared schemas (`searchQuerySchema`, `searchResponseSchema`, `SearchResult`) already exist. The notes list (AB-1011) fixed the patterns to follow: URL is the state (`lib/list-params.ts`), `api/` functions on `request()`, TanStack Query hooks with `keepPreviousData`, and the `TagFilter`, `PaginationBar`, `TagChip`, `NoteListItem` components. The server escapes `& < > " '` as `&amp; &lt; &gt; &quot; &#39;` and its only markup is `<mark>` / `</mark>` (backend `highlight.ts`). See proposal.md for scope.

## Goals / Non-Goals

**Goals:**
- A `/search` page and a header box on `/` that reuse the existing list components.
- Highlights rendered without ever treating a server string as HTML (FR-FE-9).
- One test per spec scenario.

**Non-Goals:**
- No sanitizer library, no new dependency, no backend or shared-schema change.
- No search sorting, trash search, suggestions or recent-search storage.

## Decisions

**D1. One `SearchBox` component, two modes.** `SearchBox` is a `search` landmark with a labelled input. On `/search` it is *live*: it keeps local text state, and a debounced callback writes `q` to the URL. In the notes-list header it is *submit*: a form with a **Search** button that navigates to `/search?q=`. Alternative: two components; rejected as duplicated markup and labels.

**D2. Event-driven debounce, no effect on the value.** A small `useDebouncedCallback(fn, 300)` (timer in a ref, cleared on each call and on unmount) is called from the input's `onChange`. The page does not debounce a derived value in an effect, so a URL change from Back/Forward never loops. When the URL's `q` changes from outside (Back, header submit), the input is re-synced from the URL. Alternative: `useDeferredValue`/effect-debounce; rejected because it makes the URL write depend on render timing.

**D3. URL helpers in `lib/search-params.ts`.** `parseSearchParams(params)` returns `{ q, page, tagId }` (`q` trimmed, `page` and `tagId` normalised as in `list-params.ts` by reusing `parseListParams`); `buildSearchParams({ q, page, tagId })` omits blank `q`, page 1 and no tag. Typing calls it with `page: 1`. Writes use `setSearchParams(..., { replace: true })` for typing, and push for page and tag changes.

**D4. Safe highlight parser `lib/highlight.ts`.** `parseHighlight(s)` tokenises with `/<\/?mark>/` into `{ text, marked }[]`, tracking a boolean `inMark` (an unmatched `<mark>` simply marks to the end; a stray `</mark>` is ignored). Entities are unescaped in a single pass over the five known entities, after splitting, so a decoded `<mark>` can never become a tag. `HighlightedText` maps tokens to strings and `<mark>` elements. No `innerHTML`. Alternative: DOMPurify; rejected (new dependency; the server already guarantees the only markup).

**D5. Query hook `queries/search.ts`.** `searchKeys.all = ["search"]`, `searchKeys.list(params)`; `useSearch({ q, page, tagId })` has `enabled: q !== "" && q.length <= 200`, `placeholderData: keepPreviousData`. `api/search.ts` `searchNotes` builds the query string and validates the reply with `searchResponseSchema`. The tag list reuses `useTags`.

**D6. Freshness via invalidation.** `useInvalidateLists` in `queries/note.ts` also invalidates `searchKeys.all`, so saves and deletes discard cached searches. Detail queries are still excluded. Alternative: `staleTime: 0` only; rejected because a cached key would still show stale data first.

**D7. Page composition.** `SearchPage` mirrors `NotesPage`: same header (title, email, Log out via an extracted `useLogout` hook shared with `NotesPage`), then `SearchBox`, `TagFilter` (labels unchanged, counts are note totals), a polite status line ("N results"), the result list (`SearchResultItem` = `NoteMeta` tags/time + highlighted title/snippet) and `PaginationBar`. A 404 with a `tagId` shows the unknown-tag alert (same wording rule as the list); other failures show the retry alert. `NoteMeta` (tags + time) is extracted from `NoteListItem` so both items share it.

**D8. Route.** `/search` is added under `RequireAuth` in `routes/router.tsx`.

## Risks / Trade-offs

- [Fake timers and `userEvent` hang tests] -> use `vi.useFakeTimers({ shouldAdvanceTime: true })` and `userEvent.setup({ advanceTimers: vi.advanceTimersByTime })`.
- [A future server change adds markup] -> unknown tags render as text, never as elements; the parser test covers `<img>`.
- [Tag counts in the filter are note totals, not result counts] -> accepted and noted in the proposal.
- [Refactoring `NotesPage`/`NoteListItem`] -> existing notes-list tests must stay green; extract without behaviour change.

## Open Questions

None that affect specs or tasks.
