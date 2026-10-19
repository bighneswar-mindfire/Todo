# auth Specification

## Purpose
TBD - created by archiving change ab-1002. Update Purpose after archive.

## Requirements

### Requirement: User registration
The system SHALL let a visitor create an account with an email and password via `POST /auth/register`. Emails SHALL be trimmed, lowercased and unique. Passwords SHALL be 8 to 128 characters and SHALL be stored only as a salted hash.

#### Scenario: Register with valid credentials
- **WHEN** a client posts a valid email and a password of 8 or more characters to `/auth/register`
- **THEN** the response is 201 with the user `id`, `email` and `createdAt`, and the body contains no password or hash

#### Scenario: Email is normalized
- **WHEN** a client registers with `"  Alice@Example.COM "`
- **THEN** the response is 201 and the returned and stored email is `alice@example.com`

#### Scenario: Password is stored hashed
- **WHEN** a user registers successfully
- **THEN** the `passwordHash` column differs from the submitted password and verifies against it

#### Scenario: Duplicate email rejected
- **WHEN** a client registers with an email that already exists, in any letter case
- **THEN** the response is 409 with error code `EMAIL_TAKEN` and no second user is created

#### Scenario: Invalid email rejected
- **WHEN** a client registers with a malformed email
- **THEN** the response is 400 with error code `VALIDATION_ERROR`

#### Scenario: Short password rejected
- **WHEN** a client registers with a password shorter than 8 characters
- **THEN** the response is 400 with error code `VALIDATION_ERROR`

#### Scenario: Overlong password rejected
- **WHEN** a client registers with a password longer than 128 characters
- **THEN** the response is 400 with error code `VALIDATION_ERROR`

### Requirement: User login
The system SHALL authenticate a user via `POST /auth/login` and issue a JWT access token valid for 15 minutes and an opaque refresh token valid for 7 days. Only a hash of the refresh token SHALL be stored in the database.

#### Scenario: Login with correct credentials
- **WHEN** a registered user posts the correct email and password to `/auth/login`
- **THEN** the response is 200 with `accessToken`, `refreshToken` and the user, and the body contains no password hash

#### Scenario: Email matching is case-insensitive
- **WHEN** a registered user logs in with their email in different letter case
- **THEN** the response is 200

#### Scenario: Access token claims and lifetime
- **WHEN** login succeeds
- **THEN** the access token is a JWT whose `sub` is the user id and whose `exp` is 15 minutes after `iat`

#### Scenario: Refresh token persisted as hash with 7-day expiry
- **WHEN** login succeeds
- **THEN** a `RefreshToken` row exists for the user with `expiresAt` 7 days ahead, `revokedAt` null, and a `tokenHash` that is not equal to the returned `refreshToken`

#### Scenario: Wrong password rejected
- **WHEN** a registered user posts an incorrect password
- **THEN** the response is 401 with error code `INVALID_CREDENTIALS` and no refresh token row is created

#### Scenario: Unknown email rejected identically
- **WHEN** a client posts an email that is not registered
- **THEN** the response is 401 with error code `INVALID_CREDENTIALS` and the same message as for a wrong password

#### Scenario: Malformed login body rejected
- **WHEN** a client posts a login body with a missing or non-string email or password
- **THEN** the response is 400 with error code `VALIDATION_ERROR`

### Requirement: Token refresh with rotation
The system SHALL exchange a valid refresh token for a new access token and a new refresh token via `POST /auth/refresh`. The presented refresh token SHALL be revoked on use. Presenting an already-revoked refresh token SHALL revoke all of that user's refresh tokens.

#### Scenario: Refresh with valid token
- **WHEN** a client posts an unexpired, unrevoked refresh token to `/auth/refresh`
- **THEN** the response is 200 with a new `accessToken` and a new `refreshToken` different from the one presented

#### Scenario: Old token is revoked after rotation
- **WHEN** a refresh token has been used once successfully and is then presented again
- **THEN** the response is 401 with error code `INVALID_REFRESH_TOKEN`

#### Scenario: Reuse revokes the whole session family
- **WHEN** an already-revoked refresh token is presented
- **THEN** every refresh token of that user is revoked, and the newer token issued by the earlier rotation is rejected with 401 `INVALID_REFRESH_TOKEN`

#### Scenario: Unknown refresh token rejected
- **WHEN** a client posts a refresh token that was never issued
- **THEN** the response is 401 with error code `INVALID_REFRESH_TOKEN`

#### Scenario: Expired refresh token rejected
- **WHEN** a client posts a refresh token whose `expiresAt` is in the past
- **THEN** the response is 401 with error code `INVALID_REFRESH_TOKEN`

#### Scenario: Missing refresh token rejected
- **WHEN** a client posts `/auth/refresh` without a `refreshToken` string
- **THEN** the response is 400 with error code `VALIDATION_ERROR`

### Requirement: Logout
The system SHALL revoke the supplied refresh token via `POST /auth/logout`, which SHALL require a valid access token. Logout SHALL be idempotent.

#### Scenario: Logout revokes the refresh token
- **WHEN** an authenticated user posts their refresh token to `/auth/logout`
- **THEN** the response is 204 and `/auth/refresh` with that token then returns 401 `INVALID_REFRESH_TOKEN`

#### Scenario: Logout is idempotent
- **WHEN** an authenticated user posts a refresh token that is already revoked or unknown to `/auth/logout`
- **THEN** the response is 204

#### Scenario: Cannot revoke another user's token
- **WHEN** an authenticated user posts a refresh token belonging to a different user to `/auth/logout`
- **THEN** the response is 204 and the other user's refresh token remains valid

#### Scenario: Logout without refresh token rejected
- **WHEN** an authenticated user posts `/auth/logout` without a `refreshToken` string
- **THEN** the response is 400 with error code `VALIDATION_ERROR`

### Requirement: Access token verification
The system SHALL provide an `authenticate` middleware that accepts only a valid, unexpired, correctly signed `Authorization: Bearer <accessToken>` header and otherwise responds 401 with error code `UNAUTHORIZED`. Access to protected routes SHALL never be granted by a refresh token.

#### Scenario: Valid access token accepted
- **WHEN** a request to a protected route carries a valid access token
- **THEN** the request proceeds with the authenticated user id from `sub`

#### Scenario: Missing Authorization header
- **WHEN** a request to a protected route has no `Authorization` header
- **THEN** the response is 401 with error code `UNAUTHORIZED`

#### Scenario: Malformed Authorization header
- **WHEN** a request to a protected route sends an `Authorization` header that is not `Bearer <token>`
- **THEN** the response is 401 with error code `UNAUTHORIZED`

#### Scenario: Tampered access token
- **WHEN** a request carries an access token signed with a different secret
- **THEN** the response is 401 with error code `UNAUTHORIZED`

#### Scenario: Expired access token
- **WHEN** a request carries an otherwise valid access token whose `exp` is in the past
- **THEN** the response is 401 with error code `UNAUTHORIZED`

#### Scenario: Refresh token rejected as access token
- **WHEN** a request presents a refresh token in the Bearer header
- **THEN** the response is 401 with error code `UNAUTHORIZED`

### Requirement: Error envelope
All error responses from auth endpoints SHALL use the body `{ "error": { "code", "message", "details"? } }`, and validation failures SHALL list the offending fields in `details`.

#### Scenario: Validation error shape
- **WHEN** any auth endpoint rejects a request with 400
- **THEN** the body matches the shared error schema and `details` names each invalid field

#### Scenario: No credential leakage in errors
- **WHEN** any auth endpoint returns an error
- **THEN** the body contains neither the submitted password, any token, nor a stack trace

### Requirement: Auth configuration and shared schemas
The access-token signing secret SHALL come from the `JWT_SECRET` environment variable (minimum 32 characters), and all auth request and response schemas SHALL be defined only in `packages/shared`.

#### Scenario: Missing secret fails startup
- **WHEN** the backend environment is parsed without `JWT_SECRET` or with fewer than 32 characters
- **THEN** startup fails with a validation error naming `JWT_SECRET`

#### Scenario: Backend consumes shared auth schemas
- **WHEN** the backend validates a register, login, refresh or logout body
- **THEN** it uses the Zod schemas exported from `@todo/shared` and `pnpm build` succeeds with 0 errors

### Requirement: Forgot password
The system SHALL accept an email via `POST /auth/forgot-password` and, when an account with that email exists, generate a 6-digit numeric OTP valid for 10 minutes, store only a hash of it, and log it to the server console. The response SHALL be 202 with the same body whether or not the account exists, and SHALL never contain the OTP. Requesting a new OTP SHALL invalidate all earlier unused OTPs of that user.

#### Scenario: OTP issued for existing account
- **WHEN** a client posts the email of a registered user to `/auth/forgot-password`
- **THEN** the response is 202 with the generic message, and a `PasswordResetOtp` row exists for the user with `attempts` 0, `usedAt` null and `expiresAt` 10 minutes ahead

#### Scenario: OTP is a 6-digit code logged to the console
- **WHEN** an OTP is issued
- **THEN** exactly one console log line contains the user's email and a code matching `^\d{6}$`

#### Scenario: OTP is stored hashed
- **WHEN** an OTP is issued
- **THEN** the stored `otpHash` is not equal to the logged code and the code does not appear in the response body

#### Scenario: Unknown email gets the same response
- **WHEN** a client posts an email that is not registered to `/auth/forgot-password`
- **THEN** the response status and body equal those for a registered email, no `PasswordResetOtp` row is created and nothing is logged

#### Scenario: Email is normalized
- **WHEN** a client posts `"  ALICE@Example.com "` for the registered user `alice@example.com`
- **THEN** the response is 202 and an OTP is issued for that user

#### Scenario: New request invalidates earlier OTP
- **WHEN** a user requests a second OTP while the first is unused
- **THEN** the first OTP is rejected at reset with 400 `INVALID_OTP` and the second one is accepted

#### Scenario: Malformed forgot-password body rejected
- **WHEN** a client posts a missing, non-string or malformed email to `/auth/forgot-password`
- **THEN** the response is 400 with error code `VALIDATION_ERROR` and no row is created

### Requirement: Reset password with OTP
The system SHALL let a client set a new password via `POST /auth/reset-password` with `email`, `otp` and `newPassword`, only when the OTP is the user's latest, unexpired, unused one with fewer than 5 failed attempts. On success the system SHALL, atomically, store the new salted password hash, mark the OTP used and revoke every refresh token of that user. Success SHALL return 204 and SHALL NOT issue tokens.

#### Scenario: Reset with valid OTP
- **WHEN** a client posts the correct email, OTP and a valid new password
- **THEN** the response is 204 and the user can log in with the new password

#### Scenario: Old password stops working
- **WHEN** a password has been reset
- **THEN** login with the old password returns 401 `INVALID_CREDENTIALS`

#### Scenario: New password is stored hashed
- **WHEN** a reset succeeds
- **THEN** the `passwordHash` column differs from the submitted password and verifies against it

#### Scenario: OTP is single use
- **WHEN** an OTP has been used successfully and is submitted again
- **THEN** the response is 400 with error code `INVALID_OTP` and the password is unchanged

#### Scenario: Reset revokes all sessions
- **WHEN** a user with active refresh tokens completes a reset
- **THEN** every refresh token of that user has `revokedAt` set and `/auth/refresh` with any of them returns 401 `INVALID_REFRESH_TOKEN`

#### Scenario: Wrong OTP rejected
- **WHEN** a client posts a wrong OTP for a registered email
- **THEN** the response is 400 with error code `INVALID_OTP`, the OTP row's `attempts` increases by 1 and the password is unchanged

#### Scenario: Expired OTP rejected
- **WHEN** a client posts the correct OTP after its `expiresAt`
- **THEN** the response is 400 with error code `INVALID_OTP` and the password is unchanged

#### Scenario: OTP locks after 5 failed attempts
- **WHEN** a client has submitted 5 wrong OTPs for the active OTP and then submits the correct one
- **THEN** the response is 400 with error code `INVALID_OTP` and the password is unchanged

#### Scenario: Unknown email indistinguishable
- **WHEN** a client posts a reset for an email that is not registered
- **THEN** the response is 400 with error code `INVALID_OTP` and the same message as for a wrong OTP

#### Scenario: OTP cannot be used for another account
- **WHEN** a client posts user A's valid OTP together with user B's email
- **THEN** the response is 400 with error code `INVALID_OTP` and neither password changes

#### Scenario: Weak new password rejected
- **WHEN** a client posts a valid OTP with a new password shorter than 8 or longer than 128 characters
- **THEN** the response is 400 with error code `VALIDATION_ERROR`, the password is unchanged and the OTP is not consumed

#### Scenario: Malformed OTP rejected
- **WHEN** a client posts an `otp` that is missing, non-string or not exactly 6 digits
- **THEN** the response is 400 with error code `VALIDATION_ERROR`

#### Scenario: Reset leaves no partial state on failure
- **WHEN** persisting the new password fails mid-reset
- **THEN** the OTP stays unused and no refresh token is revoked

### Requirement: Password reset error handling and shared schemas
Password-reset errors SHALL use the shared error envelope with the new code `INVALID_OTP` and SHALL NOT reveal whether the account exists, which condition failed, or contain the OTP, the submitted password or a stack trace. All request and response schemas for these endpoints SHALL be defined only in `packages/shared`.

#### Scenario: No leakage in reset errors
- **WHEN** `/auth/forgot-password` or `/auth/reset-password` returns an error
- **THEN** the body matches the shared error schema and contains neither the submitted OTP, the submitted password nor a stack trace

#### Scenario: Backend consumes shared schemas
- **WHEN** the backend validates a forgot-password or reset-password body
- **THEN** it uses the Zod schemas exported from `@todo/shared`, `errorCodeSchema` includes `INVALID_OTP`, and `pnpm build` succeeds with 0 errors
