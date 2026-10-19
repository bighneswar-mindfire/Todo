## Context

AB-1002 is the identity layer for every later ticket. `User` and `RefreshToken` already exist (AB-1001), so there is no migration. The backend is Express 5 + Prisma 7 (ESM). `createApp(deps)` builds the app without listening and `ping` is injected today; Supertest imports `createApp` directly. Env is parsed only through `parseEnv` in `@todo/shared`. The approved contract is `delta-openapi.yaml` (plus the pending amendment in "Delta amendment" below); behaviour is in `specs/auth/spec.md`.

This design was reviewed by an Opus pass; its findings are folded in below.

## Goals / Non-Goals

**Goals**
- Register, login, refresh (rotation + reuse detection), logout, and an `authenticate` middleware, matching the delta (status codes and error codes).
- All schemas and types in `packages/shared` only. One shared error envelope.
- Race-safe by construction (registration and refresh), not by check-then-act.
- Every spec scenario has exactly one named test, against the real Postgres.

**Non-Goals**
- Forgot/reset password and OTP (AB-1003), auth UI (AB-1010).
- Rate limiting / lockout, email verification, OAuth, cookies/CSRF, `GET /auth/me`.
- Purging expired or revoked refresh-token rows.
- A grace window for concurrent refresh; distinguishing logout-revoked from rotation-revoked tokens (needs a schema change).

## Decisions

### D1. Password hashing: Node built-in `crypto.scrypt`
Stored as `scrypt$N$r$p$<salt>$<hash>` (random 16-byte salt, 64-byte key). Params live in the encoded string so they can be raised later without invalidating old hashes.
- Production params: **N=2^16, r=8, p=2** (64 MiB per hash, an OWASP-listed equivalent), constants in one place. Always the **async** `crypto.scrypt` (promisified), never `scryptSync`.
- `maxmem` is derived per call as `2 * 128 * N * r` from the params being used. When verifying, params parsed from a stored hash are bounds-checked (N a power of two <= 2^20, r <= 16, p <= 4) before use, so a corrupt or foreign hash cannot trigger a huge allocation.
- Compare with `timingSafeEqual` after checking both buffers have equal length (it throws otherwise).
- The hasher is injected (`PasswordHasher { hash, verify }`); tests inject cheap params.
- Unknown-email login verifies against a **dummy hash generated at startup by the injected hasher** (same params as real hashes, so there is no timing difference), and returns the identical 401.
- Alternatives: **argon2** (best-in-class, but a native addon, fragile on Windows/pnpm); **bcrypt** (native addon, 72-byte input limit); **bcryptjs** (pure JS, slow, blocks the event loop).
- The 128-character password cap bounds hashing work per request. Zod `.max(128)` counts UTF-16 code units; accepted.

### D2. Access token: `jose`, HS256
- Sign: compute `iat = Math.floor(Date.now() / 1000)` once, then `setIssuedAt(iat).setExpirationTime(iat + 900)` so `exp - iat` is exactly 15 min (the scenario cannot flake across a second boundary). Header `typ: "at+jwt"`; claim `sub` = user id.
- Verify: `algorithms: ["HS256"]`, `requiredClaims: ["sub", "iat", "exp"]`, `typ: "at+jwt"`. The `typ` check keeps any other JWT later signed with `JWT_SECRET` (e.g. AB-1003) from passing as an access token. Claims are then checked with a shared Zod schema via **`safeParse`** (`sub` is a UUID).
- Every failure, whether a `jose` error (`errors.JOSEError`: expired, bad signature, malformed) or a failed claims check, becomes `AppError(UNAUTHORIZED, 401)`. A `ZodError` must never escape and turn into a 400.
- Header parsing is strict: scheme `Bearer` (case-insensitive) followed by exactly one non-empty token; anything else is 401.
- The middleware is stateless (no DB lookup). A deleted user's access token stays valid up to 15 min; acceptable, since no user deletion exists.
- A refresh token cannot pass as an access token: it is an opaque string, not a signed JWT.
- Alternative: `jsonwebtoken` (CommonJS, larger surface). Rejected for an ESM codebase.

### D3. Refresh token: opaque random, hash stored, 7-day lifetime
32 random bytes, base64url. Only `sha256(token)` (hex) is stored in `tokenHash` (unique index). A fast hash is correct for a high-entropy input. `REFRESH_TOKEN_TTL_MS = 7 days` is a single constant used for `expiresAt = now + TTL` at login **and at every rotation** (sliding window: a session stays alive while it is used at least once per 7 days). Tested at both login and refresh.
- Alternatives: JWT refresh token (spec requires a revocable DB-stored token); absolute session lifetime inheriting the original `expiresAt` (stricter, but not asked for and forces periodic re-login).

### D4. Rotation and reuse detection (the architecture decision)
Race analysis: under READ COMMITTED a bare `UPDATE ... WHERE userId = $u AND revokedAt IS NULL` takes its snapshot when the statement starts. If an attacker is mid-rotation (token R2 claimed, R3 inserted but not yet committed), a concurrent family revoke blocks on R2, skips it once it sees it is revoked, and never sees R3 (committed after its snapshot). R3 would survive reuse detection. Therefore **all refresh-token mutations for one user are serialized by a per-user row lock.**

`refresh(token)`:
1. Look up the row by `tokenHash` (read only). Not found -> 401 `INVALID_REFRESH_TOKEN`.
2. Open an **interactive** transaction `prisma.$transaction(async (tx) => ...)` (the array form cannot branch on the claim result). First statement: ``tx.$queryRaw`SELECT 1 FROM "User" WHERE id = ${userId}::uuid FOR UPDATE` ``. This serializes all refresh/reuse handling for that user.
3. Re-read the row inside the lock (state may have changed while waiting), then:
   - `revokedAt != null` -> **reuse**: `updateMany` revoke all of the user's un-revoked tokens, commit, and return a `reuse` result.
   - `expiresAt <= now` -> return `invalid` (ordinary expiry; no family revoke).
   - otherwise claim: `updateMany({ where: { id, revokedAt: null }, data: { revokedAt: now } })`, insert the new token, commit, return `rotated`.
4. Outside the transaction the service maps `reuse`/`invalid` to `AppError(INVALID_REFRESH_TOKEN, 401)`. The transaction **returns** a result instead of throwing, so the family revoke is committed, never rolled back by the 401.
- Because of the lock, a concurrent loser (the `count === 0` case) is impossible inside the lock; the claim's `revokedAt: null` guard remains as defence in depth and is treated as `reuse` if it ever matches 0 rows.
- "Family" means all of the user's refresh tokens, as the spec states.
- Alternatives: no lock, rely on `updateMany` (leaves the live-token hole above); `SERIALIZABLE` isolation (works but needs retry logic on serialization failures, more complex than a row lock); a `familyId`/`replacedBy` chain (finer revocation but needs a schema change, out of scope).
- Trade-offs: two tabs refreshing at the same instant can log the user out (second sees the first's revoked token). No grace window; deferred. A stale token revoked by logout also counts as reuse and revokes every session (spec-mandated; telling the cases apart needs a schema change).

### D5. Logout: one scoped update
`updateMany({ where: { tokenHash, userId, revokedAt: null }, data: { revokedAt: now } })`, always followed by 204. This gives idempotency (already revoked / unknown) and "cannot revoke another user's token" without branching, and leaks nothing about whether a token exists. It does not need the per-user lock: it only moves tokens toward revoked, and a concurrent rotation of the same token is resolved by the claim guard.

### D6. Register and login normalization
Email is normalized by the shared schema (`trim` -> `toLowerCase` -> email format, order confirmed against Zod 4 at implementation), max 254 characters; used by register and login, so storage and lookup are always lowercase and the existing unique index on `email` suffices (no `citext`). Duplicate detection relies on the unique constraint: catch `err.code === "P2002"` and return 409 `EMAIL_TAKEN`, so concurrent registrations cannot both succeed.
- Verified against the installed runtime (`@prisma/client` 7.10.1): with `@prisma/adapter-pg` the unique violation is still a `PrismaClientKnownRequestError` with code `P2002`, but `meta` is `{ driverAdapterError, table? }` and **has no `meta.target`**. So check the code only (sufficient: `email` is the only user-supplied unique column). Import `Prisma` from `./generated/prisma/client.js` so `instanceof` works.
- Hash the password before the insert so the duplicate path costs about the same as the success path.
- Create with `select: { id: true, email: true, createdAt: true }` so `passwordHash` can never be serialized.
- The login password schema is `min(1).max(128)`; strength rules apply only on register. `refreshToken` fields are `min(1).max(256)` (still a 400 `VALIDATION_ERROR` on violation).

### D7. Errors: one envelope, one handler
- Shared: error-code enum, `ErrorResponse` schema/type, and a helper `zodIssuesToDetails(issues)` that returns `[{ field, message }]` (`field` = `path.join(".")`, or `"body"` when the path is empty).
- Routes call `schema.safeParse(req.body ?? {})` and throw `AppError(VALIDATION_ERROR, 400, "Validation failed", details)` themselves. The backend has no `zod` dependency and the handler never uses `instanceof ZodError` (different Zod instances would silently fail it). `req.body ?? {}` because Express 5 leaves `req.body` undefined without a JSON content type; missing fields are then named.
- Backend: `AppError(code, status, message, details?)` (runtime class; code type from `@todo/shared`) and a single 4-argument error-handling middleware registered last:
  - `AppError` -> its status/code.
  - body-parser errors (recognised by `err.type`, e.g. `entity.parse.failed`, `entity.too.large`, `charset.unsupported`, `encoding.unsupported`, `request.aborted`; `err.status` 4xx) -> 400 `VALIDATION_ERROR` with a fixed message and `details: [{ field: "body", message: "Malformed or unsupported request body" }]`. **Never echo or log `err.message` or `err.body`**: V8's JSON parse message and body-parser's `err.body` can contain fragments of the submitted password.
  - Anything else -> log only the error class and a safe message server-side (never request bodies, headers or tokens), respond 500 `INTERNAL_ERROR` with a generic message and no stack trace.
- Express 5 forwards rejected async handlers to this middleware, so no `asyncHandler` wrapper.
- Messages are fixed strings; they never include the submitted password or any token.
- Unknown routes and wrong methods keep Express's default HTML 404/405 (the envelope is scoped to auth endpoints by the spec); noted, not changed here.

### D8. Structure and wiring
```
apps/backend/src/
  errors.ts                 AppError
  middleware/error-handler.ts
  auth/password.ts          scrypt hasher (factory with cost params)
  auth/tokens.ts            sign/verify access token, generate/hash refresh token
  auth/auth.service.ts      register, login, refresh, logout (Prisma + hasher + tokens)
  auth/authenticate.ts      Bearer middleware -> req.auth = { userId }
  auth/auth.routes.ts       Router; parses bodies with shared schemas
  app.ts                    createApp({ ping, prisma, hasher, jwt })
  server.ts                 builds prisma, hasher (production params), jwt config from env
packages/shared/src/auth.ts schemas + inferred types + error envelope + claims + zodIssuesToDetails
packages/shared/src/env.ts  + JWT_SECRET (min 32)
```
`createApp` takes the new collaborators as dependencies (same pattern as `ping`). `health.test.ts` currently calls `createApp({ ping })` and must be updated to supply the new deps. Routes are mounted at `/auth`. `req.auth` is declared by a small Express type augmentation in the backend (internal plumbing, not an API type). `logout` runs `authenticate` first, then validates the body. `JWT_SECRET` is added to `.env.example`, `shared.test.ts`, and any CI env.

### D9. Testing
Supertest against `createApp` with the real Postgres (as `database.test.ts` does). One named test per spec scenario. Isolation: unique emails per test; cleanup deletes the test users (cascade removes tokens). Expired refresh token: set `expiresAt` directly in the DB. Expired/tampered access token: sign with `jose` in the test. Cheap hasher keeps the suite fast. Additional tests beyond the scenarios' one-to-one mapping are limited to behaviour the design adds: sliding `expiresAt` on rotation, and a **concurrency test** that fires a rotation and a reuse of the previous token concurrently and asserts the end state: **no un-revoked refresh token remains** for that user (not merely that one request got a 401).

## Delta amendment (needs human re-approval, Rule 2)

The approved delta has no code for a 500 and does not say how body-parser failures map. This design needs: (1) `INTERNAL_ERROR` added to the `ErrorResponse.code` enum and a `500` response on each endpoint; (2) 400 descriptions noting that an unparseable or unsupported body is also `VALIDATION_ERROR`. The shared enum mirrors the amended delta exactly. **`/tasks` must not start until the amended delta is approved.**

## Risks / Trade-offs

- **Env break:** `JWT_SECRET` becomes required, so every caller of `loadEnv()` (e.g. `database.test.ts`) fails until `apps/backend/.env` has it. Mitigation: update `.env.example`, `shared.test.ts`, CI env and docs in the same change; call it out in the PR.
- **No rate limiting:** login can be brute-forced; mitigated only by scrypt cost. scrypt also occupies libuv threads shared with `pg`'s DNS lookups, so a login burst can delay DB connects (peak 4 x 64 MiB = 256 MiB). Record the memory requirement for containers. Revisit with rate limiting later.
- **Enumeration:** register returns 409 for existing emails (contract-mandated), so account enumeration is possible there regardless of the dummy hash on login.
- **Row growth:** expired/revoked refresh-token rows are never deleted. A purge job is a later concern.
- **Session loss on concurrent refresh** (D4) and **global logout on a stale logged-out token** (D4) are deliberate, spec-driven behaviours.
- **Per-user lock:** refresh requests for one user are serialized. Fine at this scale; the lock is held only for a few short statements.
- **Stateless access tokens** outlive account deletion by up to 15 min (D2).
- **Dependency versions:** `jose` must be pinned to an exact version and its APIs verified against Context7 at `/implement` (Rules 9, 20). No other new runtime dependency.
