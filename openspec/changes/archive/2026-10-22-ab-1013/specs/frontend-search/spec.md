# Spec Delta

## Purpose

Lets a signed-in user search their own notes from the web app: a debounced search box, ranked results with safely rendered highlights, pagination and a tag filter, all driven by the URL.

## ADDED Requirements

### Requirement: Search page access
The route `/search` SHALL be a protected page. A visitor without a session SHALL be redirected to `/login` and no `/search` request SHALL be sent. If the session is cleared because a refresh was rejected, the user SHALL be sent to `/login`.

#### Scenario: Unauthenticated visit is redirected
- **WHEN** a visitor without a session opens `/search?q=meeting`
- **THEN** the app is on `/login` and no `/search` request is sent

#### Scenario: Rejected refresh ends the session
- **WHEN** a search request returns 401 and the refresh is rejected
- **THEN** the session is cleared and the app is on `/login`

### Requirement: Query state lives in the URL
The page SHALL read `q`, `page` and `tagId` from the URL. The input SHALL show `q` on load. A `page` that is not a positive integer SHALL be treated as 1 and a malformed `tagId` SHALL be ignored. Page 1 and "no tag" SHALL stay out of the URL.

#### Scenario: Input is prefilled from the URL
- **WHEN** a signed-in user opens `/search?q=budget`
- **THEN** the search input shows `budget` and the app calls `GET /search` with `q=budget`, `page=1` and `limit=20`

#### Scenario: Bad page falls back to 1
- **WHEN** a user opens `/search?q=budget&page=abc`
- **THEN** the app requests page 1

#### Scenario: Malformed tag is ignored
- **WHEN** a user opens `/search?q=budget&tagId=nope`
- **THEN** the request has no `tagId`

#### Scenario: Search can be reloaded
- **WHEN** a user reloads `/search?q=budget&page=2&tagId=<uuid>`
- **THEN** the same request is made and the input shows `budget`

### Requirement: Debounced search box
The search box SHALL be a `search` landmark with a text input labelled "Search notes". Typing SHALL update the `q` URL parameter, replacing the history entry, 300 ms after the last keystroke, and the request SHALL use the trimmed text. Changing `q` SHALL reset `page` to 1. A blank (empty or whitespace) `q` SHALL send no request and SHALL remove `q` from the URL.

#### Scenario: Request waits for the debounce
- **WHEN** a user types `bud` and 299 ms pass
- **THEN** no `/search` request has been sent

#### Scenario: Request is sent after the debounce
- **WHEN** a user types `budget` and 300 ms pass without another keystroke
- **THEN** the URL is `/search?q=budget` and one request with `q=budget` is sent

#### Scenario: Rapid typing sends one request
- **WHEN** a user types `b`, `u`, `d` with 100 ms between keys
- **THEN** exactly one request with `q=bud` is sent

#### Scenario: Query is trimmed
- **WHEN** a user types `  budget  `
- **THEN** the request has `q=budget`

#### Scenario: Typing replaces history
- **WHEN** a user types a query and then presses the browser Back button
- **THEN** the app leaves `/search` instead of stepping through earlier queries

#### Scenario: New query resets the page
- **WHEN** a user on page 3 of `budget` changes the text to `invoice`
- **THEN** the URL has no `page` parameter and the request is for page 1

#### Scenario: Blank input sends no request
- **WHEN** a user clears the input or types only spaces
- **THEN** `q` is removed from the URL and no request is sent for it

### Requirement: Query validation
The UI SHALL NOT send a `q` longer than 200 characters. It SHALL show the message "Search text must be 200 characters or fewer" and keep the input value.

#### Scenario: Over-length query is rejected locally
- **WHEN** a user types 201 characters
- **THEN** the message is shown and no request is sent for that text

#### Scenario: Exactly 200 characters is searched
- **WHEN** a user types 200 characters
- **THEN** a request is sent and no message is shown

### Requirement: Result list
Each result SHALL render as one list item in the order the API returns them. It SHALL show the highlighted title as a link to `/notes/<id>`, the highlighted snippet (omitted when empty), the note's tags as colored chips, and the last-updated time in a `<time>` element whose `dateTime` is the ISO `updatedAt`. The `rank` SHALL NOT be shown.

#### Scenario: Results are listed with their details
- **WHEN** the API returns two results
- **THEN** the page shows both titles as links to their notes, their snippets and each `updatedAt` in a `<time>` element

#### Scenario: Tags are shown on each result
- **WHEN** a result has two tags
- **THEN** both tag names appear as chips colored with the tag's `color`

#### Scenario: API order is kept
- **WHEN** the API returns result B then A
- **THEN** B is shown above A

#### Scenario: Empty snippet is omitted
- **WHEN** a result has an empty snippet
- **THEN** its item shows the title and no snippet text

#### Scenario: Rank is not displayed
- **WHEN** a result has `rank` 0.75
- **THEN** no element shows the rank value

#### Scenario: Result title opens the note
- **WHEN** a user clicks a result title
- **THEN** the app navigates to `/notes/<id>`

### Requirement: Safe highlight rendering
The title and snippet SHALL be rendered by splitting the server string on `<mark>` and `</mark>` and rendering the parts as React text and `<mark>` elements. The entities `&amp;`, `&lt;`, `&gt;`, `&quot;` and `&#39;` SHALL be unescaped to their characters inside text parts. The UI SHALL NOT insert server strings as HTML. Every other `<` in a string SHALL appear as text.

#### Scenario: Matched words are marked
- **WHEN** a snippet is `the <mark>budget</mark> is set`
- **THEN** `budget` is inside a `<mark>` element and the surrounding words are plain text

#### Scenario: Several marks are rendered
- **WHEN** a title is `<mark>red</mark> and <mark>apple</mark>`
- **THEN** two `<mark>` elements contain `red` and `apple`

#### Scenario: Entities are shown as characters
- **WHEN** a snippet is `Tom &amp; Jerry &lt;3 &quot;hi&quot; it&#39;s`
- **THEN** the page shows the text `Tom & Jerry <3 "hi" it's`

#### Scenario: Escaped markup stays text
- **WHEN** a snippet is `&lt;script&gt;alert(1)&lt;/script&gt; <mark>x</mark>`
- **THEN** the page shows the literal text `<script>alert(1)</script>`, creates no `script` element, and `x` is marked

#### Scenario: Unexpected markup is not interpreted
- **WHEN** a snippet contains a raw `<img src=x onerror=alert(1)>`
- **THEN** it appears as literal text and no `img` element is created

#### Scenario: Unbalanced marks do not break rendering
- **WHEN** a snippet is `a <mark>b` with no closing tag
- **THEN** the text is shown without throwing and nothing outside the text is marked beyond `b`

#### Scenario: Text without marks
- **WHEN** a snippet has no `<mark>`
- **THEN** it is shown as plain text with no `<mark>` element

### Requirement: Search states
The page SHALL show: a prompt "Type to search your notes" when `q` is blank; "Searching" while the first request is loading; "No results for "<q>"" when `items` is empty; and, when a request fails, an alert "Couldn't run your search" with a **Retry** button that repeats it. While a later page or query loads, the previous results SHALL stay visible.

#### Scenario: Blank query shows a prompt
- **WHEN** a user opens `/search` with no `q`
- **THEN** the prompt is shown and no request is sent

#### Scenario: Loading state
- **WHEN** the first request has not answered yet
- **THEN** a status shows "Searching"

#### Scenario: No results
- **WHEN** the API returns an empty `items` array for `q=zzz`
- **THEN** the page shows `No results for "zzz"`

#### Scenario: Server error offers retry
- **WHEN** the API answers 500
- **THEN** an alert "Couldn't run your search" with a Retry button is shown, and Retry repeats the request

#### Scenario: Validation error from the server is handled
- **WHEN** the API answers 400 `VALIDATION_ERROR`
- **THEN** the same retryable alert is shown

#### Scenario: Network failure offers retry
- **WHEN** the request fails without a response
- **THEN** the same retryable alert is shown

#### Scenario: Previous results stay while loading
- **WHEN** a user changes the query and the new request is pending
- **THEN** the previous results remain visible until the new ones arrive

#### Scenario: Result count is announced
- **WHEN** results arrive
- **THEN** a polite live region states the total, for example "3 results"

### Requirement: Search pagination
The page SHALL show the same "Pagination" navigation as the notes list (Previous, Next, "Page X of Y") only when more than one page exists. Using it SHALL change `page` in the URL. When the API returns no items for a page greater than 1 while `total` is greater than 0, the app SHALL replace the URL with the last page.

#### Scenario: Pagination hidden for one page
- **WHEN** `total` is 20 with `limit` 20
- **THEN** no pagination navigation is shown

#### Scenario: Next page is requested
- **WHEN** `total` is 45 and the user clicks Next on page 1
- **THEN** the URL gains `page=2` and page 2 is requested with the same `q` and `tagId`

#### Scenario: Previous is disabled on the first page
- **WHEN** the user is on page 1 of 3
- **THEN** Previous is disabled and Next is enabled

#### Scenario: Next is disabled on the last page
- **WHEN** the user is on page 3 of 3
- **THEN** Next is disabled

#### Scenario: Page past the end falls back
- **WHEN** the API returns no items for `page=5` and `total` is 45
- **THEN** the URL is replaced with `page=3`

### Requirement: Tag filter
The page SHALL show the tag filter used by the notes list. Selecting a tag SHALL set `tagId` in the URL, reset `page` to 1 and send `tagId`. Selecting the active tag or **All notes** SHALL remove it. If the API answers 404 for the `tagId`, the page SHALL show "That tag no longer exists" with a button that clears the filter. A failed tag list SHALL show "Couldn't load tags" with Retry and SHALL NOT block results.

#### Scenario: Selecting a tag filters results
- **WHEN** a user selects a tag
- **THEN** the URL gains `tagId=<id>` without `page` and the request includes `tagId`

#### Scenario: Clearing the tag
- **WHEN** a user selects All notes while a tag is active
- **THEN** `tagId` is removed from the URL and the request has no `tagId`

#### Scenario: Active tag is pressed
- **WHEN** the URL has a valid `tagId`
- **THEN** that tag button has `aria-pressed="true"`

#### Scenario: Changing the tag resets the page
- **WHEN** a user on page 2 selects a tag
- **THEN** the URL has no `page` parameter

#### Scenario: Unknown tag is recoverable
- **WHEN** the API answers 404 for the `tagId`
- **THEN** "That tag no longer exists" is shown and its button removes `tagId` and searches again

#### Scenario: Tag list failure does not block results
- **WHEN** `GET /tags` fails and the search succeeds
- **THEN** results are shown together with "Couldn't load tags"

### Requirement: Results stay fresh
Cached search results SHALL be discarded when a note is saved or deleted so a later search reflects the edit.

#### Scenario: Saved edit is reflected
- **WHEN** a user saves a note and then opens `/search?q=budget`
- **THEN** a new `GET /search` request is made instead of showing the earlier cached results

#### Scenario: Deleted note is not shown from cache
- **WHEN** a user deletes a note and then opens a search that previously listed it
- **THEN** a new `GET /search` request is made
