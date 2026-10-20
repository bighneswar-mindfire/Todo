## Why

The backend can list a user's notes (AB-1004, AB-1005) and their tags, but the frontend `/` page is still a placeholder showing only the signed-in email and a **Log out** button. A user who logs in cannot see any of their notes. This ticket builds the notes list page: the first screen that reads real data through TanStack Query, and the base the editor, search, sharing and version tickets will hang off.

## What Changes

- **Notes list page at `/`** (protected, replaces the placeholder `HomePage`). It keeps the header with the signed-in email and **Log out**, and adds the list below it.
- **List** from `GET /notes`: each row shows the title, the excerpt (omitted when empty), the note's tags as colored chips, and the last-updated time. Order is whatever the API returns (`updatedAt` descending). Rows are not links yet: opening a note belongs to the editor ticket.
- **Pagination**: Previous / Next buttons and "Page X of Y", page size fixed at 20. The controls appear only when there is more than one page. The previous page stays on screen while the next one loads.
- **Tag filter** from `GET /tags`: a row of tag buttons (name and `noteCount`) plus **All notes**. Choosing a tag requests `GET /notes?tagId=...` and resets to page 1. Choosing it again, or **All notes**, clears the filter.
- **URL is the state**: `?page=2&tagId=<uuid>`. Reload, back/forward and copy-paste keep the same view. Malformed values (`page=abc`, `page=0`, `tagId=nope`) fall back to defaults instead of producing an API error.
- **All states are handled**: loading (`role="status"`), empty account ("No notes yet"), empty filter result ("No notes with this tag"), request failure (alert with **Retry**), an unknown tag in the URL (alert with **Show all notes**), and a page past the end (replaced by the last page).
- **Tags that fail to load** do not block the list: the filter area shows its own error with **Retry**, the notes still render.
- **API layer**: `listNotes` and `listTags` functions next to `api/auth.ts`, validated with `noteListResponseSchema` and `tagListResponseSchema` from `@todo/shared`. No type or schema is redefined in the frontend. `QueryClient` and the 401 refresh flow from AB-1010 are reused unchanged.
- **UI primitives**: shadcn `badge`-style chip and a small pagination bar, hand-copied as in AB-1010. No new runtime dependency is expected.

Decisions fixed for this ticket:
- No sort control. The backend orders by `updatedAt` descending only and has no sort parameter; adding one would be a backend change.
- No page-size selector (fixed 20).
- One tag filter at a time (the API accepts a single `tagId`).
- Dates are shown with `Intl.DateTimeFormat` in the browser locale, with the ISO value in `<time dateTime>`.
- Accessibility baseline: the list is a `<ul>`, filter buttons expose `aria-pressed`, loading is `role="status"`, errors are `role="alert"`, pagination sits in a labelled `<nav>`.

## Capabilities

### New Capabilities
- `frontend-notes-list`: the notes list page: list rows, pagination, tag filter, URL-driven state and the loading, empty and error states.

### Modified Capabilities
None. The AB-1010 `frontend-auth` requirements ("Logout" and "Home shows the signed-in user") still hold: `/` keeps the email and **Log out**. No backend capability changes.

## Impact

- `apps/frontend`: new `src/api/notes.ts` (`listNotes`, `listTags`), a notes page replacing `src/pages/HomePage.tsx` (its tests move with it), query hooks, a tag chip and a pagination bar component, route wiring unchanged (`/` stays the protected route). `src/test/fake-api.ts` fixtures gain note and tag builders.
- `packages/shared`: no change expected.
- Backend, Prisma, migrations: no change.
- `delta-openapi.yaml`: declares **no new or changed endpoints** (`paths` empty). It documents `GET /notes` and `GET /tags` under `x-frontend-consumes`, including how the UI reacts to each status code, so tests trace back to the API contract (same approach as AB-1010).
- Out of scope: creating, editing, deleting or restoring notes, opening a single note, trash view, search (AB-1013), sharing, version history, tag create/edit/delete UI, sort and page-size controls, infinite scroll, Playwright E2E (AB-1016).
