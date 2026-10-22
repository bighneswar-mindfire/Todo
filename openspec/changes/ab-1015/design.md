# Design

## Context

Frontend only. The backend (AB-1009) and the shared schemas (`noteVersionSummarySchema`, `noteVersionListResponseSchema`, `noteVersionSchema`, `versionNumberParamSchema`) already exist. Patterns to follow are the ones AB-1014 set: `api/*.ts` on `request()`, key factories and hooks in `queries/*.ts`, the hand-copied `components/ui/dialog.tsx`, `ShareDialog` as the modal-with-list-and-mutation template, `FormAlert`, and `ReadOnlyNote` for safe rendering. `NoteEditor` is keyed by note id in `NoteEditorPage`, captures its baseline from TipTap at mount, and guards navigation with `useBlocker`. See proposal.md for scope.

## Goals / Non-Goals

**Goals:**
- A drawer that reuses `Dialog`, `Button`, `FormAlert`, `Alert` and `ReadOnlyNote`.
- A restore that leaves the editor showing the restored note with a clean baseline, never a stale buffer that a later Save would revert.
- One test per spec scenario.

**Non-Goals:**
- No new dependency, no `packages/shared` change, no backend change.
- No autosave, no diff view, no virtualised list.

## Decisions

**D1. Contract first, no schema changes.** `api/versions.ts` exports `listVersions(noteId, page, limit)`, `getVersion(noteId, versionNumber)` and `restoreVersion(noteId, versionNumber)`, all `auth: "bearer"`. `getVersion` and `restoreVersion` run `versionNumberParamSchema.parse({ id: noteId, versionNumber })` first, so `0` or `1.5` rejects before any request (the spec's validation scenario). Responses go through `noteVersionListResponseSchema`, `noteVersionSchema` and `noteSchema`. Restore sends no body. Types come from `@todo/shared`; none are declared in the app.

**D2. List is an infinite query.** `versionsKeys.all(noteId) = ["versions", noteId]`, `list(noteId) = [..., "list"]`, `detail(noteId, n) = [..., "detail", n]`. `useVersionList(noteId)` uses `useInfiniteQuery` with `initialPageParam: 1`, `getNextPageParam` returning `lastPage.page + 1` while the loaded item count is below `total`, and `limit` fixed at 20. "Load more" needs one growing list, so this differs from the SDS key `["versions", noteId, page]`; the SDS table gets a one-line update when the change is synced. Alternative: one query per page keyed by page and concatenated in the component; rejected, it recreates what the infinite query already does and leaves the per-page staleness to hand code.

**D3. No stale pages, no surprise refetches.** The list query sets `staleTime: 0`, `gcTime: 0`, `refetchOnMount: "always"` and `refetchOnWindowFocus: false`. `gcTime: 0` drops the cached pages when the drawer closes (the body is mounted only while open), so every opening requests page 1 only; without it a reopened infinite query would refetch every page loaded earlier, one after another. Window focus is disabled so a user reading page 3 does not trigger a re-download of all three pages. Because the query stays mounted while a preview is shown (selected version is local state, not a route), **Back to versions** shows the loaded rows without a request. Versions are immutable, so `useVersion(noteId, n)` uses `staleTime: Infinity` and the default `gcTime`, and the retry button calls `refetch()`.

**D4. Restore mutation seeds and invalidates.** `useRestoreVersion(noteId)` calls `restoreVersion` and on success seeds `noteKeys.detail(noteId)` with the returned note, invalidates `versionsKeys.all(noteId)` and refreshes lists, tag counts and search exactly as `useSaveNote` does. The `useInvalidateLists` helper in `queries/note.ts` is exported for this. A restore 404 is NOT treated as success (unlike delete and revoke): the user did not get what they asked for, so the drawer says "This version is no longer available".

**D5. The editor remounts after a restore.** `NoteEditor` fixes its baseline at mount and holds the title in local state, so changing the note under it would leave a stale buffer. `NoteEditorPage` keeps `revision` and the last restored version number, renders `<NoteEditor key={`${id}:${revision}`} ... onRestored={(n) => { setRevision((r) => r + 1); setRestored({ id, version: n }); }} />`, and shows the announcement in its own `role="status"` element while `restored.id === id`. The remount is not a navigation, so `useBlocker` does not fire and a dirty buffer is dropped cleanly: the new instance captures a fresh baseline from TipTap, so **Save** is disabled and no discard prompt appears. Keying on `note.updatedAt` instead was rejected: a normal Save also changes `updatedAt` and would remount (and lose the cursor) after every save. A prop-driven reset inside `NoteEditor` was rejected as a larger rewrite of D1/D2 of AB-1012.

**D6. Dialog gets a placement.** `Dialog` gains `placement?: "center" | "right"` (default `"center"`, so every current caller is unchanged). `"right"` aligns the panel to the right edge at full height with `max-w-xl`, no rounding, and `overflow-y-auto`. Focus trap, Escape, focus restore and the portal are inherited. Alternative: a second `Drawer` component; rejected, it would duplicate roughly 60 lines of focus handling.

**D7. `ReadOnlyNote` moves and takes a label.** `components/share/ReadOnlyNote.tsx` moves to `components/ReadOnlyNote.tsx` (`git mv`) and gains a required `label` prop used as the `aria-label` of the document (AB-1014 passed "Shared note content" implicitly). `SharedNotePage` passes that same label, so its tests are untouched apart from the import path. The preview passes "Version content". Stored content is run through `stripUnsupportedMarks` as before, so a `link` mark in an old version shows as text. Alternative: import across feature folders from `share/`; rejected, the component is no longer share-specific.

**D8. Components under `components/versions/`.** `VersionHistoryDrawer` (props `open`, `noteId`, `dirty`, `onClose`, `onRestored(version)`; renders `Dialog placement="right"`), `VersionList` (rows, loading, empty, error, Load more), `VersionPreview` (title, `ReadOnlyNote`, restore confirm). Local state in the body: `selected: number | null`, `confirming: boolean`, `missing: boolean`, `error: string | null`, plus the announcement. The current version is `pages[0].items[0].versionNumber` (the list is newest first and the first page always holds the newest). `NoteEditor` renders a **History** button between **Share** and **Delete**, only when `note` exists, with `dirty` passed down so the restore confirm can warn.

**D9. Single in-flight guards.** Load more and confirm restore use a ref flag plus the pending state (same pattern as `NoteEditor.savingRef` and `ShareDialogBody.revokingRef`), so two activations before the first response send one request. **Load more** is also disabled while `isFetchingNextPage`.

**D10. Error mapping.** First-page failure (no data): alert with **Retry**. Next-page failure (data present, `isFetchNextPageError`): rows stay and an inline alert "Couldn't load more versions" appears beside **Load more**, which retries. List 404 on the first page: "This note is no longer available" and no controls except **Close**. Preview 404: "This version is no longer available" with **Back to versions**. Any other preview failure: alert with **Retry**. Restore failure: `FormAlert` with the API message or the generic one; the preview and confirm stay. The unrenderable-content case is reported by `ReadOnlyNote.onUnrenderable` and replaces the content with "This version can't be displayed", hiding Restore too (the user cannot see what they would restore).

**D11. Accessible names and announcements.** Row buttons use `aria-label="Preview version N"`. The drawer has one polite `role="status"` element for loading text and outcomes; loading texts ("Loading versions", "Loading version") are rendered inside it. The restore announcement lives on the page (D5) because the drawer is gone by then.

**D12. Dates and fixtures.** Row and preview times use `formatDateTime` from `lib/share-link.ts` (already a generic formatter; no move, to keep the diff small). `test/fixtures.ts` gains `makeVersionSummary(overrides)`, `versionsPage(items, meta)` and `makeVersion(overrides)`, valid against the shared schemas.

## Risks / Trade-offs

- [Restore replaces unsaved edits] → by design and warned in the confirm; the user can cancel. The edits are not recoverable. Accepted, the same trade-off as the discard dialog.
- [Infinite query behaviour with `gcTime: 0` in tests and StrictMode] → verified first with Context7 for TanStack Query v5 (`useInfiniteQuery`, `isFetchNextPageError`, `getNextPageParam`) and a spike test; if a reopened drawer still refetches old pages, fall back to `queryClient.removeQueries` on close.
- [The "Current" label assumes page 1 holds the newest version] → true while the list is newest first; a save in another tab only becomes visible on reopening, which refetches.
- [Remount after restore flickers the editor] → one render; the restored note is already in the cache so there is no loading state.
- [Moving `ReadOnlyNote` touches AB-1014 code] → import-path and label changes only; its existing tests must stay green.
- [`Dialog` change touches a shared primitive] → default placement is unchanged and `dialog.test.tsx` stays green.
- [Autosave later may save edits before a restore] → noted in the proposal; the restore confirm text stays correct because it keys on the editor's dirty state at that moment.

## Open Questions

None that affect specs or tasks.
