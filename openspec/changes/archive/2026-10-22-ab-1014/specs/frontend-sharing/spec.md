# Spec Delta

## Purpose

Lets the owner of a saved note manage its public share links from the note editor: create a link with an optional expiry, copy it, see every link with its status and view count, and revoke it.

## ADDED Requirements

### Requirement: Opening and closing the share dialog
Activating the **Share** button in the note editor SHALL open a modal dialog titled "Share this note" and request the note's share links. The dialog SHALL close on Escape or on its **Close** button, and focus SHALL return to the **Share** button. Every opening SHALL request the list again.

#### Scenario: Share button opens the dialog
- **WHEN** a user on `/notes/{id}` activates **Share**
- **THEN** a dialog titled "Share this note" is shown and `GET /notes/{id}/shares` is requested

#### Scenario: Escape closes the dialog
- **WHEN** the share dialog is open and the user presses Escape
- **THEN** the dialog is closed

#### Scenario: Close button returns focus
- **WHEN** the user activates **Close** in the share dialog
- **THEN** the dialog is closed and focus is on the **Share** button

#### Scenario: Reopening refreshes the list
- **WHEN** the user closes the share dialog and opens it again
- **THEN** `GET /notes/{id}/shares` has been requested twice

### Requirement: Share link list
The dialog SHALL list every link returned by the API in the order returned (newest first). Each row SHALL show the full URL `<origin>/shared/<token>`, a status label, the expiry ("Never expires" or "Expires <date and time>"), the view count and the creation time. While loading it SHALL show "Loading links". With no links it SHALL show "No share links yet".

#### Scenario: Share list loading state
- **WHEN** the share dialog is open and the list request is pending
- **THEN** the text "Loading links" is shown

#### Scenario: Empty list
- **WHEN** the API returns no links
- **THEN** the text "No share links yet" is shown

#### Scenario: Links are listed in server order
- **WHEN** the API returns three links
- **THEN** three rows are shown in the same order

#### Scenario: Row shows the full URL
- **WHEN** a link has token `T`
- **THEN** its row shows the URL `<origin>/shared/T`

#### Scenario: Row shows view count
- **WHEN** a link has `viewCount` 3
- **THEN** its row shows the view count 3

#### Scenario: Never-expiring link
- **WHEN** a link has `expiresAt` null
- **THEN** its row shows "Never expires"

#### Scenario: Link with an expiry
- **WHEN** a link has an `expiresAt` instant
- **THEN** its row shows "Expires" followed by that date and time

#### Scenario: List request fails
- **WHEN** the list request fails with a server or network error
- **THEN** an error alert with a **Retry** button is shown and no rows are shown

#### Scenario: Retry reloads the list
- **WHEN** the user activates **Retry** after a failed list request and the API now succeeds
- **THEN** the links are shown

#### Scenario: Malformed list response is an error
- **WHEN** the list response body does not match the shared schema
- **THEN** the same error alert with **Retry** is shown

### Requirement: Link status
The status of a link SHALL be derived from its `revokedAt` and `expiresAt`: Revoked when `revokedAt` is set, otherwise Expired when `expiresAt` is not in the future, otherwise Active. The status SHALL be shown as a text label, never by colour alone.

#### Scenario: Active link without expiry
- **WHEN** a link has `revokedAt` null and `expiresAt` null
- **THEN** its status label is "Active"

#### Scenario: Active link with a future expiry
- **WHEN** a link has `revokedAt` null and an `expiresAt` in the future
- **THEN** its status label is "Active"

#### Scenario: Expired link
- **WHEN** a link has `revokedAt` null and an `expiresAt` in the past
- **THEN** its status label is "Expired"

#### Scenario: Revoked link
- **WHEN** a link has `revokedAt` set
- **THEN** its status label is "Revoked"

#### Scenario: Revoked wins over expired
- **WHEN** a link has `revokedAt` set and an `expiresAt` in the past
- **THEN** its status label is "Revoked"

### Requirement: Create a share link
The dialog SHALL contain an optional input labelled "Expires at (optional)" and a **Create link** button. Without an expiry it SHALL send `POST /notes/{id}/shares` with no `expiresAt`. With an expiry it SHALL send `expiresAt` as the ISO UTC instant of the local date and time entered. An expiry that is not in the future SHALL be rejected in the browser before any request. At most one create request SHALL be in flight.

#### Scenario: Create without expiry
- **WHEN** the user leaves the expiry empty and activates **Create link**
- **THEN** a `POST /notes/{id}/shares` is sent without `expiresAt` and the new link appears in the list

#### Scenario: Create with expiry
- **WHEN** the user enters a local date and time one day ahead and activates **Create link**
- **THEN** the request body `expiresAt` is the ISO UTC instant of that local time

#### Scenario: Past expiry is rejected in the browser
- **WHEN** the user enters a date and time in the past and activates **Create link**
- **THEN** the message "Expiry must be in the future" is shown on the input and no request is sent

#### Scenario: Server validation error is shown on the input
- **WHEN** the API answers 400 `VALIDATION_ERROR` with a detail for `expiresAt`
- **THEN** that message is shown on the input and no link is added

#### Scenario: Successful create is announced
- **WHEN** a link is created
- **THEN** a status message "Link created" is announced

#### Scenario: Input is cleared after success
- **WHEN** a link is created with an expiry
- **THEN** the expiry input is empty again

#### Scenario: Several links can be created
- **WHEN** the user creates two links in a row
- **THEN** both are listed with different URLs

#### Scenario: Double activation sends one request
- **WHEN** the user activates **Create link** twice before the first response
- **THEN** exactly one `POST /notes/{id}/shares` is sent

#### Scenario: Create failure keeps the input
- **WHEN** the create request fails with a server or network error
- **THEN** an error alert is shown, the expiry input keeps its value, and **Create link** is enabled again

#### Scenario: Note gone while creating
- **WHEN** the create request answers 404 `NOT_FOUND`
- **THEN** the dialog shows "This note is no longer available" and no create controls

### Requirement: Copy a share link
Each Active row SHALL have a **Copy** button that writes the full URL to the clipboard and announces "Copied". If the clipboard cannot be written, the dialog SHALL show "Couldn't copy. Select the link and copy it manually." and the URL SHALL remain selectable text. Expired and Revoked rows SHALL NOT offer **Copy**.

#### Scenario: Copy writes the URL
- **WHEN** the user activates **Copy** on an Active row
- **THEN** the clipboard receives `<origin>/shared/<token>` and "Copied" is announced

#### Scenario: Clipboard failure is reported
- **WHEN** writing to the clipboard is rejected
- **THEN** the message "Couldn't copy. Select the link and copy it manually." is shown and the URL text is still present

#### Scenario: No Copy on expired links
- **WHEN** a row is Expired
- **THEN** it has no **Copy** button

#### Scenario: No Copy on revoked links
- **WHEN** a row is Revoked
- **THEN** it has no **Copy** button

### Requirement: Revoke a share link
Each Active row SHALL have a **Revoke** button. Activating it SHALL show an inline "Revoke this link?" confirm with **Confirm revoke** and **Cancel** and send nothing. Confirming SHALL send `DELETE /notes/{id}/shares/{shareId}`; on success the row SHALL show Revoked with its view count unchanged and without **Copy** or **Revoke**. A 404 SHALL be treated as success. Other failures SHALL keep the link Active and show an error alert.

#### Scenario: Revoke asks for confirmation
- **WHEN** the user activates **Revoke** on an Active row
- **THEN** "Revoke this link?" with **Confirm revoke** and **Cancel** is shown and no request is sent

#### Scenario: Cancel keeps the link active
- **WHEN** the user activates **Cancel** in the revoke confirm
- **THEN** the row stays Active and no request is sent

#### Scenario: Confirmed revoke marks the row revoked
- **WHEN** the user confirms and the API answers 204
- **THEN** the row shows "Revoked" with the same view count and has no **Copy** or **Revoke** button, and "Link revoked" is announced

#### Scenario: Only active rows offer revoke
- **WHEN** the list has an Active, an Expired and a Revoked row
- **THEN** only the Active row has a **Revoke** button

#### Scenario: Revoke of an already revoked link counts as success
- **WHEN** the user confirms a revoke and the API answers 404 `NOT_FOUND`
- **THEN** the list is requested again and no error alert is shown

#### Scenario: Revoke failure keeps the link active
- **WHEN** the user confirms a revoke and the API answers 500
- **THEN** an error alert is shown and the row stays Active

#### Scenario: Double confirm sends one request
- **WHEN** the user activates **Confirm revoke** twice before the response
- **THEN** exactly one `DELETE` is sent

### Requirement: Authorization and session handling
The share calls SHALL use the bearer session. A 401 SHALL trigger one refresh and one retry of the same call. If the refresh is rejected the session SHALL be cleared and the user sent to `/login`. A 404 on the list SHALL show "This note is no longer available" and no controls, so another user's note is indistinguishable from a missing one.

#### Scenario: Expired access token is refreshed
- **WHEN** the list request answers 401 and the refresh succeeds
- **THEN** the list request is retried once with the new token and the links are shown

#### Scenario: Rejected refresh ends the session while sharing
- **WHEN** the list request answers 401 and the refresh is rejected
- **THEN** the session is cleared and the user is on `/login`

#### Scenario: Another user's note is not available
- **WHEN** the list request answers 404 `NOT_FOUND`
- **THEN** the dialog shows "This note is no longer available" and no create controls or rows

### Requirement: Unsaved-edits notice
While the editor holds unsaved changes the dialog SHALL show "Unsaved changes are not shared. Save the note to update the shared view." Opening the dialog or creating a link SHALL NOT save the note, navigate, or show the discard-changes prompt.

#### Scenario: Notice shown with unsaved changes
- **WHEN** the user edits the title and opens the share dialog
- **THEN** the notice "Unsaved changes are not shared. Save the note to update the shared view." is shown

#### Scenario: No notice for a clean editor
- **WHEN** the user opens the share dialog without editing
- **THEN** the notice is not shown

#### Scenario: Sharing does not save or block
- **WHEN** the user edits the title, opens the dialog and creates a link
- **THEN** no `PATCH /notes/{id}` is sent and no discard-changes prompt is shown

### Requirement: Sharing API functions and cache
The frontend SHALL provide functions for create, list and revoke over the `request()` client, with bodies and responses validated by the shared sharing schemas, and a public-note function that sends no credentials. List data SHALL be cached under the key `["shares", noteId]`; creating or revoking a link SHALL refresh it.

#### Scenario: Create sends no body without expiry
- **WHEN** the create function is called without an expiry
- **THEN** it sends `POST /notes/{id}/shares` with the bearer token and no `expiresAt`

#### Scenario: Create sends the expiry
- **WHEN** the create function is called with an ISO instant
- **THEN** the request body is `{ expiresAt }` with that instant

#### Scenario: List returns validated links
- **WHEN** the list function receives a valid response
- **THEN** it returns the `items` array of share links

#### Scenario: Revoke sends delete
- **WHEN** the revoke function is called
- **THEN** it sends `DELETE /notes/{id}/shares/{shareId}` with the bearer token

#### Scenario: Public note function sends no credentials
- **WHEN** the public-note function is called with a token
- **THEN** it sends `GET /shared/{token}` without an `Authorization` header and returns the validated note

#### Scenario: Create refreshes the share list
- **WHEN** a link is created
- **THEN** `GET /notes/{id}/shares` is requested again

#### Scenario: Revoke refreshes the share list
- **WHEN** a link is revoked
- **THEN** `GET /notes/{id}/shares` is requested again

### Requirement: Share dialog accessibility
The dialog SHALL be a labelled modal that traps focus. Every control SHALL have an accessible name, and the **Revoke**, **Confirm revoke** and **Copy** buttons SHALL include the creation time of their link in the name so they can be told apart. Outcomes SHALL be announced in a polite status region.

#### Scenario: Dialog is labelled and modal
- **WHEN** the share dialog is open
- **THEN** it has role `dialog`, `aria-modal` true and the accessible name "Share this note"

#### Scenario: Row buttons identify their link
- **WHEN** the list has two Active rows
- **THEN** the two **Copy** buttons have different accessible names and so do the two **Revoke** buttons

#### Scenario: Expiry input has a label
- **WHEN** the share dialog is open
- **THEN** the input is reachable by the label "Expires at (optional)"
