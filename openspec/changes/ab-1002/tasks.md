## Conventions

- Model per task: **Haiku** = boilerplate, **Sonnet** = implementation, **Opus** = architecture only (none needed; D4 is designed). **[SUBAGENT]** = estimated over 45 min (Rule 6). **[PARALLEL]** = independent, runs in its own git worktree (Rule 7).
- Test titles are the scenario names verbatim (`it("<scenario name>")`) inside `describe("auth: <requirement>")`. Exactly one test per scenario. Extra tests that the design adds (no spec scenario) are prefixed `[design]`.
- Every checkpoint: `pnpm build` (0 errors) -> `pnpm lint --max-warnings 0` -> `pnpm test`, all green before moving on.
- Run shell commands with Node 22 / pnpm 10 on PATH (see memory `node22-via-fnm`); Postgres must be up (`docker compose up -d`).
- All types and Zod schemas live in `packages/shared` only. Pin exact versions (Rule 20). Verify every library API in Context7 before use (Rule 9). Ask `[y/n]` before every file write (Rule 10).
- Commits: `feat(auth): ... AB#1002`.

## 0. Prep (Haiku)

- [x] 0.1 Check `jose` against Context7 (`SignJWT`, `jwtVerify`, `requiredClaims`, `typ`, `errors.JOSEError`); pick the exact version with `npm view jose version`; add it pinned to `apps/backend/package.json`; `pnpm install`.
- [x] 0.2 Verify against Context7: Express 5 4-arg error middleware and async rejection forwarding; body-parser error `type`/`status` values; Prisma 7 interactive `$transaction` with `$queryRaw`; `node:crypto` async `scrypt` options (`maxmem`).
- [x] 0.3 Add `JWT_SECRET` (32+ chars) to the local, gitignored `apps/backend/.env`; confirm Postgres is up and `pnpm --filter @todo/backend migrate:deploy` is clean.

## 1. Shared package (Sonnet)

- [x] 1.1 `packages/shared/src/env.ts`: add `JWT_SECRET: z.string().min(32)` to `envSchema`.
- [x] 1.2 Create `packages/shared/src/auth.ts`: `emailSchema` (trim, lowercase, email, max 254), `registerRequestSchema` (password 8..128), `loginRequestSchema` (password 1..128), `refreshRequestSchema` and `logoutRequestSchema` (`refreshToken` 1..256), `userSchema`, `registerResponseSchema`, `tokenPairSchema`, `authTokensResponseSchema`, `accessTokenClaimsSchema` (`sub` UUID), `errorCodeSchema` (6 codes, exactly as the approved delta), `errorResponseSchema`, `zodIssuesToDetails` (path joined with `.`, empty path -> `"body"`); inferred types; export from `src/index.ts`.
- [x] 1.3 Update `packages/shared/src/shared.test.ts` for the new required env var (existing tests pass `JWT_SECRET`).
- [x] 1.4 Test: **Missing secret fails startup** (`parseEnv` without `JWT_SECRET`, and with 31 chars, throws an error that names `JWT_SECRET`).
- [x] 1.5 `[design]` tests for `zodIssuesToDetails` (empty path -> `body`, nested path joined) and email normalization order.
- [x] **Checkpoint 1**: build, lint, test.

## 2. Backend building blocks

- [x] 2.1 [PARALLEL] (Sonnet) `apps/backend/src/errors.ts` (`AppError(code, status, message, details?)`) and `src/middleware/error-handler.ts` (4-arg): `AppError` -> its status/code; body-parser errors by `err.type`/`err.status` -> 400 `VALIDATION_ERROR` with fixed message and `details: [{ field: "body", ... }]`, never echoing or logging `err.message`/`err.body`; anything else -> log class/safe message only, 500 `INTERNAL_ERROR`, no stack. `[design]` tests: malformed JSON returns 400 with no echoed content; oversized body -> 400; unexpected error -> 500 `INTERNAL_ERROR` with no stack trace.
- [x] 2.2 [PARALLEL] (Sonnet) `src/auth/password.ts`: `createPasswordHasher(params)` returning `{ hash, verify }` per D1 (async scrypt, `scrypt$N$r$p$salt$hash`, `maxmem = 2*128*N*r`, bounds-checked params on verify, equal-length check before `timingSafeEqual`); exported production params N=2^16, r=8, p=2; `createDummyHash` helper. `[design]` tests: round trip; wrong password false; out-of-range or corrupt stored hash -> false without allocating; two hashes of one password differ.
- [x] 2.3 [PARALLEL] (Sonnet) `src/auth/tokens.ts`: `signAccessToken` (single `iat`, `exp = iat + 900`, `typ: "at+jwt"`, HS256), `verifyAccessToken` (`algorithms`, `requiredClaims`, `typ`, claims via `safeParse`, any failure -> `AppError(UNAUTHORIZED, 401)`), `generateRefreshToken` (32 bytes base64url), `hashRefreshToken` (sha256 hex), `REFRESH_TOKEN_TTL_MS` (7 days) and `ACCESS_TOKEN_TTL_SECONDS` (900) constants.
- [x] 2.4 (Haiku) Express type augmentation `req.auth?: { userId: string }` in `src/types/express.d.ts`.
- [x] **Checkpoint 2**: build, lint, test.

## 3. Register and login

- [ ] 3.1 (Haiku) Test helpers `src/auth/test-helpers.ts`: cheap hasher, known test `JWT_SECRET`, `buildTestApp()`, `uniqueEmail()`, `cleanupUsers()`; add test `JWT_SECRET` to `apps/backend/vitest.config.ts` (`test.env`) so tests do not depend on a local `.env`.
- [ ] 3.2 (Sonnet) Wire dependencies: `createApp({ ping, prisma, hasher, jwt })` mounts `/auth` and the error handler last; update `server.ts` (production hasher, dummy hash, jwt config from env) and `health.test.ts` for the new deps.
- [ ] 3.3 (Haiku) Add `JWT_SECRET=` placeholder (32+ chars, with a comment) to `apps/backend/.env.example`.
- [ ] 3.4 (Sonnet) `auth.service.ts` `register` (hash first, `select` id/email/createdAt, `P2002` -> 409 `EMAIL_TAKEN`, import `Prisma` from the generated client) and `login` (unknown email verifies against the dummy hash; identical 401; creates refresh row with 7-day expiry) plus `auth.routes.ts` `POST /auth/register` and `POST /auth/login` (`safeParse(req.body ?? {})` -> `AppError(VALIDATION_ERROR)`).
- [ ] 3.5 `apps/backend/src/auth/register.test.ts`, `describe("auth: user registration")`:
  - [ ] Register with valid credentials
  - [ ] Email is normalized
  - [ ] Password is stored hashed
  - [ ] Duplicate email rejected
  - [ ] Invalid email rejected
  - [ ] Short password rejected
  - [ ] Overlong password rejected
- [ ] 3.6 `apps/backend/src/auth/login.test.ts`, `describe("auth: user login")`:
  - [ ] Login with correct credentials
  - [ ] Email matching is case-insensitive
  - [ ] Access token claims and lifetime
  - [ ] Refresh token persisted as hash with 7-day expiry
  - [ ] Wrong password rejected
  - [ ] Unknown email rejected identically
  - [ ] Malformed login body rejected
- [ ] **Checkpoint 3**: build, lint, test.

## 4. Authenticate middleware and logout

- [ ] 4.1 (Sonnet) `src/auth/authenticate.ts`: strict `Bearer <token>` parsing (scheme case-insensitive, exactly one non-empty token), `verifyAccessToken`, sets `req.auth`; every failure 401 `UNAUTHORIZED`.
- [ ] 4.2 (Sonnet) `logout` (scoped `updateMany` by `tokenHash` + `userId` + `revokedAt: null`, always 204) and `POST /auth/logout` (`authenticate`, then body validation).
- [ ] 4.3 `apps/backend/src/auth/authenticate.test.ts`, `describe("auth: access token verification")` (uses a small test-only protected route):
  - [ ] Valid access token accepted
  - [ ] Missing Authorization header
  - [ ] Malformed Authorization header
  - [ ] Tampered access token
  - [ ] Expired access token
  - [ ] Refresh token rejected as access token
- [ ] 4.4 `apps/backend/src/auth/logout.test.ts`, `describe("auth: logout")`:
  - [ ] Logout revokes the refresh token
  - [ ] Logout is idempotent
  - [ ] Cannot revoke another user's token
  - [ ] Logout without refresh token rejected
- [ ] **Checkpoint 4**: build, lint, test.

## 5. Refresh with rotation

- [ ] 5.1 (Sonnet, **[SUBAGENT]**, est. over 45 min) `refresh` in `auth.service.ts` per D4: read by hash; interactive `$transaction` whose first statement is `SELECT 1 FROM "User" WHERE id = $1::uuid FOR UPDATE`; re-read the row under the lock; revoked -> revoke-all, commit, return `reuse`; expired -> `invalid`; else claim (`updateMany` `revokedAt: null`), insert the new token with a fresh 7-day `expiresAt`, return `rotated`; map `reuse`/`invalid` to 401 `INVALID_REFRESH_TOKEN` outside the transaction; plus `POST /auth/refresh`.
- [ ] 5.2 `apps/backend/src/auth/refresh.test.ts`, `describe("auth: token refresh with rotation")`:
  - [ ] Refresh with valid token
  - [ ] Old token is revoked after rotation
  - [ ] Reuse revokes the whole session family
  - [ ] Unknown refresh token rejected
  - [ ] Expired refresh token rejected
  - [ ] Missing refresh token rejected
- [ ] 5.3 `[design]` tests: a rotated token gets a fresh 7-day `expiresAt`; a concurrent rotation and reuse of the previous token leave no un-revoked refresh token for the user (assert the end state in the DB).
- [ ] **Checkpoint 5**: build, lint, test.

## 6. Error envelope, wiring checks, definition of done

- [ ] 6.1 `apps/backend/src/auth/errors.test.ts`, `describe("auth: error envelope")`:
  - [ ] Validation error shape
  - [ ] No credential leakage in errors
- [ ] 6.2 Test: **Backend consumes shared auth schemas** (`describe("auth: configuration and shared schemas")`): asserts the auth routes import the request schemas from `@todo/shared` and that `apps/backend/src` declares no Zod auth schemas and does not import `zod`. Success of `pnpm build` is part of Checkpoint 6.
- [ ] 6.3 `pnpm test --coverage`: at least 80% on new code (thresholds already enforced); fix gaps with tests, not exclusions.
- [ ] 6.4 Manual smoke test against the running dev server: register -> login -> refresh -> reuse of the old token -> logout, plus each error status (400, 401, 409), confirming status codes match `delta-openapi.yaml`.
- [ ] 6.5 `openspec validate ab-1002` passes; confirm 34 scenarios map to 34 named tests (no scenario missing, none duplicated).
- [ ] 6.6 Update `apps/backend/CLAUDE.md` with the auth conventions (error envelope, `AppError`, per-user lock rule for refresh-token writes) and `JWT_SECRET` requirement.
- [ ] **Checkpoint 6 / DoD**: `pnpm build` 0 errors and 0 warnings, `pnpm lint --max-warnings 0`, `pnpm test --coverage` green. Then commit (`feat(auth): ... AB#1002`), `/review AB-1002` in a fresh terminal (all green), `openspec archive`, `/pr`.

## Scenario to test map (34)

| Requirement | Count | File |
|---|---|---|
| User registration | 7 | `register.test.ts` (3.5) |
| User login | 7 | `login.test.ts` (3.6) |
| Token refresh with rotation | 6 | `refresh.test.ts` (5.2) |
| Logout | 4 | `logout.test.ts` (4.4) |
| Access token verification | 6 | `authenticate.test.ts` (4.3) |
| Error envelope | 2 | `errors.test.ts` (6.1) |
| Auth configuration and shared schemas | 2 | `shared.test.ts` (1.4), backend test (6.2) |
