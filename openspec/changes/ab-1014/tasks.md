## Conventions

- Shell: prefix PATH for Node 22 / pnpm 10 on every command (`$env:Path = "$env:APPDATA\fnm\node-versions\v22.23.3\installation;" + $env:Path`).
- Tests first: write the failing test, then the code. One test per spec scenario, titled exactly as the scenario (87 scenarios: 56 in `frontend-sharing`, 27 in `frontend-shared-view`, 4 in `frontend-note-editor`). Extra unit tests are labelled "Unit".
- Tests stub `fetch` with `src/test/fake-api.ts`. Paths in the fake exclude the `/api` prefix.
- No new dependency, no `packages/shared` change, no backend change (there are no shared or API tasks; everything is web). Verify TipTap 3.32.0 (`editable`, `enableContentCheck`, `onContentError`), React Router and TanStack Query APIs with Context7 before use.
- One task, one commit: `feat(frontend): description AB#1014`. Each group ends with a checkpoint.
- Branch: `feature/frontend/AB-1014-share-ui` from `main`.

## 1. Fixtures, helpers, API and queries (no UI)

- [x] 1.1 Extend `src/test/fixtures.ts` with `makeShareLink(overrides)`, `shareList(items)` and `makeSharedNote(overrides)`, all valid against the shared schemas; verify by parsing each with its shared schema in a Unit test
- [x] 1.2 Unit tests then `src/lib/share-link.ts` `linkStatus` (revoked first, then expired, else active; boundary `expiresAt === now` is expired) and `shareUrl`; verify with `src/lib/share-link.test.ts`

`src/api/shares.test.ts` - Requirement: Sharing API functions and cache
- [x] 1.3 Test "Create sends no body without expiry"
- [x] 1.4 Test "Create sends the expiry"
- [x] 1.5 Test "List returns validated links"
- [x] 1.6 Test "Revoke sends delete"
- [x] 1.7 Test "Public note function sends no credentials"
- [x] 1.8 Implement `src/api/shares.ts` (`createShareLink`, `listShareLinks`, `revokeShareLink`, `getSharedNote`); verify with `pnpm --filter @todo/frontend test api/shares`

`src/queries/shares.test.tsx` - Requirement: Sharing API functions and cache
- [x] 1.9 Test "Create refreshes the share list"
- [x] 1.10 Test "Revoke refreshes the share list"
- [x] 1.11 Implement `src/queries/shares.ts` (`sharesKeys`, `useShareLinks`, `useCreateShareLink`, `useRevokeShareLink` with 404 as success, `useSharedNote` with the one-request options); Unit test that `useSharedNote` does not retry or refetch on focus; verify with `src/queries/shares.test.tsx`
- [x] 1.12 Checkpoint: `pnpm build` (0 errors), `pnpm lint --max-warnings 0`, `pnpm test`

## 2. Public shared page

`src/pages/SharedNotePage.test.tsx` - Requirement: Public route
- [x] 2.1 Test "Visitor opens the page without logging in"
- [x] 2.2 Test "Logged-in user is not redirected"
- [x] 2.3 Test "No credentials are sent"

Requirement: Shared note display
- [x] 2.4 Test "Title and content are shown"
- [x] 2.5 Test "Formatting is rendered"
- [x] 2.6 Test "Last updated time is shown"
- [x] 2.7 Test "Content cannot be edited"
- [x] 2.8 Test "Nothing else about the note or owner is shown"
- [x] 2.9 Test "Page has a main landmark"

Requirement: Safe rendering
- [x] 2.10 Test "HTML-like text stays text"
- [x] 2.11 Test "Script-like title stays text"
- [x] 2.12 Test "Links in content are not clickable"
- [x] 2.13 Test "Unrenderable content shows the error view"

Requirement: Dead links look the same
- [x] 2.14 Test "Unknown, revoked and expired links look identical"
- [x] 2.15 Test "Malformed token sends no request"
- [x] 2.16 Test "Validation error is the same view"
- [x] 2.17 Test "Not-available view hides the token"

Requirement: Loading and retryable errors
- [x] 2.18 Test "Shared note loading state"
- [x] 2.19 Test "Server error is retryable"
- [x] 2.20 Test "Network error is retryable"
- [x] 2.21 Test "Malformed body is retryable"
- [x] 2.22 Test "Retry loads the note"

Requirement: One request per visit
- [x] 2.23 Test "One visit sends one request"
- [x] 2.24 Test "Window focus does not refetch"
- [x] 2.25 Test "Failures are not retried automatically"

Requirement: Referrer protection
- [x] 2.26 Test "Referrer policy is set while open"
- [x] 2.27 Test "Referrer policy is removed on leaving"

- [x] 2.28 Implement `components/share/ReadOnlyNote.tsx` (non-editable TipTap, StarterKit without `link` and `underline`, content check, error boundary fallback), `components/share/SharedNotAvailable.tsx` (no props), `pages/SharedNotePage.tsx` (token check, `main` landmark, `h1`, Last updated, referrer meta effect) and the public `/shared/:token` route outside both guards in `routes/router.tsx`; verify with `pnpm --filter @todo/frontend test SharedNotePage`
- [x] 2.29 Checkpoint: `pnpm build` (0 errors), `pnpm lint --max-warnings 0`, `pnpm test`

## 3. Share dialog

`src/components/share/ShareDialog.test.tsx` (rendered with props `open`, `noteId`, `dirty`, `onClose`) - Requirement: Share link list
- [x] 3.1 Test "Share list loading state"
- [x] 3.2 Test "Empty list"
- [x] 3.3 Test "Links are listed in server order"
- [x] 3.4 Test "Row shows the full URL"
- [x] 3.5 Test "Row shows view count"
- [x] 3.6 Test "Never-expiring link"
- [x] 3.7 Test "Link with an expiry"
- [x] 3.8 Test "List request fails"
- [x] 3.9 Test "Retry reloads the list"
- [x] 3.10 Test "Malformed list response is an error"

Requirement: Link status
- [x] 3.11 Test "Active link without expiry"
- [x] 3.12 Test "Active link with a future expiry"
- [x] 3.13 Test "Expired link"
- [x] 3.14 Test "Revoked link"
- [x] 3.15 Test "Revoked wins over expired"
- [x] 3.16 Implement `ShareDialog` shell, list states, `ShareLinkRow` (URL, status label, expiry, views, created time) and the polite status region; verify tasks 3.1 to 3.15 pass

Requirement: Create a share link
- [x] 3.17 Test "Create without expiry"
- [x] 3.18 Test "Create with expiry"
- [x] 3.19 Test "Past expiry is rejected in the browser"
- [x] 3.20 Test "Server validation error is shown on the input"
- [x] 3.21 Test "Successful create is announced"
- [x] 3.22 Test "Input is cleared after success"
- [x] 3.23 Test "Several links can be created"
- [x] 3.24 Test "Double activation sends one request"
- [x] 3.25 Test "Create failure keeps the input"
- [x] 3.26 Test "Note gone while creating"
- [x] 3.27 Implement `CreateShareForm` (local-time to ISO UTC, shared-schema check, in-flight guard, server detail mapping); verify tasks 3.17 to 3.26 pass

Requirement: Copy a share link
- [x] 3.28 Test "Copy writes the URL"
- [x] 3.29 Test "Clipboard failure is reported"
- [x] 3.30 Test "No Copy on expired links"
- [x] 3.31 Test "No Copy on revoked links"
- [x] 3.32 Implement the **Copy** button (clipboard write in try/catch, "Copied" announcement, manual-copy message); verify tasks 3.28 to 3.31 pass

Requirement: Revoke a share link
- [x] 3.33 Test "Revoke asks for confirmation"
- [x] 3.34 Test "Cancel keeps the link active"
- [x] 3.35 Test "Confirmed revoke marks the row revoked"
- [x] 3.36 Test "Only active rows offer revoke"
- [x] 3.37 Test "Revoke of an already revoked link counts as success"
- [x] 3.38 Test "Revoke failure keeps the link active"
- [x] 3.39 Test "Double confirm sends one request"
- [x] 3.40 Implement the inline revoke confirm (`confirmingId`, in-flight guard, 404 as success); verify tasks 3.33 to 3.39 pass

Requirement: Authorization and session handling
- [x] 3.41 Test "Expired access token is refreshed"
- [x] 3.42 Test "Rejected refresh ends the session while sharing"
- [x] 3.43 Test "Another user's note is not available"
- [x] 3.44 Implement the "This note is no longer available" state (404 on list or create hides all controls); verify tasks 3.41 to 3.43 pass

Requirement: Share dialog accessibility
- [x] 3.45 Test "Dialog is labelled and modal"
- [x] 3.46 Test "Row buttons identify their link"
- [x] 3.47 Test "Expiry input has a label"
- [x] 3.48 Make 3.45 to 3.47 pass (per-row `aria-label`s with the creation time, input label); verify with `pnpm --filter @todo/frontend test ShareDialog`
- [x] 3.49 Checkpoint: `pnpm build` (0 errors), `pnpm lint --max-warnings 0`, `pnpm test`

## 4. Editor integration

`src/pages/NoteEditorPage.test.tsx` - Requirement: Share entry in the editor
- [x] 4.1 Test "Share button on an existing note"
- [x] 4.2 Test "No Share button on a new note"
- [x] 4.3 Test "Share button appears after the first save"
- [x] 4.4 Test "Opening share leaves the editor untouched"

Requirement: Opening and closing the share dialog
- [x] 4.5 Test "Share button opens the dialog"
- [x] 4.6 Test "Escape closes the dialog"
- [x] 4.7 Test "Close button returns focus"
- [x] 4.8 Test "Reopening refreshes the list"

Requirement: Unsaved-edits notice
- [x] 4.9 Test "Notice shown with unsaved changes"
- [x] 4.10 Test "No notice for a clean editor"
- [x] 4.11 Test "Sharing does not save or block"
- [x] 4.12 Implement in `NoteEditor.tsx`: the **Share** and **Delete** footer group (existing notes only), `ShareDialog` with `dirty` and the **Close** button; the unsaved notice in `ShareDialog`; verify with `pnpm --filter @todo/frontend test NoteEditorPage ShareDialog`
- [x] 4.13 Checkpoint: `pnpm build` (0 errors), `pnpm lint --max-warnings 0`, `pnpm test --coverage` (new code at least 80%)

## 5. Integration and spec check

- [ ] 5.1 Manual smoke through the Vite proxy with the backend up: create a link, open `/shared/<token>` in a private window, check the view count in the dialog after reopening, revoke, and confirm the link now shows the not-available view; record the outcome in the PR
- [ ] 5.2 Verify scenario coverage: every scenario title in the three spec deltas appears as exactly one test title (`pnpm test` passes and the repo-checks conformance test is green)
- [ ] 5.3 Run `pnpm exec openspec validate ab-1014 --strict` and confirm it passes

## Workflow follow-up

- Review in a fresh session with the `reviewer` and `security-auditor` agents, then open the PR with `/create-pr ab-1014`.
- After merge: `/opsx:sync ab-1014` then `/opsx:archive ab-1014`.
