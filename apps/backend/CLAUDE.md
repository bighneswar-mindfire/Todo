# Backend

Express 5 + TypeScript (ESM) + Prisma 7. Routes, request shapes and status codes are in `openspec/specs/<capability>/spec.md` and `docs/SDS.md`; this file holds only the rules that code alone does not show.

## Setup and layout

- `createApp(deps)` in `src/app.ts` builds the app without listening; Supertest imports it. `src/server.ts` is the only entry that listens.
- Env is validated by `parseEnv` from `@todo/shared`; never read `process.env` elsewhere. `JWT_SECRET` (32+ chars) is required; tests get one from `vitest.config.ts`.
- Prisma client is generated to `src/generated/prisma` (gitignored); run `pnpm generate` after schema changes and import it with the `.js` extension. Prisma commands need `--config prisma7.config.ts` (already in the scripts).
- The first migration is hand-edited (`Note.searchVector` is a generated `tsvector`). Never regenerate or squash it. The schema field keeps `@default(dbgenerated())`; check new migrations with `migrate dev --create-only` and delete the migration if it is empty. Add migrations with `pnpm migrate:dev --name <name>`.
- Types and Zod schemas come from `@todo/shared`; the backend imports no `zod`. Routes `safeParse(req.body ?? {})` and throw `AppError(code, status, message, details?)`. One 4-argument error handler is registered last; Express 5 forwards async rejections, so no `asyncHandler`.

## Rules

- Scope every user-owned query by `userId`; mutations are one `updateMany` and `count === 0` is 404 `NOT_FOUND`. Other users' resources are 404, never 403.
- Never log or echo `err.message`, `err.body`, request bodies, passwords, tokens or OTPs. Error messages are fixed strings. Request bodies are capped at 1 MB.
- Protect routes with `createAuthenticate({ secret })` (sets `req.auth = { userId }`, 401 `UNAUTHORIZED`).
- Soft delete sets `deletedAt` only; trash and restore use `TRASH_RETENTION_DAYS` (30). No note row is ever physically deleted.
- `contentText` is derived server-side by `extractText` on create and on content patch; lists return a 200-char `excerpt`, never `content`.

## Auth and OTP

- Access tokens are HS256 with header `typ: "at+jwt"`. Refresh tokens are opaque; only `sha256(token)` is stored. Hashing and the dummy hash for unknown-email logins come from the injected `PasswordHasher`.
- **Per-user lock rule:** any write that rotates or revokes a user's refresh tokens as a family first runs `SELECT 1 FROM "User" WHERE id = $1::uuid FOR UPDATE` in an interactive `$transaction` that returns a result instead of throwing (see `refresh` in `auth.service.ts`). Logout is the only exception.
- Password reset OTP: 6 digits, 10 min, 5 attempts, single use, stored as `HMAC-SHA256(JWT_SECRET, "password-reset-otp:<userId>:<otp>")`. It reaches only the injected `OtpSender` (default logs to console). Every reset failure is the same 400 `INVALID_OTP`; a success also revokes all refresh tokens.
- Known gaps (out of scope): no rate limit on `forgot-password`; known emails do DB writes unknown ones skip.

## Tags, search, sharing, versions

- Tag names are trimmed, 1 to 50 chars, unique per user, case-sensitive; Prisma `P2002` becomes 409 `TAG_NAME_TAKEN`. Tag delete is a hard delete (FK cascade). Soft-deleted notes keep their tag links and do not count toward `noteCount`.
- Search highlight: `ts_headline(..., HighlightAll=true)` for the page's ids only. Marks are private sentinels (U+E000/U+E001) stripped from source text in SQL; escape `& < > " '` first, then swap sentinels for `<mark>`. Never swap before escaping. Do not use `MaxFragments` mode. Snippet is capped at 300 chars of rendered HTML.
- Sharing: revoke sets `revokedAt` only. The public view is one `UPDATE "ShareLink" ... FROM "Note" ... RETURNING` (not revoked, not expired by DB `now()`, note not deleted, count incremented); never split it into read then write. Every public failure is the same 404; a malformed token is 400. Responses set `Cache-Control: no-store` and `Referrer-Policy: no-referrer`. Never log the token.
- Versions: every changed save goes through `saveNoteState(tx, ...)` in `versions/record-save.ts` (locks the note row `FOR UPDATE`, skips unchanged saves, inserts `max + 1`). Never allocate a version number elsewhere. Restore appends a version and never edits or removes existing ones.

## Tests

- Vitest + Supertest in `src/**/*.test.ts`, one test per spec scenario named after it. `@todo/shared` resolves to its source.
- Use the helpers in `src/<feature>/test-helpers.ts` (`buildTestApp`, `uniqueEmail`, `cleanupUsers`, `registerAndLogin`, `createNote`, `createTag`, `createShare`, `patchNote`...). Emails carry a per-file run id so parallel files never delete each other's users. Tests inject cheap scrypt params and a capturing `OtpSender`.
