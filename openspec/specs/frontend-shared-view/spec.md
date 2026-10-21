# frontend-shared-view Specification

## Purpose

Gives anyone holding a share link a public, read-only page that shows the shared note safely, without an account, and fails the same way for every kind of dead link.

## Requirements

### Requirement: Public route
The route `/shared/:token` SHALL be reachable without a session and SHALL NOT redirect a logged-in user. The page SHALL request `GET /shared/{token}` without an `Authorization` header and SHALL NOT start a session refresh.

#### Scenario: Visitor opens the page without logging in
- **WHEN** a visitor with no session opens `/shared/{token}` for a live link
- **THEN** the note is shown and the app is still on `/shared/{token}`

#### Scenario: Logged-in user is not redirected
- **WHEN** a logged-in user opens `/shared/{token}`
- **THEN** the shared note is shown and the app does not redirect to `/`

#### Scenario: No credentials are sent
- **WHEN** the page requests the note
- **THEN** the request has no `Authorization` header and no `/auth/refresh` call is made, even if it answers 401

### Requirement: Shared note display
For a live link the page SHALL show the note title as the level-1 heading, the formatted content as read-only text, and "Last updated" with the `updatedAt` time. It SHALL NOT show tags, the owner, a view count, an editor toolbar, a title input, a Save button, or session controls. The page SHALL be inside a `main` landmark.

#### Scenario: Title and content are shown
- **WHEN** the API returns a note with a title and a paragraph
- **THEN** the title is a level-1 heading and the paragraph text is shown

#### Scenario: Formatting is rendered
- **WHEN** the content has a heading, bold text and a bullet list
- **THEN** the page shows a heading element, a strong element and a list

#### Scenario: Last updated time is shown
- **WHEN** the API returns `updatedAt`
- **THEN** the page shows "Last updated" with that time

#### Scenario: Content cannot be edited
- **WHEN** the shared note is shown
- **THEN** the content is not editable and there is no toolbar, title input or Save button

#### Scenario: Nothing else about the note or owner is shown
- **WHEN** the shared note is shown
- **THEN** there are no tag chips, no log out control and no view count

#### Scenario: Page has a main landmark
- **WHEN** the shared note is shown
- **THEN** the title heading is inside a `main` landmark

### Requirement: Safe rendering
The page MUST render content through the editor schema as elements and text, never by inserting server strings as HTML. Link marks in the content SHALL NOT become anchors. Content the editor cannot render SHALL show the retryable error view, not a blank page.

#### Scenario: HTML-like text stays text
- **WHEN** a paragraph contains the text `<img src=x onerror=alert(1)>`
- **THEN** that exact text is shown and the page contains no `img` element

#### Scenario: Script-like title stays text
- **WHEN** the title is `<script>alert(1)</script>`
- **THEN** the heading shows that exact text and the page contains no `script` element from the note

#### Scenario: Links in content are not clickable
- **WHEN** the content has text with a link mark to `javascript:alert(1)`
- **THEN** the text is shown and the page contains no anchor element

#### Scenario: Unrenderable content shows the error view
- **WHEN** the content contains a node type the editor does not know
- **THEN** the error alert with **Retry** is shown and the page does not crash

### Requirement: Dead links look the same
For an unknown, revoked or expired token, a soft-deleted note, a server 400, or a token that is not 43 base64url characters, the page SHALL show the same view with the heading "This link is not available" and no other detail. A malformed token SHALL NOT trigger a request. The view SHALL NOT contain the token.

#### Scenario: Unknown, revoked and expired links look identical
- **WHEN** the API answers 404 `NOT_FOUND` for three different tokens
- **THEN** the rendered view is the same for all three

#### Scenario: Malformed token sends no request
- **WHEN** a visitor opens `/shared/short`
- **THEN** "This link is not available" is shown and no request is sent

#### Scenario: Validation error is the same view
- **WHEN** the API answers 400 `VALIDATION_ERROR` for a well-formed token
- **THEN** "This link is not available" is shown

#### Scenario: Not-available view hides the token
- **WHEN** "This link is not available" is shown for token `T`
- **THEN** the page text does not contain `T`

### Requirement: Loading and retryable errors
While the request is pending the page SHALL show "Loading note". A network error, a 5xx answer, or a 200 whose body fails the shared schema SHALL show an error alert with a **Retry** button, which requests again.

#### Scenario: Shared note loading state
- **WHEN** the request is pending
- **THEN** the text "Loading note" is shown

#### Scenario: Server error is retryable
- **WHEN** the API answers 500
- **THEN** an error alert with **Retry** is shown

#### Scenario: Network error is retryable
- **WHEN** the request fails at the network level
- **THEN** an error alert with **Retry** is shown

#### Scenario: Malformed body is retryable
- **WHEN** the API answers 200 with a body that fails the shared schema
- **THEN** an error alert with **Retry** is shown

#### Scenario: Retry loads the note
- **WHEN** the user activates **Retry** and the API now returns the note
- **THEN** the note is shown

### Requirement: One request per visit
Because the server counts every successful view, the page SHALL send exactly one `GET /shared/{token}` per visit. It SHALL NOT refetch on window focus, on reconnect, on remount of the same visit, or retry automatically after a failure. Only **Retry** requests again.

#### Scenario: One visit sends one request
- **WHEN** a visitor opens a live link
- **THEN** exactly one `GET /shared/{token}` is sent

#### Scenario: Window focus does not refetch
- **WHEN** the note is shown and the window regains focus
- **THEN** no further request is sent

#### Scenario: Failures are not retried automatically
- **WHEN** the API answers 500
- **THEN** exactly one request has been sent until the user activates **Retry**

### Requirement: Referrer protection
While the page is open it SHALL ask the browser not to send a referrer, by a `<meta name="referrer" content="no-referrer">` element in the document head, and SHALL remove that element when the page is left.

#### Scenario: Referrer policy is set while open
- **WHEN** the shared page is shown
- **THEN** the document head contains `<meta name="referrer" content="no-referrer">`

#### Scenario: Referrer policy is removed on leaving
- **WHEN** the visitor navigates away from the shared page
- **THEN** that meta element is no longer in the document head
