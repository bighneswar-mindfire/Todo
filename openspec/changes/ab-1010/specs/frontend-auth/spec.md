## ADDED Requirements

### Requirement: API client
The frontend SHALL call the backend only through a typed API client under `src/api`. The client SHALL use the Zod schemas and types from `@todo/shared`, SHALL send JSON, SHALL attach `Authorization: Bearer <accessToken>` to authenticated requests, and SHALL turn a non-2xx response into an `ApiError` carrying the HTTP status, the backend error `code`, `message` and `details`. All requests SHALL go to the `/api` base path.

#### Scenario: Bearer token attached
- **WHEN** an authenticated request is made while a session exists
- **THEN** the request carries `Authorization: Bearer <accessToken>` from the session store

#### Scenario: Public requests carry no token
- **WHEN** `register`, `login`, `forgot-password` or `reset-password` is called
- **THEN** the request has no `Authorization` header

#### Scenario: Error envelope becomes ApiError
- **WHEN** the backend answers 409 with `{ error: { code: "EMAIL_TAKEN", message } }`
- **THEN** the client throws an `ApiError` with status 409, code `EMAIL_TAKEN` and that message

#### Scenario: Validation details preserved
- **WHEN** the backend answers 400 `VALIDATION_ERROR` with `details`
- **THEN** the thrown `ApiError` exposes each `{ field, message }` pair

#### Scenario: Network failure is reported
- **WHEN** `fetch` rejects because the server is unreachable
- **THEN** the client throws an `ApiError` with code `NETWORK_ERROR` and no HTTP status

#### Scenario: Empty success response
- **WHEN** the backend answers 204 with no body
- **THEN** the client resolves without trying to parse JSON

### Requirement: Session store and persistence
The frontend SHALL keep `accessToken`, `refreshToken` and `user` in a Zustand store persisted to `localStorage`. The session SHALL survive a page reload. Clearing the session SHALL remove all three values from the store and from `localStorage`.

#### Scenario: Session set after login
- **WHEN** a login succeeds
- **THEN** the store holds the returned tokens and user and `isAuthenticated` is true

#### Scenario: Session restored after reload
- **WHEN** `localStorage` already holds a persisted session as the app starts
- **THEN** the store is hydrated from it and the user is treated as signed in

#### Scenario: Corrupt persisted session ignored
- **WHEN** the persisted session value is not valid JSON or fails schema validation
- **THEN** the store starts signed out and the app does not crash

#### Scenario: Clear session
- **WHEN** the session is cleared
- **THEN** the store is empty and `localStorage` holds no tokens

### Requirement: Silent token refresh
When an authenticated request returns 401, the client SHALL call `POST /auth/refresh` with the stored refresh token, store the new token pair and retry the original request exactly once. Concurrent 401s SHALL share a single in-flight refresh call. If the server rejects the refresh (4xx) or the retry returns 401 again, the client SHALL clear the session and the app SHALL navigate to `/login`. A refresh that fails without a server rejection (network error or 5xx) SHALL keep the session.

#### Scenario: Expired access token refreshed transparently
- **WHEN** an authenticated request returns 401 and `/auth/refresh` returns 200
- **THEN** the new tokens are stored and the original request is retried with the new access token, and the caller receives the retry result

#### Scenario: Concurrent 401s refresh once
- **WHEN** three authenticated requests return 401 at the same time
- **THEN** `/auth/refresh` is called exactly once and all three requests are retried with the new access token

#### Scenario: Failed refresh signs the user out
- **WHEN** an authenticated request returns 401 and `/auth/refresh` returns 401 `INVALID_REFRESH_TOKEN`
- **THEN** the session is cleared and the app is on `/login`

#### Scenario: Unreachable refresh keeps the session
- **WHEN** an authenticated request returns 401 and the `/auth/refresh` call fails with a network error
- **THEN** the session is kept and the caller receives an `ApiError` with code `NETWORK_ERROR`

#### Scenario: Refresh server error keeps the session
- **WHEN** an authenticated request returns 401 and `/auth/refresh` returns 500
- **THEN** the session is kept and the caller receives an `ApiError` with status 500

#### Scenario: Retry is not repeated
- **WHEN** the retried request returns 401 again after a successful refresh
- **THEN** no second refresh is attempted, the session is cleared and the app is on `/login`

#### Scenario: Public endpoints never trigger refresh
- **WHEN** `login` returns 401 `INVALID_CREDENTIALS`
- **THEN** `/auth/refresh` is not called and the `ApiError` reaches the form

### Requirement: Route protection
The app SHALL guard routes by session state. Protected routes SHALL redirect a signed-out visitor to `/login` and remember the requested location. Auth routes (`/login`, `/register`, `/forgot-password`, `/reset-password`) SHALL redirect a signed-in user to `/`. Unknown paths SHALL show a not-found page.

#### Scenario: Signed-out visitor redirected to login
- **WHEN** a signed-out visitor opens `/`
- **THEN** the app shows the login page at `/login`

#### Scenario: Return to requested page after login
- **WHEN** a signed-out visitor is redirected from a protected path and then logs in
- **THEN** the app navigates back to the originally requested path

#### Scenario: Signed-in user skips auth pages
- **WHEN** a signed-in user opens `/login`
- **THEN** the app redirects to `/`

#### Scenario: Unknown route
- **WHEN** a user opens a path that matches no route
- **THEN** a not-found page with a link to `/` is shown

### Requirement: Registration screen
The `/register` page SHALL let a visitor create an account with an email and password via `POST /auth/register`. Fields SHALL be validated on the client with `registerRequestSchema` before any request is sent. On success the app SHALL navigate to `/login` with an "account created" notice. No session SHALL be created.

#### Scenario: Successful registration
- **WHEN** a visitor submits a valid email and a password of 8 or more characters and the API answers 201
- **THEN** the app navigates to `/login` and shows the "account created" notice, and the store has no session

#### Scenario: Invalid email blocked on the client
- **WHEN** a visitor submits a malformed email
- **THEN** an inline error is shown on the email field and no request is sent

#### Scenario: Short password blocked on the client
- **WHEN** a visitor submits a password shorter than 8 characters
- **THEN** an inline error is shown on the password field and no request is sent

#### Scenario: Email already taken
- **WHEN** the API answers 409 `EMAIL_TAKEN`
- **THEN** an inline error "Email already registered" is shown on the email field and the visitor stays on `/register`

#### Scenario: Server validation details shown per field
- **WHEN** the API answers 400 `VALIDATION_ERROR` with a `details` entry for `password`
- **THEN** that message is shown on the password field

#### Scenario: Submit disabled while pending
- **WHEN** a registration request is in flight
- **THEN** the submit button is disabled so the form cannot be submitted twice

### Requirement: Login screen
The `/login` page SHALL authenticate a user via `POST /auth/login`, store the returned session and navigate to the originally requested path or `/`. Authentication failures SHALL show one generic message that does not reveal whether the email exists. The page SHALL show the notice passed by registration or password reset.

#### Scenario: Successful login
- **WHEN** a user submits valid credentials and the API answers 200
- **THEN** the session is stored and the app navigates to `/`

#### Scenario: Wrong credentials
- **WHEN** the API answers 401 `INVALID_CREDENTIALS`
- **THEN** a single form-level alert "Invalid email or password" is shown, no session is stored and the user stays on `/login`

#### Scenario: Same message for unknown email
- **WHEN** the API answers 401 `INVALID_CREDENTIALS` for an unregistered email
- **THEN** the alert text is identical to the wrong-password case

#### Scenario: Empty fields blocked on the client
- **WHEN** a user submits with an empty email or password
- **THEN** inline field errors are shown and no request is sent

#### Scenario: Unexpected server error
- **WHEN** the API answers 500 or the network fails
- **THEN** a generic "Something went wrong, please try again" alert is shown and the form stays usable

#### Scenario: Notice after registration
- **WHEN** the user arrives from a successful registration
- **THEN** the "account created, please log in" notice is visible

### Requirement: Forgot password screen
The `/forgot-password` page SHALL submit an email to `POST /auth/forgot-password`. For any 202 response it SHALL show the same confirmation and continue to `/reset-password` with the email prefilled, whether or not the account exists. It SHALL tell the user that, with no email service, the code is printed in the server console.

#### Scenario: Request accepted
- **WHEN** a user submits a valid email and the API answers 202
- **THEN** the app navigates to `/reset-password` with the email prefilled and the generic confirmation shown

#### Scenario: Same outcome for unknown email
- **WHEN** the API answers 202 for an email with no account
- **THEN** the UI behaves exactly as for a known email

#### Scenario: Malformed email blocked
- **WHEN** a user submits a malformed email
- **THEN** an inline error is shown and no request is sent

#### Scenario: Console hint visible
- **WHEN** the `/forgot-password` page renders
- **THEN** it states that the one-time code is logged to the server console

### Requirement: Reset password screen
The `/reset-password` page SHALL submit email, OTP and new password to `POST /auth/reset-password`, validated on the client with `resetPasswordRequestSchema`. On 204 the app SHALL navigate to `/login` with a "password changed" notice. Every OTP failure SHALL show the same message.

#### Scenario: Successful reset
- **WHEN** a user submits a valid email, a 6-digit OTP and a new password of 8 or more characters and the API answers 204
- **THEN** the app navigates to `/login` and shows the "password changed" notice

#### Scenario: Non-numeric OTP blocked
- **WHEN** a user enters an OTP that is not exactly 6 digits
- **THEN** an inline error is shown on the OTP field and no request is sent

#### Scenario: Short new password blocked
- **WHEN** a user enters a new password shorter than 8 characters
- **THEN** an inline error is shown on the password field and no request is sent

#### Scenario: Invalid or expired OTP
- **WHEN** the API answers 400 `INVALID_OTP`
- **THEN** a form-level alert "Invalid or expired code" is shown and the user stays on `/reset-password` with the fields kept

#### Scenario: Email prefilled from previous step
- **WHEN** the user arrives from `/forgot-password`
- **THEN** the email field already contains the submitted email

### Requirement: Logout
The home page SHALL offer a **Log out** button. Logging out SHALL call `POST /auth/logout` with the refresh token, and SHALL clear the session and the TanStack Query cache and navigate to `/login` whether or not that call succeeds.

#### Scenario: Logout revokes and clears
- **WHEN** a signed-in user clicks Log out and the API answers 204
- **THEN** the session and query cache are cleared and the app is on `/login`

#### Scenario: Logout succeeds locally when the API fails
- **WHEN** the logout request fails with a network error or 500
- **THEN** the session is still cleared and the app is on `/login`

#### Scenario: Home shows the signed-in user
- **WHEN** a signed-in user opens `/`
- **THEN** the page shows their email

### Requirement: Foundation and accessibility baseline
The frontend SHALL be wired with TanStack Query, Zustand, shadcn/ui and the router, and the dev server SHALL proxy `/api` to the backend. Every form control SHALL have an associated label, and form-level errors SHALL be announced with `role="alert"`.

#### Scenario: Providers mounted
- **WHEN** the app renders
- **THEN** components can use `useQuery`, `useMutation` and the session store without extra setup

#### Scenario: Labelled inputs
- **WHEN** any auth page renders
- **THEN** each input is reachable by its label text

#### Scenario: Errors announced
- **WHEN** a form-level error is shown
- **THEN** it is rendered in an element with `role="alert"`

#### Scenario: Dev proxy strips the prefix
- **WHEN** the dev server receives `GET /api/health`
- **THEN** it forwards to the backend as `GET /health`
