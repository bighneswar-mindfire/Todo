# frontend-trash Specification

## Purpose
Lets a signed-in user see the notes they deleted in the last 30 days and restore one, so a deleted note can be recovered from the app.

## Requirements

### Requirement: Trash page
The route `/trash` SHALL be a protected page that lists the signed-in user's trashed notes from `GET /notes/trash`, with a heading "Trash" and a link **Back to notes** to `/`. Items SHALL appear in the order the API returns them. The page SHALL request page 1 with `limit=20` unless the URL says otherwise.

#### Scenario: Trash order is kept
- **WHEN** the API returns trashed notes B then A
- **THEN** the page shows B above A

#### Scenario: Trash first request uses defaults
- **WHEN** a signed-in user opens `/trash` with no query string
- **THEN** the app calls `GET /notes/trash` with `page=1` and `limit=20`

#### Scenario: Back to notes
- **WHEN** the user activates **Back to notes**
- **THEN** the app is on `/`

#### Scenario: Unauthenticated trash visit is redirected
- **WHEN** a visitor without a session opens `/trash`
- **THEN** the app is on `/login` and no `/notes/trash` request is sent

### Requirement: Trash rows
Each trashed note SHALL render as one list item showing its title as plain text, its excerpt (omitted when empty), the deletion time in a `<time>` element whose `dateTime` is the ISO `deletedAt`, and a **Restore** button. Rows SHALL NOT link to the editor and SHALL show no tags.

#### Scenario: Trashed notes are listed with their details
- **WHEN** a signed-in user opens `/trash` and the API returns two trashed notes
- **THEN** the page shows both titles, their excerpts and each note's `deletedAt` in a `<time>` element, each with a **Restore** button

#### Scenario: Empty excerpt is omitted in trash
- **WHEN** a trashed note has an empty excerpt
- **THEN** its item shows the title and no excerpt text

#### Scenario: Trash titles are not links
- **WHEN** the page lists a trashed note
- **THEN** its title is not a link and the item contains no link to `/notes/{id}`

### Requirement: Trash pagination in the URL
The trash page SHALL follow the same pagination rules as the notes list: a navigation landmark labelled "Pagination" with **Previous**, **Next** and "Page X of Y" only when Y (`ceil(total / limit)`) is greater than 1; **Previous** disabled on page 1 and **Next** on the last page; the page held in the `page` query parameter; an invalid `page` treated as 1; and, when the API returns no items for a page greater than 1 while `total` is greater than 0, the URL replaced with the last page.

#### Scenario: Trash pagination hidden for a single page
- **WHEN** the API reports `total` 20 with `limit` 20
- **THEN** no pagination navigation is shown

#### Scenario: Trash Next loads the next page
- **WHEN** the API reports `total` 45 and the user activates **Next** on page 1
- **THEN** the URL is `/trash?page=2` and `GET /notes/trash` is requested with `page=2`

#### Scenario: Trash page restored from the URL
- **WHEN** a user opens `/trash?page=2` and the API reports `total` 45
- **THEN** the app requests page 2 and shows "Page 2 of 3"

#### Scenario: Invalid trash page treated as 1
- **WHEN** a user opens `/trash?page=abc`
- **THEN** the app requests page 1

#### Scenario: Trash page beyond the end falls back to the last page
- **WHEN** the user opens `/trash?page=5`, the API returns no items and `total` is 45
- **THEN** the URL is replaced with `/trash?page=3` and page 3 is requested

### Requirement: Trash loading, empty and error states
While the first request is pending the page SHALL show a status "Loading trash". With `total` 0 it SHALL show "Trash is empty". When the request fails (HTTP error, network failure or a body that does not match the shared schema) it SHALL show an alert "Couldn't load your trash" with a **Retry** button that requests the same page again.

#### Scenario: Trash loading indicator
- **WHEN** the trash request has not answered
- **THEN** a status "Loading trash" is shown and no rows are shown

#### Scenario: Empty trash
- **WHEN** the API returns no items and `total` 0
- **THEN** the page shows "Trash is empty" and no pagination

#### Scenario: Trash request failure with retry
- **WHEN** `GET /notes/trash` answers 500 and the user activates **Retry** after it recovers
- **THEN** the alert "Couldn't load your trash" is shown first, then the rows after the second request

#### Scenario: Trash network failure shown
- **WHEN** `GET /notes/trash` fails at the network level
- **THEN** the alert "Couldn't load your trash" is shown

#### Scenario: Malformed trash response becomes an error state
- **WHEN** `GET /notes/trash` answers 200 with a body that fails the shared schema
- **THEN** the alert "Couldn't load your trash" is shown

### Requirement: Restore a note
Activating **Restore** on a row SHALL send `POST /notes/{id}/restore` for that note. On 200 the row SHALL leave the list, the trash list SHALL be refetched, and the notes lists, tags and search queries SHALL be marked stale so the note appears again with its tags. While the request is in flight that row's **Restore** SHALL be disabled, so a second activation sends no second request; other rows SHALL stay usable. After a successful restore the user SHALL stay on `/trash`.

#### Scenario: Restoring a note removes it from trash
- **WHEN** the user activates **Restore** on "Plan" and the API answers 200
- **THEN** `POST /notes/{id}/restore` is sent for "Plan", "Plan" is no longer shown, and the user is still on `/trash`

#### Scenario: Restoring refreshes notes, tags and search
- **WHEN** a restore succeeds
- **THEN** `GET /notes/trash` is requested again and the notes-list, tags and search queries are marked stale

#### Scenario: Restored note is back in the notes list
- **WHEN** a restore succeeds and the user then opens `/`
- **THEN** the list is requested again and shows the restored note with its tags

#### Scenario: Restore double press sends one request
- **WHEN** the user activates **Restore** twice before the API has answered
- **THEN** exactly one `POST /notes/{id}/restore` is sent and that row's button is disabled until it answers

#### Scenario: Other rows stay usable during a restore
- **WHEN** a restore is in flight for one row
- **THEN** the **Restore** buttons of the other rows are enabled

#### Scenario: Restoring the last row of a page
- **WHEN** the user restores the only note on page 2 and the refetched `total` fits on one page
- **THEN** the URL falls back to the last page and that page is shown

### Requirement: Restore failures
A restore answered 404 SHALL show an alert "That note can't be restored" and refetch the trash list, which no longer shows the note. Any other failure (HTTP error, network failure, or a 200 body that fails the shared schema) SHALL show an alert "Couldn't restore that note. Try again", keep the row with **Restore** enabled again, and refetch the trash list. A later successful restore or a page change SHALL clear the alert.

#### Scenario: Restore of a note that is no longer restorable
- **WHEN** the API answers 404 to the restore
- **THEN** the alert "That note can't be restored" is shown and `GET /notes/trash` is requested again

#### Scenario: Server failure keeps the row
- **WHEN** the API answers 500 to the restore
- **THEN** the alert "Couldn't restore that note. Try again" is shown, the row is still listed and its **Restore** is enabled

#### Scenario: Network failure on restore
- **WHEN** the restore fails at the network level
- **THEN** the same alert is shown and the row stays

#### Scenario: Malformed restore response
- **WHEN** the API answers 200 to the restore with a body that fails the shared schema
- **THEN** the alert "Couldn't restore that note. Try again" is shown and the trash list is requested again

#### Scenario: Retry after a failed restore
- **WHEN** a restore failed with 500 and the user activates **Restore** again and the API answers 200
- **THEN** the row is removed and the alert is cleared

### Requirement: Session handling on the trash page
Trash requests SHALL carry the bearer token. A 401 SHALL trigger one refresh and one retry of the request; a rejected refresh SHALL clear the session and send the user to `/login`, as in AB-1010.

#### Scenario: Expired session on the trash list
- **WHEN** `GET /notes/trash` answers 401 and the refresh call is rejected
- **THEN** the session is cleared and the app is on `/login`

#### Scenario: Expired token is refreshed once for restore
- **WHEN** the restore answers 401 once and the refresh succeeds
- **THEN** the restore is retried once with the new token and the row is removed

### Requirement: Trash API functions
`listTrash({ page, limit })` SHALL request `GET /notes/trash?page=&limit=` with the bearer token and parse the response with `trashListResponseSchema`. `restoreNote(id)` SHALL request `POST /notes/{id}/restore` with the bearer token and parse the response with `noteSchema`. A response that fails its schema SHALL reject.

#### Scenario: listTrash builds the query
- **WHEN** `listTrash({ page: 2, limit: 20 })` is called
- **THEN** it requests `GET /notes/trash?page=2&limit=20` with a bearer token

#### Scenario: restoreNote posts to the note
- **WHEN** `restoreNote("abc")` is called
- **THEN** it sends `POST /notes/abc/restore` with a bearer token and no body

### Requirement: Deleting a note refreshes the trash
After a successful delete from the editor, a cached trash list SHALL be marked stale so the next visit to `/trash` requests it again and shows the deleted note.

#### Scenario: Deleted note appears in trash
- **WHEN** the user visits `/trash` (empty), opens a note, deletes it, and visits `/trash` again
- **THEN** the second visit requests `GET /notes/trash` again and lists the deleted note

### Requirement: Trash page accessibility
The trash list SHALL be a list; each **Restore** button SHALL have an accessible name that includes the note title ("Restore Plan"); loading and failures SHALL be announced through `role="status"` and `role="alert"`.

#### Scenario: Restore buttons name their note
- **WHEN** the page lists "Plan" and "Ideas"
- **THEN** buttons named "Restore Plan" and "Restore Ideas" exist
