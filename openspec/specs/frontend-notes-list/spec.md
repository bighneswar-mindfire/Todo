# frontend-notes-list Specification

## Purpose
TBD - created by archiving change ab-1011. Update Purpose after archive.

## Requirements

### Requirement: Notes list page
The route `/` SHALL be a protected page that lists the signed-in user's active notes from `GET /notes`. It SHALL keep the signed-in email and the **Log out** button in a header. Each note SHALL render as one list item showing its title, its excerpt (omitted when empty), its tags as colored chips and its last-updated time in a `<time>` element whose `dateTime` is the ISO `updatedAt`. Items SHALL appear in the order the API returns them. The page SHALL request page 1 with `limit=20` unless the URL says otherwise.

#### Scenario: Notes are listed with their details
- **WHEN** a signed-in user opens `/` and the API returns two notes
- **THEN** the page shows both titles, their excerpts and each note's `updatedAt` in a `<time>` element

#### Scenario: Tags are shown on each note
- **WHEN** a listed note has two tags
- **THEN** that item shows both tag names as chips, each colored with the tag's `color`, and an untagged note shows none

#### Scenario: Empty excerpt is omitted
- **WHEN** a listed note has an empty excerpt
- **THEN** its item shows the title and no excerpt text

#### Scenario: API order is kept
- **WHEN** the API returns notes B then A
- **THEN** the page shows B above A

#### Scenario: First request uses defaults
- **WHEN** a signed-in user opens `/` with no query string
- **THEN** the app calls `GET /notes` with `page=1` and `limit=20` and no `tagId`

#### Scenario: Unauthenticated visit is redirected
- **WHEN** a visitor without a session opens `/`
- **THEN** the app is on `/login` and no `/notes` request is sent

### Requirement: Pagination
The page SHALL show a navigation landmark labelled "Pagination" with **Previous**, **Next** and the text "Page X of Y" (Y is `ceil(total / limit)`) only when Y is greater than 1. **Previous** SHALL be disabled on page 1 and **Next** on the last page. Using them SHALL change the `page` query parameter and request that page. While the next page loads, the current page SHALL stay visible. When the API returns no items for a page greater than 1 while `total` is greater than 0, the app SHALL replace the URL with the last page.

#### Scenario: Pagination hidden for a single page
- **WHEN** the API reports `total` 20 with `limit` 20
- **THEN** no pagination navigation is shown

#### Scenario: Pagination shows position
- **WHEN** the API reports `total` 45 on page 1
- **THEN** the page shows "Page 1 of 3", **Previous** is disabled and **Next** is enabled

#### Scenario: Next loads the next page
- **WHEN** the user clicks **Next** on page 1
- **THEN** the URL becomes `/?page=2`, the app calls `GET /notes?page=2&limit=20` and shows "Page 2 of 3"

#### Scenario: Last page disables Next
- **WHEN** the user is on page 3 of 3
- **THEN** **Next** is disabled and **Previous** is enabled

#### Scenario: Previous page stays visible while loading
- **WHEN** the user clicks **Next** and the page 2 response has not arrived
- **THEN** the page 1 items remain on screen until page 2 replaces them

#### Scenario: Page beyond the end falls back to the last page
- **WHEN** the user opens `/?page=9` and the API returns no items with `total` 45
- **THEN** the URL is replaced with `/?page=3` and page 3 is shown

### Requirement: Tag filter
The page SHALL load the user's tags from `GET /tags` and show a group labelled "Filter by tag" with an **All notes** button and one button per tag showing its name and `noteCount`. The active choice SHALL have `aria-pressed="true"`. Clicking a tag SHALL set `tagId` in the URL, reset `page` to 1 and request `GET /notes?tagId=<id>`. Clicking the active tag or **All notes** SHALL remove `tagId` and `page`. The notes request SHALL NOT wait for the tags request.

#### Scenario: Filter buttons list the tags
- **WHEN** the API returns tags `Work` (noteCount 2) and `Home` (noteCount 1)
- **THEN** the page shows **All notes**, `Work 2` and `Home 1`, with **All notes** pressed

#### Scenario: Choosing a tag filters the list
- **WHEN** the user clicks `Work`
- **THEN** the URL contains `tagId=<Work id>`, the app calls `GET /notes` with that `tagId` and `page=1`, `Work` is pressed and the filtered notes are shown

#### Scenario: Choosing a tag resets the page
- **WHEN** the user is on `/?page=3` and clicks `Work`
- **THEN** the URL is `/?tagId=<Work id>` and the request uses `page=1`

#### Scenario: Clearing the filter
- **WHEN** the user clicks the pressed `Work` button
- **THEN** the URL has no `tagId` and the unfiltered list is requested and shown

#### Scenario: All notes clears the filter
- **WHEN** a tag filter is active and the user clicks **All notes**
- **THEN** the URL has no `tagId` or `page` and **All notes** is pressed

#### Scenario: Notes do not wait for tags
- **WHEN** the tags request has not completed
- **THEN** the notes are already shown

#### Scenario: Tags failure does not block the list
- **WHEN** `GET /tags` fails with 500 and `GET /notes` succeeds
- **THEN** the notes are shown, the filter group shows an alert "Couldn't load tags" with a **Retry** button, and clicking it calls `GET /tags` again

### Requirement: URL-driven view state
The list view SHALL be derived from the URL query parameters `page` and `tagId`, so reloading or sharing the URL restores the same view. A `page` that is not a positive integer SHALL be treated as 1. A `tagId` that is not a UUID SHALL be ignored. Neither case SHALL send an invalid request to the API.

#### Scenario: View restored from the URL
- **WHEN** a signed-in user opens `/?page=2&tagId=<Work id>`
- **THEN** the app calls `GET /notes` with `page=2`, `limit=20` and that `tagId`, and `Work` is pressed

#### Scenario: Invalid page treated as 1
- **WHEN** a user opens `/?page=abc` or `/?page=0`
- **THEN** the app calls `GET /notes` with `page=1`

#### Scenario: Malformed tagId ignored
- **WHEN** a user opens `/?tagId=not-a-uuid`
- **THEN** the app calls `GET /notes` without a `tagId` and **All notes** is pressed

### Requirement: Loading, empty and error states
While the first notes request is pending the page SHALL show an element with `role="status"` reading "Loading notes". When the user has no notes at all, the page SHALL show "No notes yet". When a tag filter is active and returns no notes, it SHALL show "No notes with this tag" and the filter SHALL stay usable. When the notes request fails, the page SHALL show an element with `role="alert"` and a **Retry** button that repeats the request. When the API answers 404 `NOT_FOUND` for the `tagId`, the page SHALL show an alert "That tag no longer exists" with a **Show all notes** button that clears the filter. A 401 SHALL follow the AB-1010 refresh behaviour and is not handled here.

#### Scenario: Loading indicator
- **WHEN** the notes request is pending
- **THEN** the page shows the status "Loading notes"

#### Scenario: Empty account
- **WHEN** the API returns no notes and `total` 0 with no filter active
- **THEN** the page shows "No notes yet" and no pagination

#### Scenario: Empty filter result
- **WHEN** a tag filter is active and the API returns no notes
- **THEN** the page shows "No notes with this tag" and the filter buttons remain

#### Scenario: Request failure with retry
- **WHEN** `GET /notes` fails with 500 and the user clicks **Retry**, and the second call succeeds
- **THEN** an alert is shown first, then the notes replace it

#### Scenario: Network failure shown
- **WHEN** `GET /notes` fails because the server is unreachable
- **THEN** the page shows an alert with a **Retry** button

#### Scenario: Unknown tag in the URL
- **WHEN** a user opens `/?tagId=<uuid>` and the API answers 404 `NOT_FOUND`
- **THEN** the page shows the alert "That tag no longer exists", and clicking **Show all notes** removes `tagId` and lists all notes

### Requirement: Notes API functions
The frontend SHALL read notes and tags only through `listNotes` and `listTags` in `src/api/notes.ts`. Both SHALL use `auth: "bearer"`, SHALL validate the response with `noteListResponseSchema` and `tagListResponseSchema` from `@todo/shared`, and SHALL send only the query parameters that differ from the API defaults being relied on (`tagId` only when set). A response that does not match the schema SHALL surface as an error state, not as a crash.

#### Scenario: listNotes builds the query
- **WHEN** `listNotes({ page: 2, limit: 20, tagId })` is called
- **THEN** it sends `GET /notes?page=2&limit=20&tagId=<id>` with the bearer token, and omits `tagId` when it is undefined

#### Scenario: Malformed response becomes an error state
- **WHEN** `GET /notes` answers 200 with a body that fails `noteListResponseSchema`
- **THEN** the page shows the failure alert with **Retry** instead of crashing

### Requirement: New note entry point
The notes list page SHALL show a **New note** link to `/notes/new` in its header area. It SHALL be present in every list state where the page renders (loading, empty, error and populated), so an account with no notes can create the first one.

#### Scenario: New note link is shown
- **WHEN** a signed-in user opens `/` with notes
- **THEN** a link named **New note** with `href` `/notes/new` is shown

#### Scenario: New note link is shown for an empty account
- **WHEN** a signed-in user with no notes opens `/`
- **THEN** "No notes yet" and the **New note** link are both shown

### Requirement: Rows open the editor
Each listed note's title SHALL be a link to `/notes/<id>`. Activating it SHALL open the editor for that note.

#### Scenario: Title links to the editor
- **WHEN** the list shows a note with id `n1` and title "Groceries"
- **THEN** the title is a link whose `href` is `/notes/n1`

#### Scenario: Clicking a title opens the editor
- **WHEN** the user clicks the title link of note `n1`
- **THEN** the app is on `/notes/n1`

### Requirement: Search entry in the notes-list header
The notes-list header SHALL contain a `search` landmark with a text input labelled "Search notes" and a **Search** button. Submitting it with non-blank text SHALL navigate to `/search?q=<trimmed text>`. Submitting blank text SHALL do nothing. The header box SHALL NOT send any request itself.

#### Scenario: Submitting opens the search page
- **WHEN** a user types `budget` in the header search box on `/` and presses Enter
- **THEN** the app is on `/search?q=budget`

#### Scenario: Search button submits
- **WHEN** a user types `budget` and clicks **Search**
- **THEN** the app is on `/search?q=budget`

#### Scenario: Blank submit does nothing
- **WHEN** a user submits the header box with only spaces
- **THEN** the app stays on `/` and no `/search` request is sent

#### Scenario: Typing alone sends no request
- **WHEN** a user types in the header box without submitting
- **THEN** no `/search` request is sent
