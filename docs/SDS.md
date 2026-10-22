# Software Design Specification (SDS): Note Taking App

| Field | Value |
| --- | --- |
| Companion | `FRS.md` (requirements, IDs cited below) |
| Normative API source | Each ticket's `delta-openapi.yaml`; this document is the consolidated view. On conflict the approved delta wins. |

## 1. Architecture

```
Browser (React 19 SPA)                       Express 5 API (Node 22)                PostgreSQL 16
 TanStack Query (server state)  --HTTPS-->  routes -> zod parse (shared)  -->  Prisma 7 + adapter-pg
 Zustand (auth/session, UI)     /api proxy   -> service -> Prisma / $queryRaw      tsvector + GIN
 TipTap editor, shadcn/ui                    error-handler middleware
```

- Three layers per backend module: **routes** (HTTP, Zod parse, status codes), **service** (business rules, transactions), **Prisma** (persistence). Routes never touch Prisma directly.
- The frontend never talks to the database. It calls the API through a typed client in `src/api` that validates responses with the shared schemas.
- Vite dev server proxies `/api` to the backend, so the browser uses a single origin and CORS is not needed.

### 1.1 Monorepo

| Package | Contents |
| --- | --- |
| `apps/backend` | Express app, modules `auth`, `notes`, `tags`, `search`, `sharing`, `versions`, `middleware`, `http`, Prisma schema and migrations (`prisma7.config.ts`) |
| `apps/frontend` | `pages`, `components` (incl. `editor`, `notes`, `ui`), `api`, `queries`, `stores`, `routes`, `lib` |
| `packages/shared` | **All** TypeScript types and Zod schemas (FR rule 11): `auth`, `notes`, `tags`, `search`, `sharing`, `versions`, `env` |
| `packages/repo-checks` | Repository conformance checks run in tests |

Dependency rule: `apps/*` depend on `packages/shared`; `packages/shared` depends on nothing internal; the apps never import each other.

### 1.2 Runtime configuration

Validated once by `parseEnv` (shared): `NODE_ENV`, `PORT` (default 3000), `DATABASE_URL`, `JWT_SECRET` (>= 32 chars). Startup fails if invalid (NFR-SEC-2). Postgres 16 runs from `docker-compose.yml`.

## 2. Data model (Prisma, PostgreSQL 16)

```
User 1─* RefreshToken        User 1─* PasswordResetOtp
User 1─* Note  *─* Tag (via NoteTag)      User 1─* Tag
Note 1─* ShareLink            Note 1─* NoteVersion
```

| Model | Key fields | Constraints / indexes |
| --- | --- | --- |
| User | `id` uuid, `email`, `passwordHash`, timestamps | `email` unique |
| RefreshToken | `userId`, `tokenHash`, `expiresAt`, `revokedAt?` | `tokenHash` unique; index `userId`; cascade on user |
| PasswordResetOtp | `userId`, `otpHash`, `attempts` (0), `expiresAt`, `usedAt?` | index `userId`; cascade |
| Note | `userId`, `title`, `content` Json, `contentText`, `searchVector` tsvector (generated), `deletedAt?`, timestamps | index `(userId, deletedAt, updatedAt)`; **GIN** on `searchVector` |
| Tag | `userId`, `name`, `color` (`#6b7280`) | unique `(userId, name)`; cascade |
| NoteTag | `noteId`, `tagId` | PK `(noteId, tagId)`; index `tagId`; cascade both sides |
| ShareLink | `noteId`, `token`, `expiresAt?`, `revokedAt?`, `viewCount` (0) | `token` unique; index `noteId`; cascade |
| NoteVersion | `noteId`, `versionNumber`, `title`, `content`, `contentText`, `coalescible` | unique `(noteId, versionNumber)`; cascade. `coalescible` is true only for versions created by an autosave, which a later autosave may update in place (5 minute window) |

Design decisions:

- **Soft delete** (FR-NOTE-5): `Note.deletedAt` is the only effect of delete. All active-note queries filter `deletedAt IS NULL`. Cascade deletes exist for referential cleanup only and are triggered solely by the purge job (section 7.6) or account removal, never by user delete.
- **`searchVector`** is a generated column defined in migration SQL: `setweight(to_tsvector('english', title), 'A') || setweight(to_tsvector('english', contentText), 'B')`. Prisma sees it as `Unsupported`, so reads and writes of it use `$queryRaw`.
- **`contentText`** is derived server-side from the TipTap JSON by walking text nodes (FR-NOTE-2). It is the single source for excerpts, search and highlighting.
- **Secrets at rest**: passwords (hash), refresh tokens (hash), OTPs (HMAC keyed from `JWT_SECRET`, hashed). Share tokens are stored in plaintext because the owner must see them again; they are bearer secrets.

## 3. Cross-cutting design

### 3.1 Error envelope (NFR-SEC-3)

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "…", "details": [{ "field": "email", "message": "…" }] } }
```

`details` appears only for `VALIDATION_ERROR`, one entry per invalid field (`body` when the whole payload is bad).

| Code | HTTP | Meaning |
| --- | --- | --- |
| `VALIDATION_ERROR` | 400 | Zod failure, unparseable/unsupported body, body > 1 MB, malformed id |
| `INVALID_OTP` | 400 | Unknown email, wrong, expired, used, superseded or locked OTP (one shared message) |
| `UNAUTHORIZED` | 401 | Missing, malformed, tampered or expired access token |
| `INVALID_CREDENTIALS` | 401 | Unknown email or wrong password (identical) |
| `INVALID_REFRESH_TOKEN` | 401 | Unknown, expired or revoked refresh token |
| `NOT_FOUND` | 404 | Missing, foreign (other user's), deleted, expired or revoked resource. Never 403. |
| `EMAIL_TAKEN` | 409 | Email already registered |
| `TAG_NAME_TAKEN` | 409 | Tag name already used by the caller |
| `INTERNAL_ERROR` | 500 | Unexpected failure; no internals leaked |

A single `error-handler` middleware maps typed errors to this envelope. Clients add the local-only `NETWORK_ERROR`.

### 3.2 Validation

Every route parses `params`, `query` and `body` with a schema from `packages/shared` through `http/parse.ts`; a missing body parses as `{}`. Schemas are strict where a stray field would be a bug. The frontend reuses the same schemas for forms and response validation.

### 3.3 Authentication and authorization

- `authenticate` middleware verifies an HS256 access JWT (`sub` = user id, 15 minute expiry) and rejects refresh tokens used as access tokens (FR-AUTH-7). It sets `req.userId`.
- **Ownership by query, not by check**: every note, tag and share query includes `userId` (or `note: { userId }`) in its `where`. A miss is `NOT_FOUND`, which makes foreign and absent resources indistinguishable (FR-NOTE-3).

### 3.4 Pagination

`page` (>= 1, default 1) and `limit` (1 to 100, default 20), response `{ items, page, limit, total }`. Used by notes, trash, search and versions. Tags are not paginated.

## 4. API contract

Base path `/api` (the proxy prefix; the Express routes below are mounted without it). JSON only. 🔒 means Bearer access token required. Every endpoint may return 500 `INTERNAL_ERROR`; protected endpoints may return 401 `UNAUTHORIZED`; both are omitted below.

### 4.1 Auth

| Method and path | Auth | Success | Errors | Req |
| --- | --- | --- | --- | --- |
| `POST /auth/register` `{email, password}` | none | 201 `{user}` | 400 VALIDATION_ERROR; 409 EMAIL_TAKEN | FR-AUTH-1,2 |
| `POST /auth/login` `{email, password}` | none | 200 `{accessToken, refreshToken, user}` | 400; 401 INVALID_CREDENTIALS | FR-AUTH-3,4 |
| `POST /auth/refresh` `{refreshToken}` | none | 200 `{accessToken, refreshToken}` | 400; 401 INVALID_REFRESH_TOKEN | FR-AUTH-5 |
| `POST /auth/logout` `{refreshToken}` | 🔒 | 204 | 400; 401 | FR-AUTH-6 |
| `POST /auth/forgot-password` `{email}` | none | 202 `{message}` (same for unknown email) | 400 | FR-AUTH-8 |
| `POST /auth/reset-password` `{email, otp, newPassword}` | none | 204 | 400 VALIDATION_ERROR or INVALID_OTP | FR-AUTH-9,10 |

### 4.2 Notes

| Method and path | Success | Errors | Req |
| --- | --- | --- | --- |
| `POST /notes` 🔒 `{title, content?}` | 201 `Note` | 400; 401 | FR-NOTE-1 |
| `GET /notes` 🔒 `?page&limit&sort&order&tagId` | 200 `{items: NoteSummary[], page, limit, total}` | 400; 401; 404 (unknown/foreign `tagId`) | FR-NOTE-8,9,10 |
| `GET /notes/trash` 🔒 `?page&limit` | 200 `{items: TrashNoteSummary[], …}` | 400; 401 | FR-NOTE-6 |
| `GET /notes/{id}` 🔒 | 200 `Note` | 400; 401; 404 | FR-NOTE-3 |
| `PATCH /notes/{id}` 🔒 `{title?, content?}` (>= 1 field) | 200 `Note` | 400; 401; 404 | FR-NOTE-4 |
| `DELETE /notes/{id}` 🔒 | 204 (sets `deletedAt`) | 400; 401; 404 | FR-NOTE-5 |
| `POST /notes/{id}/restore` 🔒 | 200 `Note` | 400; 401; 404 (not deleted, foreign, or > 30 days) | FR-NOTE-7 |

`Note`: `{id, title, content, tags[], createdAt, updatedAt, deletedAt}`. `NoteSummary`: `{id, title, excerpt (<= 200), tags[], createdAt, updatedAt}`. `TrashNoteSummary`: summary without tags plus `deletedAt`.

### 4.3 Tags

| Method and path | Success | Errors | Req |
| --- | --- | --- | --- |
| `POST /tags` 🔒 `{name, color?}` | 201 `Tag` | 400; 409 TAG_NAME_TAKEN | FR-TAG-1 |
| `GET /tags` 🔒 | 200 `TagWithCount[]` (by name; `noteCount` counts active notes) | 401 | FR-TAG-2 |
| `PATCH /tags/{id}` 🔒 `{name?, color?}` | 200 `Tag` | 400; 404; 409 TAG_NAME_TAKEN | FR-TAG-3 |
| `DELETE /tags/{id}` 🔒 | 204 | 400; 404 | FR-TAG-4 |
| `PUT /notes/{id}/tags/{tagId}` 🔒 | 204 (idempotent) | 400; 404 (note or tag foreign/absent, or note deleted) | FR-TAG-5 |
| `DELETE /notes/{id}/tags/{tagId}` 🔒 | 204 (idempotent) | 400; 404 | FR-TAG-5 |

### 4.4 Search

| Method and path | Success | Errors | Req |
| --- | --- | --- | --- |
| `GET /search` 🔒 `?q&page&limit&tagId` | 200 `{items: SearchResult[], page, limit, total}` (may be empty) | 400 (blank/overlong `q`, bad paging, malformed `tagId`); 404 (unknown/foreign `tagId`) | FR-SRCH-1 to 7 |

`SearchResult`: `NoteSummary` + `rank` (ts_rank) + `highlight: {title, snippet}`. No `content` field.

### 4.5 Sharing

| Method and path | Auth | Success | Errors | Req |
| --- | --- | --- | --- | --- |
| `POST /notes/{id}/shares` `{expiresAt?}` | 🔒 | 201 `ShareLink` | 400 (bad id, past/non-ISO `expiresAt`); 404 | FR-SHARE-1 |
| `GET /notes/{id}/shares` | 🔒 | 200 `ShareLink[]` (newest first, all states) | 400; 404 | FR-SHARE-2 |
| `DELETE /notes/{id}/shares/{shareId}` | 🔒 | 204 | 400; 404 (foreign, other note, deleted note, already revoked) | FR-SHARE-3 |
| `GET /shared/{token}` | none | 200 `{title, content, updatedAt}` with `Cache-Control: no-store`, `Referrer-Policy: no-referrer` | 400 (token not 43 base64url chars); 404 (unknown, revoked, expired, note deleted; not counted) | FR-SHARE-4 to 7 |

`ShareLink`: `{id, token, expiresAt|null, revokedAt|null, viewCount, createdAt}`.

### 4.6 Version history

| Method and path | Success | Errors | Req |
| --- | --- | --- | --- |
| `GET /notes/{id}/versions` 🔒 `?page&limit` | 200 `{items: VersionSummary[], …}` newest first | 400; 404 | FR-VER-2 |
| `GET /notes/{id}/versions/{versionNumber}` 🔒 | 200 `Version` | 400 (non-integer or < 1); 404 | FR-VER-3 |
| `POST /notes/{id}/versions/{versionNumber}/restore` 🔒 | 200 `Note` | 400; 404 (note foreign/deleted or no such version) | FR-VER-4 |

`VersionSummary`: `{versionNumber, title, excerpt, createdAt}`. `Version` adds `content`.

### 4.7 Health

`GET /health` returns 200 `{status}`; it needs no authentication.

## 5. Backend module designs

### 5.1 Auth

- **Register/login**: Argon2id or bcrypt hash (library chosen and version-pinned at plan time, verified against Context7). Login always runs a hash comparison, using a dummy hash for unknown emails, so timing does not reveal account existence.
- **Tokens**: access JWT as above. Refresh token is 32 random bytes, base64url; only a SHA-256 hash is stored, `expiresAt = now + 7d`.
- **Rotation**: one transaction locks the user row (`SELECT … FOR UPDATE`), revokes the presented token, and issues a new pair. Presenting an already revoked token revokes every refresh token of that user (reuse detection, FR-AUTH-5).
- **Logout**: `updateMany` on `{tokenHash, userId, revokedAt: null}`; zero rows is still 204 (idempotent, cannot touch another user's token).
- **Forgot password**: unknown email returns the same 202 and writes nothing. For a known email, one transaction locks the user row, marks earlier unused OTPs used, creates a new row (`attempts` 0, `expiresAt = now + 10 min`). The 6-digit code comes from `crypto.randomInt`, is stored as an HMAC, and is passed to the sender (a console logger, OOS-6) only after commit.
- **Reset**: one transaction locks the user and the latest OTP, compares in constant time, increments `attempts` on failure (lock at 5), and on success sets `usedAt`, updates the password hash and revokes all refresh tokens. A failure rolls everything back. Every failure reports `INVALID_OTP` with one message.

### 5.2 Notes

- `createNote` writes the note and version 1 in one transaction.
- `updateNote` loads the active note, applies the patch, re-derives `contentText` if content changed, and records a version only when title or content actually changed (FR-VER-1).
- Listing: `where { userId, deletedAt: null, tags: { some: { tagId } }? }`, `orderBy` from `sort`/`order` (whitelist `updatedAt | createdAt | title`; default `updatedAt desc`; ties broken by `id`), plus `count` for `total`.
- Trash: `deletedAt >= now() - 30 days`. Restore: `updateMany` guarded by `deletedAt` inside the window; zero rows is 404.
- Body limit: `express.json({ limit: "1mb" })` mapped to `VALIDATION_ERROR`.

### 5.3 Tags

- `TagWithCount` is one grouped query counting `NoteTag` rows joined to notes with `deletedAt IS NULL`.
- Unique violation on `(userId, name)` (Prisma `P2002`) maps to `TAG_NAME_TAKEN`; a rename to the tag's own current name is a no-op success.
- Attach is `upsert` on the composite key after verifying ownership of both the active note and the tag. Detach is `deleteMany`.

### 5.4 Search

- Query text is converted with `websearch_to_tsquery('english', $q)` (handles phrases, `-exclusion`, unbalanced quotes without error). Stop-word-only input yields an empty tsquery and an empty page.
- `WHERE n."userId" = $1 AND n."deletedAt" IS NULL AND n."searchVector" @@ query`, `ORDER BY ts_rank(searchVector, query) DESC, n."updatedAt" DESC`, `LIMIT/OFFSET`, with an optional `EXISTS` on `NoteTag`. A separate `count(*)` gives `total`.
- **Highlighting** (FR-SRCH-5,6): `ts_headline('english', text, query, 'StartSel=<mark>, StopSel=</mark>, MaxFragments=2, MaxWords=…, FragmentDelimiter=…')`. Because `ts_headline` does not escape input, the service first replaces the markers with private sentinels, HTML-escapes the text (`& < > " '`, including literal `<mark>` typed by the user), then swaps the sentinels back to `<mark>`/`</mark>`. Title is highlighted whole; if only the title matches, the snippet falls back to the leading text. All values are bound parameters in tagged `$queryRaw`.

### 5.5 Sharing

- **Token**: `randomBytes(32).toString("base64url")` (43 chars, 256 bits).
- **Atomic view count** is one statement, which is the whole design of FR-SHARE-6:

  ```sql
  UPDATE "ShareLink" s SET "viewCount" = s."viewCount" + 1
  FROM "Note" n
  WHERE s."noteId" = n.id AND s.token = $1 AND s."revokedAt" IS NULL
    AND (s."expiresAt" IS NULL OR s."expiresAt" > now()) AND n."deletedAt" IS NULL
  RETURNING n.title, n.content, n."updatedAt"
  ```

  Row locking serializes concurrent increments (READ COMMITTED re-checks the `WHERE` after the lock), so N concurrent views add exactly N, and a revoke that commits first prevents every later count. An empty result is 404. Expiry uses database `now()` so check and count share one clock.
- **Revoke** is one `updateMany({ id: shareId, noteId, revokedAt: null, note: { userId, deletedAt: null } })`; zero rows is 404.
- The public response is built from exactly three fields so nothing else can leak. Deleting a note leaves its links untouched; the live check reads `Note.deletedAt` on each open, so links stop at once and resume on restore.

### 5.6 Versions

- A save runs in one transaction that locks the note row (`SELECT … FOR UPDATE`), reads `max(versionNumber)`, and inserts `max + 1` (or 1 for a pre-existing note with no history). The lock serializes allocators, giving consecutive numbers without retry loops (FR-VER-1).
- **Restore** copies the chosen version's `title`, `content` and `contentText` onto the note, re-derives the search vector (generated column), and appends a new version. If the chosen state equals the current state it is a no-op. Tags are untouched. History rows are never updated.
- The version list and read endpoints return 404 for a soft-deleted note, but its history remains and returns after restore (FR-VER-5).

### 5.7 Scheduled purge (FR-VER-6, FR-NOTE-5)

A job (`node-cron` or an in-process interval started in `server.ts`, version pinned) runs daily. It permanently deletes notes with `deletedAt < now() - 30 days`; cascades remove their tags links, share links and versions. Nothing inside the 30-day window is ever touched, and the job is the only code path that physically deletes a note. The job is idempotent and takes a Postgres advisory lock so multiple instances do not overlap.

## 6. Frontend design

| Concern | Design |
| --- | --- |
| Routing | `react-router`; `ProtectedRoute` redirects visitors to `/login`; routes `/login`, `/register`, `/forgot-password`, `/reset-password`, `/notes`, `/notes/new`, `/notes/:id`, `/trash`, `/search`, `/shared/:token` (public) |
| Server state | TanStack Query in `src/queries`. Keys: `["notes", params]`, `["note", id]`, `["tags"]`, `["search", params]`, `["shares", noteId]`, `["versions", noteId, "list"]` (one growing list for "Load more"), `["versions", noteId, "detail", n]`. Mutations invalidate the narrowest affected keys. |
| Client state | Zustand: `authStore` (access token in memory, refresh token persisted, user), small UI stores (sidebar, drawers) |
| API client | `src/api/client.ts` attaches the bearer token, validates responses with shared schemas, normalizes errors into `ApiError { code, status, details }`. On 401 it makes one single-flight call to `/auth/refresh` and retries the request once; a failed refresh clears the session and redirects to login (FR-FE-2). |
| Forms | `react-hook-form` plus the shared Zod schemas; server `details` map to field errors (`lib/form-errors`) |
| Editor | TipTap with StarterKit and a toolbar; content is the same JSON the API stores |
| Autosave (FR-FE-5) | Edits mark the form dirty; a debounced mutation (about 1 s idle) sends `PATCH /notes/{id}` with changed fields only and `autosave: true`; one save in flight at a time, the latest state queued behind it; status badge Saving / Saved / Error with retry; flush on route leave; the unsaved-changes guard blocks navigation while dirty or failed |
| New note | `POST /notes` on first meaningful input (or explicit save), then the route switches to `/notes/:id` and autosave takes over |
| Search UI | Debounced (300 ms) input bound to a URL query parameter; results render `highlight.title` and `highlight.snippet` through a sanitizer that allows only `<mark>`; never `dangerouslySetInnerHTML` with raw strings (FR-FE-9) |
| Share modal | Create link (optional expiry), copy button, table with status (active/expired/revoked), view count, revoke with confirm |
| Version drawer | Lists versions (paginated), previews one read-only, "Restore as new version" confirms, then refetches the note and versions |
| Trash page (FR-FE-11) | `/trash` route behind `ProtectedRoute`, linked from the notes list. Reads `GET /notes/trash` (paginated, `["notes", "trash", params]`, page in the URL). Each row shows title, excerpt and deletion date with a **Restore** button that calls `POST /notes/{id}/restore`; on 200 it invalidates the trash and `["notes"]` keys and the row disappears, on 404 it shows an error and refetches. Rows are not links, there is no permanent delete, and no backend or shared change is needed |
| UI kit | shadcn/ui components in `components/ui`; accessibility: labelled controls, focus management in dialogs and drawers |

## 7. Testing strategy (NFR-QUAL-1,2)

| Level | Tool | What |
| --- | --- | --- |
| Unit | Vitest | pure helpers: content-text extraction, OTP, tokens, password, highlight escaping, form-error mapping |
| API integration | Vitest + Supertest against real Postgres 16 | one named test per spec scenario; concurrency tests (`Promise.all` for view count and version numbers, revoke race); every status code from the delta contracts |
| Component | Vitest + Testing Library | pages, editor, autosave, dialogs, query hooks (with mocked transport) |
| E2E | Playwright | the FR-E2E-1 journey against a seeded stack |
| Repo checks | `packages/repo-checks` | conformance: spec scenario to test-name mapping, no types or schemas outside `packages/shared`, pinned versions |

Test titles equal the spec scenario names verbatim. Expired and locked states are set up by writing timestamps and counters through Prisma. Coverage is >= 80% on new code.

## 8. Quality gates and delivery

- **Checkpoint per phase**: `pnpm build` (0 errors, 0 warnings), `pnpm lint --max-warnings 0`, `pnpm test`. Husky pre-commit enforces them; commitlint enforces `feat(scope): description AB#1234`.
- **Per ticket workflow**: `/spec` (proposal, delta spec, `delta-openapi.yaml`) -> human approval -> `/plan` (design.md) -> approval -> `/tasks` -> approval -> `/implement`. Backend and frontend `[PARALLEL]` tasks run in separate worktrees. `/review` in a fresh terminal must be all ✅, then `openspec archive`, then `/pr` with the FRS requirements and scenarios listed.
- **Dependencies**: exact versions only; Node 22 (`.nvmrc`), pnpm 10, `engine-strict`.

## 9. Security considerations

| Threat | Mitigation |
| --- | --- |
| Credential stuffing, user enumeration | identical errors and bodies for unknown/known email; constant-time comparison; dummy hash on unknown login |
| OTP brute force | 6 digits, 10 min TTL, 5 attempts then locked, single use, superseded on re-request |
| Token theft | short access TTL; refresh rotation with reuse detection; only hashes stored |
| IDOR | `userId` in every query; foreign resources are 404 |
| XSS | React escaping; server-side escape of highlight output; sanitizer allowing only `<mark>`; TipTap content rendered through the editor schema, never as raw HTML |
| SQL injection | Prisma parameterization; raw SQL only through tagged `$queryRaw` with bound values |
| Share link leakage | 256-bit tokens, `Referrer-Policy: no-referrer`, `Cache-Control: no-store`, uniform 404, revocation and expiry |
| Large payloads | 1 MB body limit, `q` <= 200, `limit` <= 100 |
| Rate abuse of auth/public endpoints | not required by the current specs; recommended hardening (rate limiter) tracked as a follow-up, not silently added |

## 10. Implementation status against this design

Verified against the repository on 2026-10-21 (tickets AB-1001 to AB-1012 archived):

| Item | Status |
| --- | --- |
| Auth, notes, tags, search with highlight, sharing, versions (backend) | Implemented per the archived deltas |
| Auth pages, notes list, note editor (frontend) | Implemented |
| **Note list sorting** (FR-NOTE-9, `sort`/`order` on `GET /notes`) | **Gap.** The shipped contract only orders by `updatedAt desc`; the assignment places sorting in AB-1005. Needs a delta amendment (additive, backward compatible) before frontend sort UI. |
| **Auto-purge** (FR-VER-6, section 5.7) | **Gap.** No purge code exists; the AB-1009 spec lists it only implicitly. Needs its own spec scenarios (nothing purged inside 30 days; older notes and versions purged). |
| Editor autosave (FR-FE-5) | Implemented by change `ab-1012-autosave` (2026-10-22): 1 s debounce, one save in flight, status with Retry, flush on leave, autosaves coalesced into one version (`NoteVersion.coalescible`). |
| Search UI, share modal (AB-1013, AB-1014) | Implemented |
| Version drawer (AB-1015) | Implemented: list with Load more, read-only preview, restore as a new version |
| Tag creation UI (AB-1018, FR-TAG-1, FR-FE-4) | Implemented by change `ab-1018-tag-create-ui`: an inline New tag form in the editor's Tags group creates the tag and attaches it to the open note (partial failure keeps the tag, unpressed, with an alert). No backend or shared change. |
| **Trash page and restore UI** (AB-1019, FR-FE-11) | **Gap.** The backend (`GET /notes/trash`, `POST /notes/{id}/restore`) is implemented, but the frontend has no `/trash` page or Restore action, although FR-FE-3 once claimed a trash view. FR-FE-3 now excludes it; AB-1019 delivers it. |
| E2E (AB-1016) | Not started; its trash step depends on AB-1019 |
| Ticket numbering | The archived backend tickets AB-1005 to AB-1007 are tags, search and highlight, whereas the assignment sequence is pagination/sorting, tags, search. The mapping in `FRS.md` section 4 follows the assignment; the gaps above are the net effect of that drift. |
