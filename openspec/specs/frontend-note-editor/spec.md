# frontend-note-editor Specification

## Purpose
TBD - created by archiving change ab-1012. Update Purpose after archive.

## Requirements

### Requirement: Editor routes
The routes `/notes/new` and `/notes/:id` SHALL be protected (same guard as `/`) and render the note editor page. `/notes/new` SHALL start with an empty title and an empty document and send no request on load other than `GET /tags`. `/notes/:id` SHALL request `GET /notes/{id}` and fill the title input and the editor with the returned `title` and `content`. A page header SHALL offer a link back to the list (`/`).

#### Scenario: Unauthenticated visit is redirected
- **WHEN** a visitor without a session opens `/notes/new` or `/notes/<id>`
- **THEN** the app is on `/login` and no `/notes` request is sent

#### Scenario: New note starts empty
- **WHEN** a signed-in user opens `/notes/new`
- **THEN** the title input is empty, the editor has no content and no `GET /notes/{id}` request is sent

#### Scenario: Existing note is loaded
- **WHEN** a signed-in user opens `/notes/<id>` and the API returns a note titled "Groceries" with a paragraph "Milk"
- **THEN** the title input shows "Groceries" and the editor shows "Milk"

#### Scenario: Back link returns to the list
- **WHEN** the user activates the back link on the editor page
- **THEN** the app navigates to `/`

### Requirement: Rich-text editing
The editor SHALL be a TipTap editor with the StarterKit extensions and a toolbar (`role="toolbar"`, labelled "Formatting") with buttons for bold, italic, strike, heading 1, heading 2, bullet list, ordered list, blockquote, code block, undo and redo. Toggle buttons SHALL expose `aria-pressed` reflecting the selection. Undo and redo SHALL be disabled when there is nothing to undo or redo. The content sent to the API SHALL be exactly `editor.getJSON()`, an object that passes `tipTapDocSchema` from `@todo/shared`.

#### Scenario: Toolbar lists the formatting actions
- **WHEN** the editor page is shown
- **THEN** the "Formatting" toolbar has buttons named Bold, Italic, Strike, Heading 1, Heading 2, Bullet list, Ordered list, Blockquote, Code block, Undo and Redo

#### Scenario: Bold toggles on the selection
- **WHEN** the user selects the word "Milk" and clicks Bold
- **THEN** the editor content marks "Milk" as bold and the Bold button has `aria-pressed="true"`

#### Scenario: Heading and list blocks can be applied
- **WHEN** the user clicks Heading 1 and types "Title", then clicks Bullet list on a new line and types "item"
- **THEN** the saved document contains a `heading` node of level 1 and a `bulletList` node

#### Scenario: Undo and redo track history
- **WHEN** a fresh editor is shown, the user types "a", then clicks Undo, then Redo
- **THEN** Undo and Redo are disabled at the start, Undo removes "a", Redo restores it

#### Scenario: Stored content round-trips
- **WHEN** a note whose content has a bold run, a heading and a bullet list is opened and saved after changing only the title
- **THEN** no `content` is sent, and when the content is changed the sent `content` still contains the bold, heading and list nodes unchanged

### Requirement: Creating a note
On `/notes/new`, **Save** SHALL be enabled only when the trimmed title is non-empty. Saving SHALL send `POST /notes` with `{ title, content }` (title trimmed, content from `getJSON()`). On 201 the app SHALL replace the URL with `/notes/<new id>` and show the saved note. The notes-list and tags queries SHALL be invalidated.

#### Scenario: Save is disabled without a title
- **WHEN** the user opens `/notes/new` and types only whitespace in the title
- **THEN** **Save** is disabled and no request is sent on `Ctrl+S`

#### Scenario: Create sends trimmed title and content
- **WHEN** the user enters title "  Groceries  " and the text "Milk", then clicks **Save**
- **THEN** the app calls `POST /notes` with title `Groceries` and a document containing the paragraph "Milk"

#### Scenario: Create moves to the edit URL
- **WHEN** `POST /notes` answers 201 with id `n1`
- **THEN** the app is on `/notes/n1` (the previous `/notes/new` entry is replaced) and the note is shown without a second `GET /notes/n1` being required

#### Scenario: Create refreshes the list
- **WHEN** a note has just been created and the user returns to `/`
- **THEN** the list shows the new note without a manual reload

### Requirement: Editing a note
On `/notes/:id`, **Save** SHALL be enabled only when the title or the content differs from the last saved or loaded version and the trimmed title is non-empty. Saving SHALL send `PATCH /notes/{id}` containing only the fields that changed. On 200 the saved values SHALL become the new baseline (**Save** disabled again, "Saved" shown), and the notes-list and tags queries SHALL be invalidated. `Ctrl+S` or `Cmd+S` in the page SHALL behave like clicking **Save** and SHALL prevent the browser's own save dialog. The page SHALL show "Unsaved changes" while it differs from the baseline.

#### Scenario: Save is disabled when nothing changed
- **WHEN** a note has just been loaded
- **THEN** **Save** is disabled and "Unsaved changes" is not shown

#### Scenario: Editing enables Save and shows the dirty marker
- **WHEN** the user changes the title
- **THEN** **Save** is enabled and "Unsaved changes" is shown

#### Scenario: Only the title is sent when only the title changed
- **WHEN** the user changes the title and clicks **Save**
- **THEN** the app calls `PATCH /notes/{id}` with a body that has `title` and no `content`

#### Scenario: Only the content is sent when only the content changed
- **WHEN** the user types in the editor and clicks **Save**
- **THEN** the app calls `PATCH /notes/{id}` with a body that has `content` and no `title`

#### Scenario: Successful save resets the baseline
- **WHEN** `PATCH /notes/{id}` answers 200
- **THEN** "Saved" is shown, **Save** is disabled and "Unsaved changes" is gone

#### Scenario: Reverting an edit clears the dirty state
- **WHEN** the user changes the title and then types the original title back
- **THEN** **Save** is disabled and "Unsaved changes" is not shown

#### Scenario: Keyboard shortcut saves
- **WHEN** the user has unsaved changes and presses `Ctrl+S`
- **THEN** the app calls `PATCH /notes/{id}` once and the default browser action is prevented

#### Scenario: Save refreshes the list
- **WHEN** a note has been saved and the user returns to `/`
- **THEN** the list shows the new title without a manual reload

### Requirement: Title validation
The title input SHALL have the accessible label "Title" and `maxLength` of 200. Before sending, the page SHALL validate the title with the shared title rule (trimmed, 1 to 200 characters). A blank title SHALL show the message "Title is required" in a `role="alert"` element tied to the input with `aria-describedby` and send no request. When the API answers 400 `VALIDATION_ERROR` with `details`, the message for `title` SHALL appear under the input.

#### Scenario: Blank title is rejected locally
- **WHEN** the user clears the title of an existing note and presses `Ctrl+S`
- **THEN** "Title is required" is shown, the input has `aria-invalid="true"` and no request is sent

#### Scenario: Server title error is shown
- **WHEN** `PATCH /notes/{id}` answers 400 `VALIDATION_ERROR` with a `title` detail message
- **THEN** that message is shown under the title input and the user's edits are kept

### Requirement: Unsaved-changes guard
While the page has unsaved changes, leaving it SHALL require confirmation: closing or reloading the tab SHALL trigger the browser's `beforeunload` prompt, and in-app navigation (the back link, the browser back button, a link to another route) SHALL show a confirmation dialog with **Stay** and **Discard changes**. Without unsaved changes, neither SHALL appear. A successful save, create or delete SHALL NOT trigger the guard.

#### Scenario: Clean page leaves without a prompt
- **WHEN** the user opens a note, changes nothing and clicks the back link
- **THEN** the app navigates to `/` with no confirmation

#### Scenario: Dirty page asks before leaving
- **WHEN** the user has unsaved changes and clicks the back link
- **THEN** a dialog offers **Stay** and **Discard changes** and the app stays on the editor

#### Scenario: Stay keeps the edits
- **WHEN** the dialog is open and the user chooses **Stay**
- **THEN** the dialog closes and the title and content edits are still there

#### Scenario: Discard leaves the page
- **WHEN** the dialog is open and the user chooses **Discard changes**
- **THEN** the app navigates to `/`

#### Scenario: Browser unload is guarded only when dirty
- **WHEN** a `beforeunload` event fires on a dirty page and on a clean page
- **THEN** it is default-prevented on the dirty page and not on the clean page

#### Scenario: Saving then navigating does not prompt
- **WHEN** a new note is created and the app moves to `/notes/<id>`, or a save succeeds and the user clicks the back link
- **THEN** no confirmation dialog is shown

### Requirement: Save failures
When creating or saving fails, the page SHALL show an alert with the failure message, keep the title and content exactly as the user left them, keep **Save** enabled and keep the unsaved state. A 404 on save SHALL show the not-found state described below. A 401 SHALL follow the shared refresh flow from AB-1010 (one refresh, retry, then `/login` if refresh is rejected). **Save** SHALL be disabled while a save is in flight so a second click cannot send a duplicate request.

#### Scenario: Server error keeps edits
- **WHEN** `PATCH /notes/{id}` answers 500
- **THEN** an alert is shown, the edits remain in the title and editor, and **Save** is enabled

#### Scenario: Network failure keeps edits
- **WHEN** the save request fails with a network error
- **THEN** an alert is shown and the edits remain

#### Scenario: Retrying after failure succeeds
- **WHEN** a save failed with 500 and the user clicks **Save** again and the API answers 200
- **THEN** the alert is cleared and "Saved" is shown

#### Scenario: Double click sends one request
- **WHEN** the user clicks **Save** twice before the response arrives
- **THEN** exactly one request is sent and **Save** is disabled until it settles

#### Scenario: Note disappears while editing
- **WHEN** `PATCH /notes/{id}` answers 404 `NOT_FOUND`
- **THEN** the not-found state is shown

### Requirement: Load states
While `GET /notes/{id}` is pending the page SHALL show a `role="status"` element "Loading note" and no editor. When it answers 404 `NOT_FOUND` (unknown, deleted, someone else's, or any malformed id) the page SHALL show "Note not found" with a link to `/`. When it fails with a network error, 5xx or a response that fails `noteSchema`, the page SHALL show a `role="alert"` with **Retry**, which re-requests the note. Navigating from one note to another SHALL reset the editor to the new note without keeping the old note's unsaved text.

#### Scenario: Loading state
- **WHEN** `/notes/<id>` is opened and the response has not arrived
- **THEN** a status "Loading note" is shown and the editor is not rendered

#### Scenario: Missing note
- **WHEN** `GET /notes/{id}` answers 404 `NOT_FOUND`
- **THEN** "Note not found" and a link to `/` are shown

#### Scenario: Malformed id is not found
- **WHEN** the user opens `/notes/not-a-uuid` and the API answers 400 `VALIDATION_ERROR`
- **THEN** "Note not found" is shown

#### Scenario: Load failure can be retried
- **WHEN** `GET /notes/{id}` answers 500 and the user clicks **Retry** and the API then answers 200
- **THEN** the alert is replaced by the note

#### Scenario: Invalid response body is a failure
- **WHEN** `GET /notes/{id}` answers 200 with a body that fails `noteSchema`
- **THEN** the load-failure alert with **Retry** is shown

#### Scenario: Switching notes resets the editor
- **WHEN** the user moves from `/notes/a` to `/notes/b` (after discarding or without edits)
- **THEN** the title and editor show note b's data, not note a's

### Requirement: Tags on a note
On a saved note the page SHALL show a group labelled "Tags" with one toggle button per tag from `GET /tags` (name, colored like `TagChip`, `aria-pressed` true when attached). Pressing an unattached tag SHALL call `PUT /notes/{id}/tags/{tagId}`; pressing an attached tag SHALL call `DELETE /notes/{id}/tags/{tagId}`. The button state SHALL change on success only, and the notes-list and tags queries SHALL be invalidated. A tag toggle SHALL NOT change the title or content, SHALL NOT count as an unsaved change and SHALL NOT send `PATCH`. On `/notes/new` the group SHALL be disabled with the text "Save the note to add tags". If there are no tags the group SHALL say "No tags yet". If tags fail to load the group SHALL show "Couldn't load tags" with **Retry** and the rest of the editor SHALL keep working.

#### Scenario: Attached tags are pressed
- **WHEN** a note with the tag Work is opened and the user has tags Work and Home
- **THEN** Work has `aria-pressed="true"` and Home has `aria-pressed="false"`

#### Scenario: Pressing a tag attaches it
- **WHEN** the user presses Home
- **THEN** the app calls `PUT /notes/{id}/tags/{homeId}` and Home becomes pressed

#### Scenario: Pressing an attached tag detaches it
- **WHEN** the user presses Work, which is attached
- **THEN** the app calls `DELETE /notes/{id}/tags/{workId}` and Work becomes unpressed

#### Scenario: Tag change keeps the state clean
- **WHEN** the user toggles a tag on a note with no other edits
- **THEN** **Save** stays disabled, "Unsaved changes" is not shown and no `PATCH` is sent

#### Scenario: Tag change keeps unsaved edits
- **WHEN** the user has unsaved title edits and toggles a tag successfully
- **THEN** the edited title is still in the input and still unsaved

#### Scenario: Failed tag change leaves the button alone
- **WHEN** `PUT /notes/{id}/tags/{tagId}` answers 500
- **THEN** the button keeps its previous pressed state and an alert names the failure

#### Scenario: Tag deleted elsewhere
- **WHEN** `PUT /notes/{id}/tags/{tagId}` answers 404 `NOT_FOUND`
- **THEN** the tags list is re-fetched and an alert says the tag no longer exists

#### Scenario: New note cannot take tags yet
- **WHEN** the user opens `/notes/new`
- **THEN** the tag buttons are disabled and "Save the note to add tags" is shown

#### Scenario: No tags exist
- **WHEN** `GET /tags` returns no items on a saved note
- **THEN** "No tags yet" is shown

#### Scenario: Tags load failure is isolated
- **WHEN** `GET /tags` answers 500 and `GET /notes/{id}` answers 200
- **THEN** the note is editable, the Tags group shows "Couldn't load tags" with **Retry**, and Retry re-requests tags

### Requirement: Deleting a note
On a saved note the page SHALL show a **Delete** button. Activating it SHALL open a dialog (`role="dialog"`, labelled by its title "Delete this note?") with **Cancel** and **Delete note**; focus SHALL move into the dialog and Escape SHALL close it. Confirming SHALL call `DELETE /notes/{id}`; on 204 the app SHALL navigate to `/` without the unsaved-changes prompt and invalidate the notes-list and tags queries. On failure the dialog SHALL stay open with an alert and **Delete note** enabled again. The button SHALL NOT exist on `/notes/new`. Deleting is a soft delete (the API sets `deletedAt`); the page never promises permanent removal.

#### Scenario: Delete asks for confirmation
- **WHEN** the user clicks **Delete**
- **THEN** a dialog titled "Delete this note?" appears with **Cancel** and **Delete note**, and no request is sent

#### Scenario: Cancel keeps the note
- **WHEN** the dialog is open and the user clicks **Cancel** or presses Escape
- **THEN** the dialog closes and no `DELETE` request is sent

#### Scenario: Confirming deletes and returns to the list
- **WHEN** the user confirms and `DELETE /notes/{id}` answers 204
- **THEN** the app navigates to `/` and the deleted note is not in the list

#### Scenario: Delete works with unsaved edits
- **WHEN** the user has unsaved edits, confirms deletion and the API answers 204
- **THEN** the app navigates to `/` without the unsaved-changes dialog

#### Scenario: Delete failure keeps the dialog
- **WHEN** `DELETE /notes/{id}` answers 500
- **THEN** the dialog stays open with an alert and **Delete note** is enabled

#### Scenario: Already-deleted note
- **WHEN** `DELETE /notes/{id}` answers 404 `NOT_FOUND`
- **THEN** the app navigates to `/` (the note is already gone)

#### Scenario: No delete on a new note
- **WHEN** the user opens `/notes/new`
- **THEN** there is no **Delete** button

### Requirement: Notes API functions
`apps/frontend/src/api/notes.ts` SHALL export `getNote`, `createNote`, `updateNote`, `deleteNote`, `attachTag` and `detachTag`. They SHALL use the shared API client with bearer auth, validate every JSON response with `noteSchema` from `@todo/shared`, send bodies that conform to `createNoteRequestSchema` and `updateNoteRequestSchema`, and treat 204 as success without a body. The frontend SHALL NOT redefine any type or Zod schema that exists in `packages/shared`.

#### Scenario: getNote calls the item endpoint
- **WHEN** `getNote("n1")` is called
- **THEN** it sends `GET /notes/n1` with the bearer token and returns the parsed note

#### Scenario: createNote posts the body
- **WHEN** `createNote({ title, content })` is called
- **THEN** it sends `POST /notes` with that JSON body and returns the parsed note

#### Scenario: updateNote patches only what it is given
- **WHEN** `updateNote("n1", { title: "New" })` is called
- **THEN** it sends `PATCH /notes/n1` with the body `{"title":"New"}`

#### Scenario: deleteNote accepts 204
- **WHEN** `deleteNote("n1")` is called and the API answers 204
- **THEN** the promise resolves with no value

#### Scenario: attachTag and detachTag use the tag routes
- **WHEN** `attachTag("n1", "t1")` and `detachTag("n1", "t1")` are called
- **THEN** they send `PUT /notes/n1/tags/t1` and `DELETE /notes/n1/tags/t1` and resolve on 204

#### Scenario: Malformed note response is rejected
- **WHEN** the API answers 200 with a body that fails `noteSchema`
- **THEN** `getNote` rejects instead of returning the body

### Requirement: Editor accessibility baseline
The title input SHALL be reachable by its label, every toolbar and tag button SHALL have an accessible name, the editable area SHALL have `role="textbox"` and the accessible name "Note content", the page SHALL have exactly one `h1`, and the delete and discard dialogs SHALL trap focus, label themselves and return focus to the opener on close.

#### Scenario: Controls have accessible names
- **WHEN** a saved note is shown
- **THEN** the title input is found by label "Title", the editor by role `textbox` named "Note content", and the page has exactly one `h1`

#### Scenario: Dialog returns focus
- **WHEN** the user opens the delete dialog and cancels it
- **THEN** focus returns to the **Delete** button
