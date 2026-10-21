# Proposal

## Why

Ticket AB-1014 implements FR-FE-7 (share modal) and, through the public link it hands out, FR-FE-9 (never render unsanitized HTML) from `docs/FRS.md` section 2.7. The backend (AB-1008) already creates, lists and revokes share links and serves `GET /shared/{token}`, but the app has no UI for any of it: an owner cannot share a note, and a visitor who is given a link has no page to open.

## What Changes

- **Share button in the note editor** (existing notes only) that opens a **share dialog**. It is hidden on `/notes/new`.
- **Share dialog** (FR-FE-7):
  - Create a link, with an optional expiry chosen in a `datetime-local` input and sent as an ISO UTC instant. A past expiry is rejected in the browser with the shared `createShareLinkRequestSchema` and no request is sent.
  - Copy the full link `<origin>/shared/<token>` to the clipboard.
  - List every link, newest first, with a status label (Active, Expired, Revoked), its expiry, its view count and its creation time.
  - Revoke an active link after an inline "Revoke this link?" confirm.
  - A hint when the editor has unsaved changes: the public view shows the saved note. Sharing never saves, navigates or blocks.
- **Public read-only page `/shared/:token`**, reachable without logging in (and also when logged in). It shows the title, the formatted content and the "last updated" time, and nothing else. Content is rendered through the TipTap schema in non-editable mode, never as HTML. Every failure (unknown, revoked, expired, deleted note, malformed token) shows one identical "not available" view, matching the backend's uniform 404. The page sends no credentials, makes one request per visit (so a view is counted once) and asks the browser not to send a `Referer` while it is open.
- **Sharing API functions and query hooks** on the existing `request()` client, validated with the shared schemas, using the SDS key `["shares", noteId]`.
- **Out of scope**: backend, database, `packages/shared` and dependency changes; editing a link's expiry; deleting a link row; revoking an already expired link; QR codes or social sharing; showing share status in the notes list; a visitor view of tags or owner; search engine controls (`noindex`); the version drawer (AB-1015); the Playwright journey (AB-1016); button colour (AB-1017).

Decisions fixed with the user: the public `/shared/:token` page is in scope; the copied URL is the SPA URL; the Share button lives in the editor footer only; native `datetime-local` for expiry; unsaved edits show a hint, not a block; inline revoke confirm; a 404 on revoke counts as success.

Assumptions recorded: the status of a link is computed in the browser from `expiresAt` and `revokedAt` when the list is rendered (revoked wins over expired) and is not refreshed while the dialog is open; Revoke is offered on Active links only; Copy is offered on Active links only; the list is refetched every time the dialog opens; the datetime input is interpreted in the browser's local time zone.

Rollback: remove the Share button, the dialog and the `/shared/:token` route. No data or API is touched, and links already created keep working through the API.

## Capabilities

### New Capabilities
- `frontend-sharing`: the share dialog (open and close, link list, link status, create with optional expiry, copy, revoke, unsaved-edits hint), session handling for the management calls, the sharing API functions and the query cache refresh.
- `frontend-shared-view`: the public `/shared/:token` page (access without login, read-only rendering, safe rendering, one uniform not-available view, retryable errors, single request per visit, referrer protection).

### Modified Capabilities
- `frontend-note-editor`: adds the Share button to the editor (ADDED requirement; existing requirements are unchanged).

## Impact

- Frontend only: `apps/frontend/src` (`api/shares.ts`, `queries/shares.ts`, `lib/share-link.ts`, `components/share/*`, `components/editor/NoteEditor.tsx`, `pages/SharedNotePage.tsx`, `routes/router.tsx`, `test/fixtures.ts`).
- `packages/shared`: no new schemas; `shareLinkSchema`, `shareLinkListResponseSchema`, `createShareLinkRequestSchema` and `sharedNoteSchema` already exist.
- No new dependency (TipTap is already installed). No API, database or backend change; `delta-openapi.yaml` has empty `paths`.
- Links: ticket AB-1014, FRS FR-FE-7, FR-FE-9, FR-SHARE-1 to 7, SDS sections 4.4 (share endpoints) and 6 (frontend).
