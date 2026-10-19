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
