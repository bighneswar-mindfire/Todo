# frontend-version-history Specification

## Purpose

Lets the owner of a saved note browse its recorded versions from the note editor, preview any of them read-only, and restore one as a new version, without leaving the editor.

## Requirements

### Requirement: Opening and closing the history drawer
Activating the **History** button in the note editor SHALL open a modal drawer titled "Version history" and request the first page of the note's versions. The drawer SHALL close on Escape or on its **Close** button, and focus SHALL return to the **History** button. Every opening SHALL request the list again.

#### Scenario: History button opens the drawer
- **WHEN** a user on `/notes/{id}` activates **History**
- **THEN** a drawer titled "Version history" is shown and `GET /notes/{id}/versions?page=1&limit=20` is requested

#### Scenario: Escape closes the drawer
- **WHEN** the history drawer is open and the user presses Escape
- **THEN** the drawer is closed

#### Scenario: Close button returns focus to History
- **WHEN** the user activates **Close** in the history drawer
- **THEN** the drawer is closed and focus is on the **History** button

#### Scenario: Reopening refreshes the version list
- **WHEN** the user closes the history drawer and opens it again
- **THEN** `GET /notes/{id}/versions?page=1&limit=20` has been requested twice

### Requirement: Version list
The drawer SHALL list the versions returned by the API in the order returned (newest first). Each row SHALL show the version number, the title, the excerpt and the creation time. The newest version SHALL be labelled "Current". While loading it SHALL show "Loading versions". With no versions it SHALL show "No earlier versions yet".

#### Scenario: Version list loading state
- **WHEN** the history drawer is open and the list request is pending
- **THEN** the text "Loading versions" is shown

#### Scenario: Empty history
- **WHEN** the API returns no versions
- **THEN** the text "No earlier versions yet" is shown

#### Scenario: Versions are listed in server order
- **WHEN** the API returns versions 3, 2 and 1
- **THEN** three rows are shown in the order 3, 2, 1

#### Scenario: Row shows summary fields
- **WHEN** the API returns a version with a title, an excerpt and a creation time
- **THEN** its row shows "Version 3", the title, the excerpt and the creation time

#### Scenario: Newest version is labelled Current
- **WHEN** the API returns versions 3, 2 and 1
- **THEN** only the row for version 3 is labelled "Current"

#### Scenario: Version list request fails
- **WHEN** the list request answers 500
- **THEN** the drawer shows the alert "Couldn't load the version history" with a **Retry** button and no rows

#### Scenario: Retry reloads the version list
- **WHEN** the list request failed and the user activates **Retry** and the next response is valid
- **THEN** the version rows are shown

#### Scenario: Malformed version list response is an error
- **WHEN** the list request answers 200 with a body that does not match the shared list schema
- **THEN** the drawer shows the alert "Couldn't load the version history" with a **Retry** button

### Requirement: Load more versions
When the API reports more versions than the rows loaded, the drawer SHALL show a **Load more** button that requests the next page (20 per page) and appends it below the loaded rows. It SHALL NOT be shown when every version is loaded.

#### Scenario: Load more is offered when more versions exist
- **WHEN** the first page returns 20 versions and `total` is 45
- **THEN** a **Load more** button is shown

#### Scenario: Load more appends the next page
- **WHEN** the user activates **Load more** and the API returns the next 20 versions
- **THEN** 40 rows are shown in order and `GET /notes/{id}/versions?page=2&limit=20` was requested

#### Scenario: No Load more when everything is loaded
- **WHEN** the last page has been loaded
- **THEN** there is no **Load more** button

#### Scenario: Load more failure keeps loaded rows
- **WHEN** the user activates **Load more** and the request answers 500
- **THEN** the loaded rows stay, the alert "Couldn't load more versions" is shown, and **Load more** can be activated again

#### Scenario: Double Load more activation sends one request
- **WHEN** the user activates **Load more** twice before the first response arrives
- **THEN** exactly one request for the next page is sent

### Requirement: Preview a version
Selecting a version row SHALL load that version in full and show its title and content read-only in the drawer, with a **Back to versions** button that returns to the list with the already loaded rows and without a new list request. The content SHALL be rendered through the editor's document schema and SHALL NOT be rendered as HTML.

#### Scenario: Selecting a version loads it
- **WHEN** the user selects the row for version 2
- **THEN** `GET /notes/{id}/versions/2` is requested and the title and content of version 2 are shown

#### Scenario: Version preview loading state
- **WHEN** the version request is pending
- **THEN** the text "Loading version" is shown

#### Scenario: Preview renders formatting
- **WHEN** a version whose content has a bold run and a bullet list is previewed
- **THEN** the bold text and the list items are rendered as formatted content

#### Scenario: Preview cannot be edited
- **WHEN** a version is previewed
- **THEN** its content is not editable

#### Scenario: HTML-like text in a version stays text
- **WHEN** a previewed version contains the text `<img src=x onerror=alert(1)>`
- **THEN** that text is shown literally and no `img` element exists in the preview

#### Scenario: Unrenderable content shows an error
- **WHEN** a previewed version has content the editor schema cannot render
- **THEN** the preview shows "This version can't be displayed" and no content

#### Scenario: Back keeps the loaded list
- **WHEN** the user previews a version and activates **Back to versions**
- **THEN** the loaded rows are shown again and no new list request was sent

#### Scenario: Preview request fails
- **WHEN** the version request answers 500
- **THEN** the drawer shows the alert "Couldn't load this version" with a **Retry** button

#### Scenario: Version no longer exists
- **WHEN** the version request answers 404 `NOT_FOUND`
- **THEN** the drawer shows "This version is no longer available" and **Back to versions**

#### Scenario: Previewing leaves the editor untouched
- **WHEN** the user edits the title, opens the drawer and previews a version
- **THEN** the title input and the unsaved-changes indicator are unchanged and no `PATCH /notes/{id}` is sent

### Requirement: Restore a version
A preview of any version except the current one SHALL offer **Restore as new version**. Activating it SHALL show an inline "Restore this version?" confirm with **Confirm restore** and **Cancel**. Confirming SHALL send `POST /notes/{id}/versions/{n}/restore` once. The preview of the current version SHALL NOT offer Restore, because restoring it changes nothing.

#### Scenario: Older version offers restore
- **WHEN** the user previews version 2 of a note whose current version is 3
- **THEN** a **Restore as new version** button is shown

#### Scenario: Current version offers no restore
- **WHEN** the user previews the current version
- **THEN** there is no **Restore as new version** button

#### Scenario: Restore asks for confirmation
- **WHEN** the user activates **Restore as new version**
- **THEN** "Restore this version?" with **Confirm restore** and **Cancel** is shown and no restore request is sent

#### Scenario: Cancel sends nothing
- **WHEN** the user activates **Cancel** in the restore confirm
- **THEN** the confirm is dismissed and no restore request was sent

#### Scenario: Confirmed restore sends one request
- **WHEN** the user activates **Confirm restore** twice before the response arrives
- **THEN** exactly one `POST /notes/{id}/versions/2/restore` is sent, with the bearer token and no body

#### Scenario: Restore replaces the editor content
- **WHEN** the restore request answers 200 with the restored note
- **THEN** the editor shows the restored title and content and **Save** is disabled

#### Scenario: Restore closes the drawer and announces it
- **WHEN** the restore request answers 200 for version 2
- **THEN** the drawer is closed and the page announces "Version 2 restored as a new version"

#### Scenario: Restore warns about unsaved edits
- **WHEN** the editor holds unsaved changes and the user activates **Restore as new version**
- **THEN** the confirm also says "Unsaved changes in the editor will be replaced."

#### Scenario: No warning for a clean editor
- **WHEN** the editor has no unsaved changes and the user activates **Restore as new version**
- **THEN** the confirm does not mention unsaved changes

#### Scenario: Unsaved edits are replaced after restore
- **WHEN** the user edits the title, confirms a restore and the request answers 200
- **THEN** the editor shows the restored title, there is no unsaved-changes indicator and leaving the page shows no discard-changes prompt

#### Scenario: Restore refreshes the notes list
- **WHEN** a restore succeeds
- **THEN** the notes list is requested again, because the note's title, excerpt and update time changed

#### Scenario: Restore failure keeps everything
- **WHEN** the restore request answers 500
- **THEN** the drawer stays open on the preview, an error alert is shown, and the editor title and content are unchanged

#### Scenario: Restore of a missing version
- **WHEN** the restore request answers 404 `NOT_FOUND`
- **THEN** the drawer shows "This version is no longer available" and the editor is unchanged

### Requirement: Authorization and session handling
The version calls SHALL use the bearer session. A 401 SHALL trigger one refresh and one retry of the same call. If the refresh is rejected the session SHALL be cleared and the user sent to `/login`. A 404 on the list SHALL show "This note is no longer available" and no rows, so another user's note is indistinguishable from a missing one.

#### Scenario: Expired access token is refreshed while browsing history
- **WHEN** the list request answers 401 and the refresh succeeds
- **THEN** the list request is retried once with the new token and the versions are shown

#### Scenario: Rejected refresh ends the session while browsing history
- **WHEN** the list request answers 401 and the refresh is rejected
- **THEN** the session is cleared and the user is on `/login`

#### Scenario: Another user's note history is not available
- **WHEN** the list request answers 404 `NOT_FOUND`
- **THEN** the drawer shows "This note is no longer available" and no rows or **Load more**

### Requirement: Versions API functions and cache
The frontend SHALL provide functions for listing a page of versions, reading one version and restoring one over the `request()` client, with responses validated by the shared version schemas and the version number validated by the shared parameter schema before any request is sent. The list SHALL be cached as one growing list under `["versions", noteId, "list"]` and a single version under `["versions", noteId, "detail", n]`.

#### Scenario: List sends page and limit
- **WHEN** the list function is called for page 2 with limit 20
- **THEN** it sends `GET /notes/{id}/versions?page=2&limit=20` with the bearer token and returns the validated response

#### Scenario: Get sends the version number
- **WHEN** the get function is called with version 2
- **THEN** it sends `GET /notes/{id}/versions/2` with the bearer token and returns the validated version

#### Scenario: Restore sends a post without a body
- **WHEN** the restore function is called with version 2
- **THEN** it sends `POST /notes/{id}/versions/2/restore` with the bearer token, no body, and returns the validated note

#### Scenario: Invalid version number sends no request
- **WHEN** the get or restore function is called with version 0 or 1.5
- **THEN** it rejects and no request is sent

#### Scenario: Restore marks the version list stale
- **WHEN** a restore succeeds
- **THEN** the cached version list for the note is marked stale and is requested again the next time it is used

### Requirement: History drawer accessibility
The drawer SHALL be a labelled modal that traps focus. Every control SHALL have an accessible name, and the version row buttons SHALL include the version number in their name so they can be told apart. Outcomes of loading and restoring SHALL be announced in a polite status region.

#### Scenario: Drawer is labelled and modal
- **WHEN** the history drawer is open
- **THEN** it has role `dialog`, `aria-modal` true and the accessible name "Version history"

#### Scenario: Row buttons identify their version
- **WHEN** the list has three rows
- **THEN** the three row buttons have different accessible names, each containing its version number

#### Scenario: Preview announces loading
- **WHEN** a version is selected
- **THEN** the loading text is inside a `role="status"` region
