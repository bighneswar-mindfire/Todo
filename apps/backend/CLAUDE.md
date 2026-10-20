# Backend

Express 5 + TypeScript (ESM) + Prisma 7.

- `createApp(deps)` in `src/app.ts` builds the app without listening; Supertest imports it directly. `src/server.ts` is the only entry that listens.
- Env is validated by `parseEnv` from `@todo/shared`. Never read `process.env` elsewhere.
- Prisma client is generated to `src/generated/prisma` (gitignored). Run `pnpm generate` after schema changes; `pnpm build` does it automatically. Import the client with the `.js` extension.
- Prisma commands need `--config prisma7.config.ts` (already in the package scripts).
- The first migration is hand-edited: `Note.searchVector` is a generated `tsvector` column. Never regenerate or squash it. The schema field carries `@default(dbgenerated())` so `migrate dev` sees no drift (without it Prisma proposes `DROP DEFAULT` on every migration); verify with `migrate dev --create-only` and delete the migration if it is empty. Add new migrations with `pnpm migrate:dev --name <name>`.
- Request/response types and Zod schemas come from `@todo/shared`; do not define them here.
- Scope every user-owned query by `userId`. Return 404 (not 403) for other users' resources.
- Tests: Vitest + Supertest, files `src/**/*.test.ts`, one test per spec scenario, named after it. `@todo/shared` resolves to its source in tests.

## Auth (AB-1002)

- `JWT_SECRET` (32+ characters) is required; startup fails without it. Tests get a known secret from `vitest.config.ts` (`test.env`). Access tokens are HS256 with header `typ: "at+jwt"`; refresh tokens are opaque and only `sha256(token)` is stored.
- Every error response is `{ error: { code, message, details? } }`. Routes `safeParse(req.body ?? {})` with the shared schemas and throw `AppError(code, status, message, details?)`; the backend imports no `zod`. One 4-argument handler (`middleware/error-handler.ts`) is registered last. Express 5 forwards rejected async handlers to it, so there is no `asyncHandler`.
- Never echo or log `err.message`, `err.body`, request bodies, passwords or tokens. Error messages are fixed strings.
- Password hashing and the dummy hash for unknown-email logins come from the injected `PasswordHasher` (`createApp({ ping, prisma, hasher, jwt })`); tests inject cheap scrypt params.
- **Per-user lock rule:** any write that rotates or revokes a user's refresh tokens as a family must first run `SELECT 1 FROM "User" WHERE id = $1::uuid FOR UPDATE` inside an interactive `$transaction` (see `refresh` in `auth.service.ts`). The transaction returns a result instead of throwing so a family revoke commits. Logout is the only exception: it only moves a token toward revoked.
- Protect routes with `createAuthenticate({ secret })`; it sets `req.auth = { userId }` and answers 401 `UNAUTHORIZED` for anything but a valid access token.
- Auth tests use `buildTestApp`, `uniqueEmail` and `cleanupUsers` from `src/auth/test-helpers.ts`. Emails carry a per-file run id so parallel test files never delete each other's users.

## Password reset (AB-1003)

- `POST /auth/forgot-password` (202, identical for unknown emails) and `POST /auth/reset-password` (204). No email is sent: the OTP goes through the injected `OtpSender`; the default `consoleOtpSender` logs `[password-reset] OTP for <email>: <code>`. Tests pass a capturing sender (`buildTestApp` -> `lastOtpFor(email)`); pass `otpSender: "default"` to exercise the console one.
- OTP: 6 digits (`randomInt`), 10 min TTL, 5 attempts, single use, one active per user. Stored as `HMAC-SHA256(JWT_SECRET, "password-reset-otp:<userId>:<otp>")` (`src/auth/otp.ts`), so rotating `JWT_SECRET` invalidates outstanding OTPs. Never log or return the raw OTP anywhere except the sender.
- Every reset failure is the same 400 `INVALID_OTP` (unknown email, wrong, expired, used, superseded, locked). The reset transaction returns a result instead of throwing so a wrong attempt's counter commits, and it follows the per-user lock rule above. A successful reset also revokes all of the user's refresh tokens; already-issued access tokens stay valid until they expire.
- Known gaps (out of scope): no rate limit or cooldown on `forgot-password`, and known emails do DB writes unknown ones skip (small timing difference).


## Notes (AB-1004)

- `/notes` (all routes behind `authenticate`): `POST /`, `GET /`, `GET /trash`, `GET /:id`, `PATCH /:id`, `DELETE /:id` (204, soft), `POST /:id/restore`. `GET /trash` is registered before `/:id`.
- Every query filters `{ id, userId }` plus state; mutations are one `updateMany` and `count === 0` is 404 `NOT_FOUND` (missing, foreign and wrong-state notes are indistinguishable by design).
- Soft delete sets `deletedAt` only. Restore and trash use the shared `TRASH_RETENTION_DAYS` (30) window from `deletedAt`. There is no purge job, so no note row is ever physically deleted.
- `contentText` is derived server-side by `extractText` (`src/notes/content-text.ts`) on create and whenever `content` is patched; lists return a 200-char `excerpt`, never `content`.
- Request bodies are capped at 1 MB; larger ones fail as 400 `VALIDATION_ERROR` via the error handler.
- Notes tests use `registerAndLogin`, `createNote`, `setDeletedAt` from `src/notes/test-helpers.ts` (age is simulated by writing `deletedAt` through Prisma).

## Tags (AB-1005)

- `/tags` (behind `authenticate`): `POST /` (201), `GET /` (`{ items }` with `noteCount`, name asc), `PATCH /:id`, `DELETE /:id` (204, hard delete, FK cascade drops `NoteTag` rows). Attach/detach are `PUT|DELETE /notes/:id/tags/:tagId` (204, idempotent) on the notes router and delegate to the tags service.
- Name is trimmed, 1 to 50 chars, unique per user and case-sensitive (`@@unique([userId, name])`); a Prisma `P2002` becomes 409 `TAG_NAME_TAKEN`. Color is `#RRGGBB`, default `#6b7280`.
- Missing, foreign and (for notes) soft-deleted resources are all 404 `NOT_FOUND`. Attach/detach check the active note and the tag in one transaction; attach uses `createMany({ skipDuplicates })`.
- Soft-deleted notes keep their tag links (restore brings tags back) and do not count toward `noteCount`.
- Note responses and list summaries carry `tags` (`{ id, name, color }`, name asc); trash summaries do not. `GET /notes?tagId=` 404s for a tag the caller does not own.
- Tests use `createTag` and `attachTag` from `src/notes/test-helpers.ts`.

## Search highlight (AB-1007)

- `GET /search` items carry `highlight: { title, snippet }`. `search.service.ts` runs one extra `ts_headline(..., HighlightAll=true)` query for the page's ids only; `highlight.ts` (`buildHighlight`) cuts the snippet window and renders it.
- Marks are private sentinels (U+E000/U+E001), stripped from the source text in SQL with `translate`, so note text cannot forge one. Output order is fixed: escape `& < > " '` first, then swap sentinels for `<mark>`/`</mark>`. Never swap before escaping.
- Do not switch the snippet to `MaxFragments` mode: it strips HTML-like tags and short leading words from the note text.
- Snippet is up to two ~100-character windows, hard-capped at 300 characters of rendered HTML. Title-only matches fall back to the escaped `excerpt`.

## Sharing (AB-1008)

- Owner routes (on the notes router, behind `authenticate`): `POST|GET /notes/:id/shares`, `DELETE /notes/:id/shares/:shareId` (204, sets `revokedAt` only, row kept). Public, unauthenticated: `GET /shared/:token` (`sharing.routes.ts`, mounted at `/shared`).
- The view count is one `UPDATE "ShareLink" ... FROM "Note" ... RETURNING` in `sharing.service.ts` (`getShared`): it checks not revoked, not expired (DB `now()`), note not soft deleted, and increments in the same statement. Never split it into a read then a write.
- Every public failure (unknown, revoked, expired, deleted note) is the same 404 `NOT_FOUND`; a malformed token is 400. The 200 sets `Cache-Control: no-store` and `Referrer-Policy: no-referrer` and returns only `title`, `content`, `updatedAt`.
- Token = 32 `randomBytes`, base64url (43 chars), stored plaintext so the owner can list it. Never log it. Deleting a note keeps its links; they resume on restore.
- Sharing tests use `createShare`, `listShares`, `openShared` from `src/sharing/test-helpers.ts`.

## Version history (AB-1009)

- Routes on the notes router: `GET /notes/:id/versions` (newest first, `{ items, page, limit, total }`, summaries without `content`), `GET /notes/:id/versions/:versionNumber`, `POST /notes/:id/versions/:versionNumber/restore` (200, returns the note). `versionNumber` is the public handle (integer >= 1, per note).
- Every changed save goes through `saveNoteState(tx, ...)` in `versions/record-save.ts`, inside `prisma.$transaction`: it locks the note row (`FOR UPDATE`, which also checks owner and not-deleted), skips the write when title and content are unchanged (no version, `updatedAt` not advanced), then updates the note and inserts `max + 1`. Never allocate a version number outside it.
- Create writes version 1 in the same nested write. Trash delete/restore create no version. Restore appends a version and never edits or removes existing ones; tags and share links are untouched.
- Notes created before AB-1009 have no versions until their first changed save (that save is version 1). Tests simulate this with `prisma.noteVersion.deleteMany`.
- Versions tests use `patchNote`, `listVersions`, `getVersion`, `restoreVersion` from `src/versions/test-helpers.ts`.
