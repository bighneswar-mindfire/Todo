## Conventions

- Model per task: **Haiku** = boilerplate, **Sonnet** = implementation, **Opus** = architecture only (none needed; the transaction design is in D4). **[SUBAGENT]** = estimated over 45 min (Rule 6; none this ticket). **[PARALLEL]** = independent, runs in its own git worktree (Rule 7).
- Test titles are the scenario names verbatim (`it("<scenario name>")`) inside `describe("auth: <requirement>")`. Exactly one test per scenario (22 scenarios). Extra tests the design adds (no spec scenario) are prefixed `[design]`.
- Every checkpoint: `pnpm build` (0 errors) -> `pnpm lint --max-warnings 0` -> `pnpm test`, all green before moving on.
- Run shell commands with Node 22 / pnpm 10 on PATH (memory `node22-via-fnm`); Postgres must be up (`docker compose up -d`).
- All types and Zod schemas live in `packages/shared` only. Pin exact versions (Rule 20); no new dependencies are expected. Verify any library API in Context7 before use (Rule 9).
- Work on branch `feat/ab-1003-password-reset` (create from `main` first). Commits: `feat(auth): ... AB#1003`.

## 0. Prep (Haiku)

- [ ] 0.1 Create branch `feat/ab-1003-password-reset` from `main`; confirm `docker compose up -d` and `pnpm --filter @todo/backend migrate:deploy` are clean and `pnpm test` is green before changes.
- [ ] 0.2 Verify against Context7 (Node 22 and Prisma 7): `crypto.randomInt`, `createHmac`, `timingSafeEqual` (equal-length requirement); interactive `$transaction` with `$queryRaw ... FOR UPDATE`; `updateMany` count semantics.

## 1. Shared package (Sonnet)

- [ ] 1.1 `packages/shared/src/auth.ts`: add `INVALID_OTP` to `errorCodeSchema`; add `forgotPasswordRequestSchema` (`email`), `forgotPasswordResponseSchema` (`message`), `resetPasswordRequestSchema` (`email`, `otp` matching `^\d{6}$`, `newPassword` 8..128) and inferred types. Reuse `emailSchema`.
- [ ] 1.2 Test **Backend consumes shared schemas** (in `shared-schemas.test.ts`, `describe("auth: password reset error handling and shared schemas")`): the backend routes import the schemas from `@todo/shared`, `errorCodeSchema` includes `INVALID_OTP`, and the build is clean.
- [ ] 1.3 `[design]` tests in `packages/shared/src/shared.test.ts`: OTP regex rejects 5 or 7 digits, letters and whitespace; `newPassword` bounds 7/8/128/129; email normalization on `forgotPasswordRequestSchema`.
- [ ] **Checkpoint 1**: build, lint, test.

## 2. OTP helpers and delivery seam

- [ ] 2.1 [PARALLEL] (Sonnet) `apps/backend/src/auth/otp.ts`: constants `OTP_TTL_MS` (10 min) and `OTP_MAX_ATTEMPTS` (5); `generateOtp()` (`randomInt(0, 1_000_000)` zero-padded to 6); `hashOtp(otp, userId, secret)` (HMAC-SHA256 hex with the `password-reset-otp:` prefix); `verifyOtp(otp, userId, secret, storedHash)` (equal-length buffers, `timingSafeEqual`); `OtpSender` interface and `consoleOtpSender` logging `[password-reset] OTP for <email>: <code>`.
- [ ] 2.2 [PARALLEL] (Haiku) `[design]` tests in `otp.test.ts`: `generateOtp` always matches `^\d{6}$` including leading zeros (mock `randomInt`); hash is deterministic for the same inputs and differs by user, by code and by secret; `verifyOtp` true for match, false for mismatch or malformed stored hash without throwing.
- [ ] **Checkpoint 2**: build, lint, test.

## 3. Forgot password

- [ ] 3.1 (Sonnet) `auth.service.ts`: add `otpSender` to `AuthServiceDeps` and `forgotPassword(email)` per D3 (unknown email: return silently; known: lock user row, invalidate unused OTPs, create row, send after commit). Add `POST /auth/forgot-password` in `auth.routes.ts` returning 202 with the fixed message. Add optional `otpSender` (default `consoleOtpSender`) to `AppDeps` and pass it through in `app.ts`.
- [ ] 3.2 (Haiku) `test-helpers.ts`: `buildTestApp()` accepts an optional sender override and by default uses a capturing sender; add `lastOtpFor(email)` and `registerUser(email, password)` helpers.
- [ ] 3.3 `apps/backend/src/auth/forgot-password.test.ts`, `describe("auth: forgot password")`:
  - [ ] OTP issued for existing account
  - [ ] OTP is a 6-digit code logged to the console (default console sender, `console.log` spy)
  - [ ] OTP is stored hashed
  - [ ] Unknown email gets the same response
  - [ ] Email is normalized
  - [ ] New request invalidates earlier OTP (needs section 4 route; assert after 4.2)
  - [ ] Malformed forgot-password body rejected
- [ ] **Checkpoint 3**: build, lint, test.

## 4. Reset password

- [ ] 4.1 (Sonnet) `auth.service.ts`: `resetPassword({ email, otp, newPassword })` per D4: hash new password first, one non-throwing transaction (lock user, latest unused OTP, expiry and attempts checks, wrong code commits `attempts + 1`, match claims the OTP, updates `passwordHash`, revokes all refresh tokens), map `invalid` to `AppError("INVALID_OTP", 400, "Invalid or expired code")`.
- [ ] 4.2 (Sonnet) `auth.routes.ts`: `POST /auth/reset-password` using `parseBody(resetPasswordRequestSchema, ...)`, 204 with no body.
- [ ] 4.3 `apps/backend/src/auth/reset-password.test.ts`, `describe("auth: reset password with OTP")`:
  - [ ] Reset with valid OTP
  - [ ] Old password stops working
  - [ ] New password is stored hashed
  - [ ] OTP is single use
  - [ ] Reset revokes all sessions
  - [ ] Wrong OTP rejected
  - [ ] Expired OTP rejected
  - [ ] OTP locks after 5 failed attempts
  - [ ] Unknown email indistinguishable
  - [ ] OTP cannot be used for another account
  - [ ] Weak new password rejected
  - [ ] Malformed OTP rejected
  - [ ] Reset leaves no partial state on failure (`vi.spyOn(prisma, "$transaction")`, `tx.refreshToken.updateMany` throws)
- [ ] 4.4 `[design]` tests: concurrent `reset-password` calls with the same correct OTP succeed exactly once; after a successful reset the user can log in and the earlier-issued access token still verifies (documented 15-min window, stateless middleware).
- [ ] **Checkpoint 4**: build, lint, test.

## 5. Error handling, docs, coverage

- [ ] 5.1 Tests in `errors.test.ts`, `describe("auth: password reset error handling and shared schemas")`:
  - [ ] No leakage in reset errors (neither submitted OTP, submitted password nor a stack trace in any error body)
- [ ] 5.2 (Haiku) Backend README: document the two endpoints, the console OTP format, that the OTP is hashed with `JWT_SECRET`, and the known gaps (no rate limit, timing gap).
- [ ] 5.3 Run `pnpm test --coverage`; confirm coverage on `auth.service.ts`, `otp.ts` and the new routes meets the DoD threshold; add `[design]` tests for any uncovered branch.
- [ ] 5.4 Confirm each of the 22 spec scenarios has exactly one test whose title matches verbatim (grep titles against `specs/auth/spec.md`), and that every status code and error code matches `delta-openapi.yaml`.
- [ ] **Checkpoint 5 (final)**: `pnpm build` (0 errors), `pnpm lint --max-warnings 0`, `pnpm test --coverage`, `openspec validate ab-1003`; manual smoke (register, forgot, read OTP from console, reset, old password and old refresh token both 401).
