## ADDED Requirements

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
