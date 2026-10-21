# Design

## Context

Frontend only. The backend (AB-1008) and the shared schemas (`shareLinkSchema`, `shareLinkListResponseSchema`, `createShareLinkRequestSchema`, `sharedNoteSchema`, `SHARE_TOKEN_PATTERN`) already exist. Existing patterns to follow: `api/*.ts` on `request()` (`auth: "bearer"` or `"none"`), query hooks with key factories in `queries/*.ts`, the hand-copied `components/ui/dialog.tsx`, `DeleteNoteDialog` as the dialog-with-mutation template, `FormAlert`, and `RichTextEditor` (TipTap StarterKit with `link` and `underline` off). The SDS fixes the cache key `["shares", noteId]` and the route `/shared/:token`. The API sits behind `/api`, so the SPA route `/shared/:token` does not collide with the backend's `/shared/{token}`. See proposal.md for scope.

## Goals / Non-Goals

**Goals:**
- A share dialog that reuses `Dialog`, `Button`, `FormAlert`, `Input`, `Label`.
- A public page that cannot execute or inject server content and cannot inflate view counts by accident.
- One test per spec scenario.

**Non-Goals:**
- No new dependency, no `packages/shared` change, no backend change.
- No generic clipboard or date-picker library; no live status ticking.

## Decisions

**D1. Contract first, no schema changes.** `api/shares.ts` exports `createShareLink(noteId, expiresAt?)`, `listShareLinks(noteId)`, `revokeShareLink(noteId, shareId)` (all `auth: "bearer"`) and `getSharedNote(token)` (`auth: "none"`, `retryOn401: false`). Request bodies go through `createShareLinkRequestSchema.parse`; responses through `shareLinkSchema`, `shareLinkListResponseSchema` and `sharedNoteSchema`. Create sends no body at all when there is no expiry (the server treats a missing body as `{}`). Types come from `@todo/shared`; none are declared in the app.

**D2. Query hooks in `queries/shares.ts`.** `sharesKeys.list(noteId) = ["shares", noteId]` (SDS). `useShareLinks(noteId, enabled)` uses `staleTime: 0` and `refetchOnMount: "always"` so every opening refetches. `useCreateShareLink` and `useRevokeShareLink` invalidate `sharesKeys.list(noteId)` in `onSettled`. Revoke maps a 404 to success inside `mutationFn` (as `useDeleteNote` does). The mutations do not touch the `notes` or `search` keys: sharing does not change a note. The dialog is mounted only while open (as `Dialog` already does), so the query is `enabled` only while open.

**D3. Status is a pure helper.** `lib/share-link.ts` has `linkStatus(link, now = Date.now()): "active" | "expired" | "revoked"` (revoked first, then `expiresAt <= now`, else active) and `shareUrl(token, origin = window.location.origin)`. Status is computed at render and not refreshed on a timer. Alternative: a ticking clock; rejected as noise for a modal that is short-lived.

**D4. Expiry input.** A `datetime-local` input, uncontrolled-empty by default. Conversion: `new Date(value).toISOString()` (the browser interprets the value as local time). A blank value means no expiry. Before sending, the value is checked with `createShareLinkRequestSchema.safeParse({ expiresAt })`; a failure shows "Expiry must be in the future" and no request goes out. An unparsable `Date` is treated as blank-invalid with the same message. A server `details` entry for `expiresAt` is mapped onto the input with the existing `lib/form-errors` helpers. Alternative: a date-picker library; rejected (new dependency, not required by the spec).

**D5. Single in-flight guards.** Create and confirm-revoke use a ref flag plus the mutation's `isPending` (same pattern as `NoteEditor.savingRef`), so two activations before the first response send one request. The revoke confirm is inline state `confirmingId: string | null` in the dialog, so only one row confirms at a time; **Cancel** clears it.

**D6. Component layout under `components/share/`.** `ShareDialog` (owns the list query, create form, announce region, unsaved notice, unavailable state), `ShareLinkRow` (URL, status label, expiry, views, created time, Copy, Revoke and the inline confirm), `CreateShareForm`. `NoteEditor` renders `<ShareDialog open noteId dirty onClose />` and a **Share** button next to **Delete**, both only when `note` exists. The footer groups Share and Delete in a `ml-auto` flex group; existing editor tests query by role and name and stay valid. `dirty` is passed down so the notice can show.

**D7. Copy.** `navigator.clipboard.writeText(url)` inside try/catch; success sets "Copied" in the polite status region, failure sets the manual-copy message. The URL is always rendered as selectable text. `navigator.clipboard` is missing in insecure contexts, which the same catch covers (a thrown `TypeError` is caught). Verify the jsdom stub approach in tests (`Object.defineProperty(navigator, "clipboard", ...)`).

**D8. Accessible names.** Row buttons get `aria-label` of the form `Copy link created <formatted createdAt>` (same for Revoke and Confirm revoke), so names differ per row. Tests match by regex on the prefix. The status region is one `role="status"` element whose text is replaced by the latest outcome ("Link created", "Link revoked", "Copied").

**D9. Public page `pages/SharedNotePage.tsx`.** The route is added to `routes/router.tsx` outside both `RedirectIfAuthed` and `RequireAuth`. The page validates the param with `SHARE_TOKEN_PATTERN.test`; a malformed token renders the not-available view with the query `enabled: false`. The query hook `useSharedNote(token)` sets `retry: false`, `staleTime: Infinity`, `gcTime: 0`, `refetchOnWindowFocus: false`, `refetchOnReconnect: false`, `refetchOnMount: false`. This is the core of "one request per visit": TanStack's defaults (retry 3, refetch on focus) would each add a counted view or hammer a dead link. React StrictMode double-mount reuses the in-flight query, so dev mode still sends one request (verify in the foundation test). **Retry** calls `refetch()`. A 404 or 400 maps to `not-available`; everything else (5xx, network, schema failure, render failure) maps to the retryable error.

**D10. Safe rendering, no HTML.** A new `components/share/ReadOnlyNote.tsx` uses `useEditor({ editable: false, extensions: [StarterKit.configure({ link: false, underline: false })], content })` and `EditorContent`, with `immediatelyRender` as the other editor uses. Because the schema has no `link` mark, link marks are dropped and become plain text (spec: no anchors), and node types outside StarterKit cannot be created. The title is a React text node in an `h1`. Nothing uses `dangerouslySetInnerHTML`. Content the schema rejects is detected with `enableContentCheck: true` and `onContentError` (TipTap 3), which sets a state that switches the page to the retryable error view; a small error boundary around the viewer is the fallback for a throw. **Verify with Context7 the exact TipTap 3.32.0 option names before coding**. Alternative: `generateHTML` then set as HTML; rejected, it is exactly the pattern FR-FE-9 forbids.

**D11. Referrer protection.** The server's `Referrer-Policy: no-referrer` header applies to the API response, not to the SPA document, so the page adds `<meta name="referrer" content="no-referrer">` in an effect and removes it in the cleanup. Alternative: `rel="noreferrer"` on links; rejected, the page has no anchors at all.

**D12. Not-available view is one component.** `SharedNotAvailable` renders only a heading "This link is not available" and fixed text, with no props (so it cannot echo the token or the cause), and the spec test compares the three rendered outputs.

**D13. Fixtures.** `test/fixtures.ts` gains `makeShareLink(overrides)` and `shareList(items)` (valid against the shared schemas) and `makeSharedNote(overrides)`.

## Risks / Trade-offs

- [TipTap in jsdom: `editable: false` and content-check behaviour differ from the browser] → tests assert on rendered DOM (roles, absence of `img`/`a`/`script`) and the unknown-node case is verified first with Context7 and a spike test; if `onContentError` is not available, fall back to the error boundary plus `try { Node.fromJSON }` via `editor.schema`.
- [A viewer reloads or the user opens the link twice and counts two views] → by design; each successful visit is a view (FR-SHARE-6). Only accidental refetches are suppressed.
- [Status shown at render time may be stale in a long-open dialog] → accepted; closing and reopening refetches and recomputes.
- [Clipboard unavailable] → manual-copy message plus selectable URL.
- [Editing `NoteEditor` footer] → existing editor tests must stay green; the change only adds a button and a dialog.
- [Public page leaks token via address bar or history] → inherent to bearer-token links (SDS); mitigated by the referrer meta, no analytics, and no outbound links.

## Open Questions

None that affect specs or tasks.
