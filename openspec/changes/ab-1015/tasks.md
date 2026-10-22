# Tasks

## Conventions

- Shell: prefix PATH for Node 22 / pnpm 10 on every command (`$env:Path = "$env:APPDATA\fnm\node-versions\v22.23.3\installation;" + $env:Path`).
- Tests first: write the failing test, then the code. One test per spec scenario, titled exactly as the scenario (55 scenarios: 51 in `frontend-version-history`, 4 in `frontend-note-editor`). Extra unit tests are labelled "Unit".
- Tests stub `fetch` with `src/test/fake-api.ts`. Paths in the fake exclude the `/api` prefix.
- No new dependency, no `packages/shared` change, no backend change (there are no shared or API tasks; everything is web). Verify TanStack Query v5 (`useInfiniteQuery`, `getNextPageParam`, `isFetchNextPageError`, `gcTime`) and TipTap 3.32.0 with Context7 before use.
- One task, one commit: `feat(frontend): description AB#1015`. Each group ends with a checkpoint.
- Branch: `feature/frontend/AB-1015-version-history` from `main`.

## 1. Fixtures, shared pieces, API and queries (no version UI)

- [x] 1.1 Extend `src/test/fixtures.ts` with `makeVersionSummary(overrides)`, `versionsPage(items, meta)` and `makeVersion(overrides)`, all valid against the shared schemas; verify by parsing each with its shared schema in a Unit test
- [x] 1.2 Move `components/share/ReadOnlyNote.tsx` to `components/ReadOnlyNote.tsx` with `git mv`, add the required `label` prop (used as the document `aria-label`), update `SharedNotePage` to pass "Shared note content"; verify `pnpm --filter @todo/frontend test SharedNotePage` stays green unchanged apart from imports
- [x] 1.3 Unit test then `placement?: "center" | "right"` on `components/ui/dialog.tsx` (default `"center"`; `"right"` anchors the panel to the right edge, full height, scrollable); verify `src/components/ui/dialog.test.tsx` passes with the existing tests untouched

`src/api/versions.test.ts` - Requirement: Versions API functions and cache
- [x] 1.4 Test "List sends page and limit"
- [x] 1.5 Test "Get sends the version number"
- [x] 1.6 Test "Restore sends a post without a body"
- [x] 1.7 Test "Invalid version number sends no request"
- [x] 1.8 Implement `src/api/versions.ts` (`listVersions`, `getVersion`, `restoreVersion`, version number validated with `versionNumberParamSchema`); verify with `pnpm --filter @todo/frontend test api/versions`

`src/queries/versions.test.tsx` - Requirement: Versions API functions and cache
- [x] 1.9 Test "Restore marks the version list stale"
- [x] 1.10 Export `useInvalidateLists` from `src/queries/note.ts`; implement `src/queries/versions.ts` (`versionsKeys`, `useVersionList` as an infinite query with `gcTime: 0`, `staleTime: 0`, `refetchOnMount: "always"`, `refetchOnWindowFocus: false`; `useVersion` with `staleTime: Infinity`; `useRestoreVersion` seeding `noteKeys.detail`, invalidating the version keys and the lists); Unit test that the list does not refetch on window focus; verify with `src/queries/versions.test.tsx`
- [x] 1.11 Checkpoint: `pnpm build` (0 errors), `pnpm lint --max-warnings 0`, `pnpm test`

## 2. Drawer: open, list and load more

`src/components/versions/VersionHistoryDrawer.test.tsx` (rendered with props `open`, `noteId`, `dirty`, `onClose`, `onRestored`) - Requirement: Opening and closing the history drawer
- [x] 2.1 Test "Escape closes the drawer"
- [x] 2.2 Test "Reopening refreshes the version list"

Requirement: Version list
- [x] 2.3 Test "Version list loading state"
- [x] 2.4 Test "Empty history"
- [x] 2.5 Test "Versions are listed in server order"
- [x] 2.6 Test "Row shows summary fields"
- [x] 2.7 Test "Newest version is labelled Current"
- [x] 2.8 Test "Version list request fails"
- [x] 2.9 Test "Retry reloads the version list"
- [x] 2.10 Test "Malformed version list response is an error"
- [x] 2.11 Implement `VersionHistoryDrawer` (`Dialog placement="right"` titled "Version history", **Close**, polite status region) and `VersionList` (loading, empty, rows with version number, title, excerpt, time, "Current" label, error alert with **Retry**); verify tasks 2.1 to 2.10 pass

Requirement: Load more versions
- [x] 2.12 Test "Load more is offered when more versions exist"
- [x] 2.13 Test "Load more appends the next page"
- [x] 2.14 Test "No Load more when everything is loaded"
- [x] 2.15 Test "Load more failure keeps loaded rows"
- [x] 2.16 Test "Double Load more activation sends one request"
- [x] 2.17 Implement **Load more** in `VersionList` (`hasNextPage`, in-flight guard, disabled while fetching, inline "Couldn't load more versions" alert that keeps the rows); verify tasks 2.12 to 2.16 pass
- [x] 2.18 Checkpoint: `pnpm build` (0 errors), `pnpm lint --max-warnings 0`, `pnpm test`

## 3. Drawer: preview, restore, session and accessibility

Requirement: Preview a version
- [x] 3.1 Test "Selecting a version loads it"
- [x] 3.2 Test "Version preview loading state"
- [x] 3.3 Test "Preview renders formatting"
- [x] 3.4 Test "Preview cannot be edited"
- [x] 3.5 Test "HTML-like text in a version stays text"
- [x] 3.6 Test "Unrenderable content shows an error"
- [x] 3.7 Test "Back keeps the loaded list"
- [x] 3.8 Test "Preview request fails"
- [x] 3.9 Test "Version no longer exists"
- [x] 3.10 Implement `VersionPreview` (title, `ReadOnlyNote` labelled "Version content", **Back to versions**, loading, retryable error, 404 state, unrenderable state) and the `selected` state in the drawer body; verify tasks 3.1 to 3.9 pass

Requirement: Restore a version
- [x] 3.11 Test "Older version offers restore"
- [x] 3.12 Test "Current version offers no restore"
- [x] 3.13 Test "Restore asks for confirmation"
- [x] 3.14 Test "Cancel sends nothing"
- [x] 3.15 Test "Confirmed restore sends one request"
- [x] 3.16 Test "Restore warns about unsaved edits"
- [x] 3.17 Test "No warning for a clean editor"
- [x] 3.18 Implement the restore flow in `VersionPreview` (**Restore as new version**, inline confirm with **Confirm restore** and **Cancel**, `dirty` warning, in-flight guard, `onRestored(version)` on success, error alert and 404 state on failure, no Restore on the current version); verify tasks 3.11 to 3.17 pass

Requirement: Authorization and session handling
- [x] 3.19 Test "Expired access token is refreshed while browsing history"
- [x] 3.20 Test "Rejected refresh ends the session while browsing history"
- [x] 3.21 Test "Another user's note history is not available"
- [x] 3.22 Implement the "This note is no longer available" state (404 on the first page hides rows and controls except **Close**); verify tasks 3.19 to 3.21 pass

Requirement: History drawer accessibility
- [x] 3.23 Test "Drawer is labelled and modal"
- [x] 3.24 Test "Row buttons identify their version"
- [x] 3.25 Test "Preview announces loading"
- [x] 3.26 Make 3.23 to 3.25 pass (`aria-label="Preview version N"` on row buttons, loading text inside the `role="status"` region); verify with `pnpm --filter @todo/frontend test VersionHistoryDrawer`
- [x] 3.27 Checkpoint: `pnpm build` (0 errors), `pnpm lint --max-warnings 0`, `pnpm test`

## 4. Editor integration

`src/pages/NoteEditorPage.test.tsx` - Requirement: History entry in the editor
- [x] 4.1 Test "History button on an existing note"
- [x] 4.2 Test "No History button on a new note"
- [x] 4.3 Test "History button appears after the first save"
- [x] 4.4 Test "Opening history leaves the editor untouched"

Requirement: Opening and closing the history drawer
- [x] 4.5 Test "History button opens the drawer"
- [x] 4.6 Test "Close button returns focus to History"

Requirement: Preview a version
- [x] 4.7 Test "Previewing leaves the editor untouched"

Requirement: Restore a version
- [x] 4.8 Test "Restore replaces the editor content"
- [x] 4.9 Test "Restore closes the drawer and announces it"
- [x] 4.10 Test "Unsaved edits are replaced after restore"
- [x] 4.11 Test "Restore refreshes the notes list"
- [x] 4.12 Test "Restore failure keeps everything"
- [x] 4.13 Test "Restore of a missing version"
- [x] 4.14 Implement in `NoteEditor.tsx` the **History** button (existing notes only, between **Share** and **Delete**) and `VersionHistoryDrawer` with `dirty` and `onRestored`; implement in `NoteEditorPage.tsx` the `revision` key, the restored-version state and the polite status line; verify with `pnpm --filter @todo/frontend test NoteEditorPage VersionHistoryDrawer` and that every existing editor test is still green
- [x] 4.15 Checkpoint: `pnpm build` (0 errors), `pnpm lint --max-warnings 0`, `pnpm test --coverage` (new code at least 80%)

## 5. Integration and spec check

- [ ] 5.1 Manual smoke through the Vite proxy with the backend up: edit a note twice and save, open History, check three rows with "Current" on the newest, preview version 1, restore it, confirm the editor shows the old text and History now has four rows; record the outcome in the PR
- [x] 5.2 Verify scenario coverage: every scenario title in the two spec deltas appears as exactly one test title (`pnpm test` passes and the repo-checks conformance test is green)
- [x] 5.3 Update the `["versions", noteId, page]` entry in the `docs/SDS.md` section 6 key list to `["versions", noteId, "list"]` and `["versions", noteId, "detail", n]`, and the status row in section 10; verify with `git diff docs/SDS.md`
- [x] 5.4 Run `pnpm exec openspec validate ab-1015 --strict` and confirm it passes

## Workflow follow-up

- Review in a fresh session with the `reviewer` and `security-auditor` agents, then open the PR with `/create-pr ab-1015`.
- After merge: `/opsx:sync ab-1015` then `/opsx:archive ab-1015`.
- Autosave on back (FR-FE-5) is a separate change; its spec must revisit the Restore-with-unsaved-edits behaviour decided here.
