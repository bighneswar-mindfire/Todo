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
