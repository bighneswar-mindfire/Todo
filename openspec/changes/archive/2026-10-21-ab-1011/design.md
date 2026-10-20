## Context

The backend is complete and AB-1010 delivered the frontend foundation. `/` is the protected placeholder `HomePage` (signed-in email + **Log out**). This ticket turns it into the notes list (capability `frontend-notes-list`, 30 approved scenarios). No backend, shared-package or dependency change.

Reused unchanged from AB-1010: `api/client.ts` `request()` (bearer token, single-flight 401 refresh, one retry), `api/transport.ts` (schema mismatch already becomes `ApiError(INTERNAL_ERROR)`, network failure becomes `NETWORK_ERROR`), `lib/query-client.ts` (4xx not retried, 5xx and network retried twice), `AppProviders` (clears the cache on sign-out), `routes/guards.tsx`, hand-copied shadcn `ui/` (button, alert, card), and the `test/` helpers (`fake-api`, `render`, `fixtures`). Pinned already: `@tanstack/react-query` 5.104.5, `react-router` 8.5.0.

Library behaviour verified with Context7: TanStack Query v5 `placeholderData: keepPreviousData` (imported from `@tanstack/react-query`) keeps the last successful data while a new query key loads and exposes `isPlaceholderData`. `useSearchParams` and `setSearchParams(next, { replace: true })` are from `react-router`.

Backend facts that shape the design:
- `GET /notes` returns `{ items, page, limit, total }`, ordered by `updatedAt` descending, no sort parameter. `GET /tags` returns `{ items }` with `noteCount`, not paginated.
- An unknown or foreign `tagId` returns 404 `NOT_FOUND`. A malformed one returns 400.
- Tag colors are validated `#rrggbb` by the backend.

## Goals / Non-Goals

**Goals**
- The approved list page with exactly the specified behaviour, view state in the URL, and the shapes later tickets reuse (query keys, `api/notes.ts`, tag chip).
- No duplicated types: everything comes from `@todo/shared`.

**Non-Goals**
- Create, edit, delete, restore, open a note, trash, search, sharing, versions, tag management UI, sort or page-size controls, infinite scroll, Playwright (AB-1016). Backend or Prisma changes. New dependencies.

## Decisions

### D1. Module layout (flat, as AB-1010)

```
apps/frontend/src
  api/         notes.ts                listNotes, listTags
  lib/         list-params.ts          parse and build the page/tagId URL state
               tag-color.ts            readable text color for a #rrggbb chip
  queries/     notes.ts                query keys, useNotesList, useTags
  components/notes/  NoteListItem.tsx  TagChip.tsx  TagFilter.tsx  PaginationBar.tsx
  pages/       NotesPage.tsx           replaces HomePage.tsx (git mv; tests move with it)
  routes/      router.tsx              "/" renders NotesPage
```
Alternative: feature folder `features/notes/`. Rejected for the same reason as AB-1010 (one feature, cheap to move later).

### D2. API functions

`listNotes({ page, limit, tagId })` builds the query with `URLSearchParams` in fixed order `page`, `limit`, `tagId` (`tagId` only when set) and calls `request("/notes?...", { auth: "bearer", schema: noteListResponseSchema })`. `listTags()` calls `request("/tags", { auth: "bearer", schema: tagListResponseSchema })`. Types are `NoteListResponse`, `TagListResponse` and `NoteListQuery` from `@todo/shared`. The malformed-response scenario needs no new code: `transport.ts` already throws `ApiError(INTERNAL_ERROR)`, which the page renders as the generic failure alert.

### D3. The URL is the single source of truth

The view is `useSearchParams()` parsed by `parseListParams(params)`:
- `page`: only a string matching `^[1-9]\d*$` counts; anything else is 1.
- `tagId`: validated with `noteListQuerySchema.shape.tagId.safeParse` from `@todo/shared` (no direct Zod import in the frontend); invalid is dropped.

`PAGE_SIZE = 20` is a constant. `buildListParams({ page, tagId })` writes a bare `/` for page 1 without a tag, `?page=2`, `?tagId=...` or `?page=2&tagId=...` (keys in that order). Choosing or clearing a tag always drops `page`.

Alternative: mirror the URL in component state. Rejected: two sources of truth drift, and back/forward and reload would need extra syncing.

### D4. Queries

- Notes: `useQuery({ queryKey: ["notes", "list", { page, tagId }], queryFn: () => listNotes(...), placeholderData: keepPreviousData })`. Previous data stays visible while the next page loads (scenario "Previous page stays visible while loading").
- Tags: `useQuery({ queryKey: ["tags"], queryFn: listTags })`, a separate query, so notes never wait for tags and a tags failure cannot block the list.
- Both keys start with a stable prefix (`["notes"]`, `["tags"]`) so the later create, edit and delete tickets can invalidate them.
- **Retry** buttons call `refetch()`. Retry policy comes from the existing `QueryClient`; tests use `retry: false`.
- A 401 is handled inside `request()` (AB-1010); the page does nothing for it.

### D5. Page beyond the end

An effect in `NotesPage` runs only when `!isPlaceholderData && data && data.items.length === 0 && data.total > 0 && page > 1`. It calls `setSearchParams(buildListParams({ page: lastPage, tagId }), { replace: true })` with `lastPage = ceil(total / limit)`. The `isPlaceholderData` guard stops it acting on stale previous data. The replace changes the key, so the condition is false afterwards and cannot loop. While this happens the page renders the loading status, never "No notes yet".

### D6. Render order in NotesPage

1. Error with `status 404` and a `tagId` in the URL: alert "That tag no longer exists" + **Show all notes** (clears `tagId`).
2. Any other error: `role="alert"` generic message + **Retry**.
3. No data yet (or a redirect pending per D5): `role="status"` "Loading notes".
4. Zero items: "No notes with this tag" if a tag is active, else "No notes yet" (no pagination).
5. Otherwise a `<ul>` of `NoteListItem`s, then `PaginationBar` when `ceil(total/limit) > 1`.

The header (email, **Log out**) and the `TagFilter` group render in every state. The filter stays usable on empty and 404 results so the user can recover. Filter state comes from the URL; the 404 state keeps the filter visible with **All notes** available.

### D7. Tag chips and filter

`TagChip` is a `<span>` with `style={{ backgroundColor: color, color: textColorFor(color) }}`. `textColorFor` returns black or white from relative luminance of the `#rrggbb` value, so any valid color stays readable. `TagFilter` renders `<div role="group" aria-label="Filter by tag">` with **All notes** and one `<button aria-pressed>` per tag showing name and `noteCount`. Its tags error shows `role="alert"` "Couldn't load tags" + **Retry** inside the group.

Alternative: a shadcn `Badge` through `cva`. Rejected: the dynamic color makes a variant useless, one small component is simpler.

### D8. Dates

`<time dateTime={updatedAt}>` with `new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" })` (browser locale, created once at module level). Tests assert the `dateTime` attribute, which is timezone- and locale-independent.

### D9. Pagination bar

`<nav aria-label="Pagination">` with **Previous**, "Page X of Y" and **Next**. X and the limit come from the response (`page`, `limit`, `total`), not from the URL, so the display matches what was fetched. Buttons call `setSearchParams(buildListParams(...))` (push, so Back works) and keep `tagId`. Previous is disabled on page 1, Next on the last page.

### D10. Header and logout

The email and **Log out** move into `NotesPage` with the same mutation as `HomePage` (best-effort `logout`, `onSettled: clearSession`). The AB-1010 "Logout" and "Home shows the signed-in user" scenarios keep their titles and move into `NotesPage.test.tsx`. No `frontend-auth` spec change.

## Test strategy

- One test per scenario, titled exactly as the scenario: 2 in `api/notes.test.ts`, 28 in `pages/NotesPage.test.tsx` (the relocated AB-1010 logout and home tests are existing scenarios, not part of the 30 and keep their titles). Extra unit tests for `parseListParams`/`buildListParams` and `textColorFor` are allowed and are not scenarios.
- `test/fake-api.ts`: `FakeRequest` gains `query: URLSearchParams` so tests assert `page`, `limit` and `tagId`. The route key still ignores the query string.
- `test/fixtures.ts`: `makeNote`, `makeTag`, `notesPage({ items, page, total })`, and `routeEmptyNotes()` (empty `/notes` and `/tags`) for tests that merely open `/` (`App.test.tsx`, `foundation.test.tsx`, logout tests), because the fake throws on unhandled routes.
- Pending-state scenarios hold the response with a deferred promise inside the route handler.
- Checkpoint per phase: `pnpm build`, `pnpm lint --max-warnings 0`, `pnpm test`; final `--coverage` against the existing 80% thresholds.

## Risks / Trade-offs

- **Redirect loop on page past the end:** guarded by `isPlaceholderData` and `replace` (D5). A dedicated scenario covers it.
- **Stale rows during a tag switch:** `keepPreviousData` also keeps the old tag's rows until the new ones arrive. Accepted: brief, and the pressed filter button already reflects the new choice.
- **Existing tests that open `/`** now trigger two requests. Handled with `routeEmptyNotes()`; otherwise the fake raises and the page shows the failure alert.
- **Rows are not links:** a deliberate gap until the editor ticket. Row markup keeps the title in a heading so the link can be added without restructuring.
- **Hex contrast heuristic** is a simple luminance threshold, not full WCAG tuning. Acceptable for a chip label.
- **Locale-formatted dates** differ per user; tests do not depend on the text.

## Migration Plan

Frontend only, no data migration. `HomePage` is replaced by `NotesPage` via `git mv`, so history follows. Rollback is reverting the commits.

## Open Questions

None. Decisions on sort, page size and non-link rows were fixed at spec approval.
