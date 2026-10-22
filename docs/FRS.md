# Functional Requirements Specification (FRS): Note Taking App

| Field                   | Value                                               |
| ----------------------- | --------------------------------------------------- |
| Product                 | Note Taking Application                             |
| Scope                   | Tickets AB-1001 to AB-1019                          |
| Companion               | `SDS.md` (design, data model, API contracts)        |
| Status of this document | Source of truth for `/review` FRS-compliance checks |

Requirement IDs (`FR-<area>-<n>`) are stable. Specs, tests, commits and PR descriptions cite them. Priority uses MoSCoW: **M** must, **S** should.

## 1. Purpose and scope

Authenticated users create, organize, search and share rich-text notes. The system provides standard CRUD, user-scoped tags, PostgreSQL full-text search with keyword highlighting, public read-only share links, and per-note version history.

### 1.1 Out of scope (any attempt is a violation)

| ID    | Excluded                                                        |
| ----- | --------------------------------------------------------------- |
| OOS-1 | Real-time collaborative editing                                 |
| OOS-2 | File or image attachments                                       |
| OOS-3 | Mobile app                                                      |
| OOS-4 | OAuth / social login                                            |
| OOS-5 | Note folders or nesting                                         |
| OOS-6 | Sending real email (OTPs are logged to the server console only) |

### 1.2 Users and roles

| Role    | Description                                                                                         |
| ------- | --------------------------------------------------------------------------------------------------- |
| Visitor | Unauthenticated. May register, log in, reset a password, and open a public share link.              |
| User    | Authenticated. Owns notes, tags, share links and version history. Can only ever see their own data. |

### 1.3 Assumptions and constraints

- Fixed stack: React 19, TypeScript, Vite, TanStack Query, Zustand, TipTap, shadcn/ui; Node 22, Express 5; PostgreSQL 16, Prisma; Vitest, Supertest, Playwright; pnpm workspaces. No substitutions.
- Search uses PostgreSQL full-text search only. No external search service.
- Note content is a TipTap/ProseMirror JSON document.
- All types and Zod schemas live in `packages/shared` only.

## 2. Functional requirements

### 2.1 Authentication (AB-1002, AB-1003)

| ID         | Requirement                                                                                                                                                                                                                                       | Pri |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| FR-AUTH-1  | A visitor can register with an email and a password of 8 to 128 characters. The email is trimmed and lowercased. A duplicate email is rejected.                                                                                                   | M   |
| FR-AUTH-2  | Passwords are stored only as a salted one-way hash. No credential appears in any response or error.                                                                                                                                               | M   |
| FR-AUTH-3  | A user can log in with email and password. Unknown email and wrong password produce the same error.                                                                                                                                               | M   |
| FR-AUTH-4  | Login issues a JWT access token (15 minutes) and an opaque refresh token (7 days). The refresh token is persisted in the database as a hash.                                                                                                      | M   |
| FR-AUTH-5  | A refresh token can be exchanged once for a new token pair (rotation). Reuse of a revoked token revokes all of that user's refresh tokens.                                                                                                        | M   |
| FR-AUTH-6  | A user can log out. Logout revokes the presented refresh token, is idempotent, and cannot revoke another user's token.                                                                                                                            | M   |
| FR-AUTH-7  | Protected endpoints accept only a valid access token. A missing, malformed, tampered or expired token, or a refresh token used as an access token, is rejected.                                                                                   | M   |
| FR-AUTH-8  | A user can request a password reset by email. A 6-digit OTP is generated, stored hashed, valid for a limited time, and logged to the server console. Known and unknown emails get the identical response. A new request invalidates earlier OTPs. | M   |
| FR-AUTH-9  | A user can reset the password with email, OTP and a new password (8 to 128 characters). The OTP is single use, fails when wrong or expired, and locks after 5 failed attempts.                                                                    | M   |
| FR-AUTH-10 | A successful reset revokes all of the user's sessions and leaves no partial state when it fails.                                                                                                                                                  | M   |

### 2.2 Notes (AB-1004, AB-1005)

| ID         | Requirement                                                                                                                                                                                            | Pri |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --- |
| FR-NOTE-1  | A user can create a note with a title (trimmed, 1 to 200 characters) and optional TipTap content. Omitted content defaults to an empty document.                                                       | M   |
| FR-NOTE-2  | The server derives plain text from the content on every create and content change, for excerpts and search.                                                                                            | M   |
| FR-NOTE-3  | A user can read one of their own notes. Another user's note, an unknown note and a deleted note are indistinguishable (not found).                                                                     | M   |
| FR-NOTE-4  | A user can update the title and/or content (at least one field). Updating another user's or a deleted note fails.                                                                                      | M   |
| FR-NOTE-5  | A user can soft delete a note. Soft delete sets `deletedAt` only. A note row is never physically removed inside the 30-day recovery window.                                                            | M   |
| FR-NOTE-6  | A user can list their trash: notes deleted within the last 30 days, newest deletion first.                                                                                                             | M   |
| FR-NOTE-7  | A user can restore a trashed note within 30 days of deletion. Restoring an active note, or one outside the window, fails. Tags are kept.                                                               | M   |
| FR-NOTE-8  | The note list is paginated (`page` >= 1, `limit` 1 to 100, default 20) and returns `total`. Each item has id, title, excerpt (first 200 characters), tags and timestamps.                              | M   |
| FR-NOTE-9  | The note list supports sorting. The default order is most recently updated first. The client can choose the sort field (`updatedAt`, `createdAt`, `title`) and direction. An invalid sort is rejected. | M   |
| FR-NOTE-10 | The note list can be filtered by one tag. The tag must belong to the caller. Deleted notes are excluded.                                                                                               | M   |
| FR-NOTE-11 | Request bodies larger than 1 MB are rejected.                                                                                                                                                          | M   |

### 2.3 Tags (AB-1006)

| ID       | Requirement                                                                                                                                                     | Pri |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| FR-TAG-1 | A user can create a tag with a name (trimmed, 1 to 50 characters, unique per user) and a color (`#RRGGBB`, default `#6b7280`). Two users may use the same name. | M   |
| FR-TAG-2 | A user can list their tags, ordered by name, each with `noteCount` of active (non-deleted) notes.                                                               | M   |
| FR-TAG-3 | A user can rename and/or recolor a tag. Renaming to its own current name succeeds. Renaming to another existing name fails.                                     | M   |
| FR-TAG-4 | A user can delete a tag. It is detached from all notes; no note is changed or deleted.                                                                          | M   |
| FR-TAG-5 | A user can attach and detach a tag on an active note. Both operations are idempotent. Another user's note or tag cannot be used.                                | M   |
| FR-TAG-6 | Note responses embed their tags. Deleting or restoring a note keeps its tags.                                                                                   | M   |

### 2.4 Search (AB-1007)

| ID        | Requirement                                                                                                                                                                  | Pri |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| FR-SRCH-1 | A user can run a full-text search over the title and body of their own active notes. Title matches rank above body matches. Ties fall back to recency.                       | M   |
| FR-SRCH-2 | Search supports stemming, multi-word AND matching, quoted phrases and exclusion. Malformed syntax never errors. A stop-word-only query returns an empty page.                | M   |
| FR-SRCH-3 | Search results are paginated with the same rules as the note list and can be filtered by tag.                                                                                | M   |
| FR-SRCH-4 | `q` is required, trimmed, 1 to 200 characters.                                                                                                                               | M   |
| FR-SRCH-5 | Each result carries a highlighted title and a snippet of up to 2 fragments with matched words wrapped in `<mark>`. Stemmed variants are highlighted; excluded words are not. | M   |
| FR-SRCH-6 | Highlighted output is HTML-safe. The only markup is `<mark>` and `</mark>`. All note text is escaped.                                                                        | M   |
| FR-SRCH-7 | Deleted notes and other users' notes never appear, and edits and restores are reflected.                                                                                     | M   |

### 2.5 Sharing (AB-1008)

| ID         | Requirement                                                                                                                                                                            | Pri |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| FR-SHARE-1 | The owner can generate a public read-only link for an active note, with an optional expiry that must be in the future. A note can have several links with distinct unguessable tokens. | M   |
| FR-SHARE-2 | The owner can list a note's links (active, expired and revoked) with expiry and current view count, newest first.                                                                      | M   |
| FR-SHARE-3 | The owner can revoke a link. Revoking sets `revokedAt` only. Revoking an already revoked link fails.                                                                                   | M   |
| FR-SHARE-4 | Anyone with a valid token can read the note's title, content and `updatedAt` without logging in. Nothing else about the note or owner is exposed.                                      | M   |
| FR-SHARE-5 | A link stops resolving when revoked, expired, or when its note is soft deleted, and resumes after restore. All failures return an identical not-found response.                        | M   |
| FR-SHARE-6 | Each successful view increments the link's view count atomically. Concurrent views are not lost. Failed views and views after revocation are never counted.                            | M   |
| FR-SHARE-7 | The public response must not be cached and must not leak the token through the referrer.                                                                                               | M   |

### 2.6 Version history (AB-1009)

| ID       | Requirement                                                                                                                                                                                                                                         | Pri |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| FR-VER-1 | Every save (create, changed update, restore of a version) records an immutable snapshot with a per-note sequence number starting at 1. Concurrent saves get consecutive numbers. A failed save leaves no version. An unchanged update records none. A burst of autosaves is stored as one version: an autosave updates the newest version in place while that version was itself created by an autosave less than 5 minutes ago; explicit saves, creates and restores always add a version. | M   |
| FR-VER-2 | The owner can list a note's versions, newest first, paginated, as summaries.                                                                                                                                                                        | M   |
| FR-VER-3 | The owner can view any single version in full.                                                                                                                                                                                                      | M   |
| FR-VER-4 | The owner can restore a version. Restore copies that state onto the note and appends a new version; history is never rewritten. Restoring the current state is a no-op. Tags are kept and search text is re-derived.                                | M   |
| FR-VER-5 | History survives trash and restore. A deleted note's versions are not reachable.                                                                                                                                                                    | M   |
| FR-VER-6 | Auto-purge: version snapshots of a note whose 30-day recovery window has passed are permanently removed together with that note by a scheduled job. Nothing is purged inside the window.                                                            | M   |

### 2.7 Frontend (AB-1010 to AB-1015, AB-1019)

| ID       | Requirement                                                                                                                                                                                          | Pri |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| FR-FE-1  | Auth pages: register, login, forgot password, reset password, with inline field errors, a global error alert, and logout.                                                                            | M   |
| FR-FE-2  | Session handling: the access token is attached to API calls; a 401 triggers one refresh and a retry; a failed refresh returns the user to login. Protected routes redirect unauthenticated visitors. | M   |
| FR-FE-3  | Notes list page: paginated list, sort control, tag filter, empty/loading/error states, a Trash link and a New note action.                                                                            | M   |
| FR-FE-4  | Note editor: TipTap rich-text editor with a toolbar, title field, tag picker, delete dialog, and an unsaved-changes guard.                                                                           | M   |
| FR-FE-5  | Autosave: edits are saved automatically after a short idle period and on leaving the editor. The UI shows saving, saved and error states and never drops edits.                                      | M   |
| FR-FE-6  | Search UI: a search box with debounced queries, ranked results with highlighted title and snippet rendered safely, pagination and a tag filter.                                                      | M   |
| FR-FE-7  | Share modal: create a link with optional expiry, copy it, list links with status and view count, and revoke.                                                                                         | M   |
| FR-FE-8  | Version history drawer: list versions, preview one, and restore it as a new version.                                                                                                                 | M   |
| FR-FE-9  | The UI uses shared types and schemas only and never renders unsanitized HTML.                                                                                                                        | M   |
| FR-FE-10 | Change all button colour to red.                                                                                                                                                                     | M   |
| FR-FE-11 | Trash page (`/trash`): lists the user's trashed notes (FR-NOTE-6), newest deletion first and paginated, with empty/loading/error states. Each item has a Restore action (FR-NOTE-7) that returns the note to the notes list with its tags; a restore refused by the server (not deleted, or outside the 30 days) shows an error and refreshes the list. The UI offers no permanent delete and no way to edit or open a trashed note. | M   |

### 2.8 End-to-end (AB-1016)

| ID       | Requirement                                                                                                                                                                                                                                        | Pri |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- |
| FR-E2E-1 | A Playwright suite covers the full journey: register, log in, create a note, edit with autosave, tag, search with highlight, share and open the public link anonymously, revoke, view history and restore, delete and restore from trash, log out. | M   |

## 3. Non-functional requirements

| ID         | Requirement                                                                                                                                                                                                |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NFR-SEC-1  | Every data endpoint except the public share view and auth endpoints requires a valid access token. All queries are scoped to the authenticated user; cross-user access returns not found, never forbidden. |
| NFR-SEC-2  | Secrets (`JWT_SECRET`, at least 32 characters) come from validated environment config. The app refuses to start without them.                                                                              |
| NFR-SEC-3  | Error responses use a single envelope and never leak credentials, tokens, stack traces or whether an account exists.                                                                                       |
| NFR-SEC-4  | User-authored text is never injected into HTML unescaped.                                                                                                                                                  |
| NFR-PERF-1 | Search is index-backed (GIN on a generated `tsvector`). List endpoints are paginated with a hard maximum page size of 100.                                                                                 |
| NFR-REL-1  | Multi-step writes (reset password, version allocation, view count, restore) are atomic.                                                                                                                    |
| NFR-QUAL-1 | Every spec scenario has exactly one named test. Error status codes match `delta-openapi.yaml` exactly.                                                                                                     |
| NFR-QUAL-2 | At least 80% coverage on new code. `pnpm build` has 0 errors and 0 warnings; `pnpm lint --max-warnings 0` is clean; `pnpm test` is green.                                                                  |
| NFR-PROC-1 | Commits follow `feat(scope): description AB#ticket`. Tool versions are pinned; `@latest` is never used.                                                                                                    |

## 4. Traceability

| Ticket  | Area                            | Requirements                      |
| ------- | ------------------------------- | --------------------------------- |
| AB-1001 | Project setup                   | NFR-SEC-2, NFR-QUAL-2, NFR-PROC-1 |
| AB-1002 | Auth core                       | FR-AUTH-1 to 7                    |
| AB-1003 | Password reset                  | FR-AUTH-8 to 10                   |
| AB-1004 | Notes CRUD and soft delete      | FR-NOTE-1 to 7, 11                |
| AB-1005 | Pagination, sorting, tag filter | FR-NOTE-8 to 10                   |
| AB-1006 | Tags                            | FR-TAG-1 to 6                     |
| AB-1007 | Search                          | FR-SRCH-1 to 7                    |
| AB-1008 | Sharing                         | FR-SHARE-1 to 7                   |
| AB-1009 | Version history                 | FR-VER-1 to 6                     |
| AB-1010 | Auth pages                      | FR-FE-1, FR-FE-2                  |
| AB-1011 | Notes list page                 | FR-FE-3                           |
| AB-1012 | Note editor                     | FR-FE-4, FR-FE-5                  |
| AB-1013 | Search UI                       | FR-FE-6                           |
| AB-1014 | Share UI                        | FR-FE-7                           |
| AB-1015 | Version drawer                  | FR-FE-8                           |
| AB-1016 | E2E                             | FR-E2E-1                          |
| AB-1017 | Button UI                       | FR-FE-10                          |
| AB-1018 | Tag creation UI                 | FR-TAG-1, FR-FE-4                 |
| AB-1019 | Trash page and restore UI       | FR-FE-11, FR-NOTE-6, FR-NOTE-7    |

## 5. Acceptance

A ticket is accepted only when every requirement mapped to it in section 4 is covered by an approved spec scenario with a passing named test, `openspec validate` passes, `/review` shows all ✅ in a fresh terminal, and the Definition of Done in the assignment brief is met.
