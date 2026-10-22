# Spec Delta

## ADDED Requirements

### Requirement: Autosave
The editor SHALL save edits automatically. When the title or content differs from the last saved state and the trimmed title is non-empty, a save SHALL be sent 1000 ms after the last edit: `PATCH /notes/{id}` with only the changed fields and `autosave: true`, or `POST /notes` on `/notes/new`. At most one save SHALL be in flight; edits made meanwhile SHALL be sent in a single follow-up save of the latest state once it settles. A blank title SHALL NOT be autosaved.

#### Scenario: Idle edit is autosaved
- **WHEN** the user changes the title of a loaded note and 1000 ms pass without further edits
- **THEN** the app calls `PATCH /notes/{id}` once with the new `title`, no `content` and `autosave` true

#### Scenario: Typing restarts the timer
- **WHEN** the user makes an edit every 500 ms for 3 seconds
- **THEN** no request is sent during the typing and one is sent 1000 ms after the last edit

#### Scenario: Edits during a save are queued
- **WHEN** the user edits while an autosave is in flight and then edits again
- **THEN** no second request is sent until the first settles, and then exactly one follow-up request carries the latest title and content

#### Scenario: Blank title is not autosaved
- **WHEN** the user clears the title of a saved note and waits longer than 1000 ms
- **THEN** no request is sent and "Title is required" appears once the title input loses focus

#### Scenario: New note is created on idle
- **WHEN** the user types the title "Groceries" on `/notes/new` and waits 1000 ms
- **THEN** the app calls `POST /notes` once with the trimmed title and the app is on `/notes/<id>`

#### Scenario: Typing during create is kept
- **WHEN** the user keeps typing in the editor while the `POST /notes` request is in flight
- **THEN** the typed text is still in the editor after the app moves to `/notes/<id>` and a following `PATCH` saves it

#### Scenario: Explicit save is immediate
- **WHEN** a save is waiting and the user presses `Ctrl+S`
- **THEN** one `PATCH` is sent at once without `autosave` and no second request follows when the timer would have fired

#### Scenario: Autosave of a note that is gone
- **WHEN** an autosave answers 404 `NOT_FOUND` (deleted, or not the caller's note)
- **THEN** the not-found state is shown

#### Scenario: Server rejects the autosaved title
- **WHEN** an autosave answers 400 `VALIDATION_ERROR` with a `title` detail message
- **THEN** that message is shown under the title input and the edits remain

#### Scenario: Delete cancels a pending autosave
- **WHEN** a save is waiting, the user confirms deletion and the API answers 204
- **THEN** no `PATCH` is sent afterwards

#### Scenario: Restore cancels a pending autosave
- **WHEN** a save is waiting and the user restores a version from the history drawer
- **THEN** no `PATCH` is sent afterwards and the editor shows the restored note

### Requirement: Save status and failed autosave
The page SHALL show a status: "Unsaved changes" while a save is waiting, "Saving" while one is in flight, "Saved" after success, and "Couldn't save" with a **Retry** button after a failure. After a failed autosave the alert SHALL be shown, the edits SHALL remain, and no further automatic request SHALL be sent until the next edit or **Retry**.

#### Scenario: Status follows the save
- **WHEN** an autosave is waiting, then in flight, then answered with 200
- **THEN** the status shows "Unsaved changes", then "Saving", then "Saved"

#### Scenario: Failed autosave keeps edits and offers retry
- **WHEN** an autosave answers 500
- **THEN** an alert and the status "Couldn't save" with **Retry** are shown, the edits remain, and no further request is sent without another edit or **Retry**

#### Scenario: Retry after a failed autosave
- **WHEN** an autosave failed with 500 and the user clicks **Retry** and the API answers 200
- **THEN** the alert is cleared and the status shows "Saved"

## MODIFIED Requirements

### Requirement: Creating a note
On `/notes/new`, **Save** SHALL be enabled only when the trimmed title is non-empty. Saving, by **Save**, `Ctrl+S` or autosave, SHALL send `POST /notes` with `{ title, content }` (title trimmed, content from `getJSON()`). On 201 the app SHALL replace the URL with `/notes/<new id>` and show the saved note without discarding text typed since the request was sent. The notes-list and tags queries SHALL be invalidated.

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
On `/notes/:id`, **Save** SHALL be enabled only when the title or the content differs from the last saved or loaded version, the trimmed title is non-empty and no save is in flight. **Save** and `Ctrl+S` or `Cmd+S` SHALL cancel a waiting autosave and send `PATCH /notes/{id}` at once, containing only the fields that changed and no `autosave` flag, and `Ctrl+S` SHALL prevent the browser's own save dialog. On 200 the saved values SHALL become the new baseline ("Saved" shown), and the notes-list and tags queries SHALL be invalidated. The page SHALL show "Unsaved changes" while it differs from the baseline.

#### Scenario: Save is disabled when nothing changed
- **WHEN** a note has just been loaded
- **THEN** **Save** is disabled and "Unsaved changes" is not shown

#### Scenario: Editing enables Save and shows the dirty marker
- **WHEN** the user changes the title
- **THEN** **Save** is enabled and "Unsaved changes" is shown

#### Scenario: Only the title is sent when only the title changed
- **WHEN** the user changes the title and clicks **Save**
- **THEN** the app calls `PATCH /notes/{id}` with a body that has `title`, no `content` and no `autosave`

#### Scenario: Only the content is sent when only the content changed
- **WHEN** the user types in the editor and clicks **Save**
- **THEN** the app calls `PATCH /notes/{id}` with a body that has `content`, no `title` and no `autosave`

#### Scenario: Successful save resets the baseline
- **WHEN** `PATCH /notes/{id}` answers 200
- **THEN** "Saved" is shown, **Save** is disabled and "Unsaved changes" is gone

#### Scenario: Reverting an edit clears the dirty state
- **WHEN** the user changes the title and then types the original title back
- **THEN** **Save** is disabled and "Unsaved changes" is not shown and no request is sent

#### Scenario: Keyboard shortcut saves
- **WHEN** the user has unsaved changes and presses `Ctrl+S`
- **THEN** the app calls `PATCH /notes/{id}` once and the default browser action is prevented

#### Scenario: Save refreshes the list
- **WHEN** a note has been saved and the user returns to `/`
- **THEN** the list shows the new title without a manual reload

### Requirement: Unsaved-changes guard
While the page has changes that are not saved (waiting, in flight or failed), closing or reloading the tab SHALL trigger the browser's `beforeunload` prompt. In-app navigation (the back link, the browser back button, a link to another route) SHALL first send the pending save and continue once it succeeds, with no dialog. If the save fails or the title is blank, a confirmation dialog with **Stay** and **Discard changes** SHALL be shown. Without unsaved changes, neither SHALL appear. A successful save, create or delete SHALL NOT trigger the guard.

#### Scenario: Clean page leaves without a prompt
- **WHEN** the user opens a note, changes nothing and clicks the back link
- **THEN** the app navigates to `/` with no confirmation

#### Scenario: Pending save is flushed on leave
- **WHEN** a save is waiting and the user clicks the back link and `PATCH /notes/{id}` answers 200
- **THEN** one `PATCH` is sent and the app navigates to `/` with no dialog

#### Scenario: Dirty page asks before leaving
- **WHEN** a save is waiting, the user clicks the back link and `PATCH /notes/{id}` answers 500
- **THEN** a dialog offers **Stay** and **Discard changes** and the app stays on the editor

#### Scenario: Blank title asks before leaving
- **WHEN** the user clears the title of a saved note and clicks the back link
- **THEN** no request is sent and a dialog offers **Stay** and **Discard changes**

#### Scenario: Stay keeps the edits
- **WHEN** the dialog is open and the user chooses **Stay**
- **THEN** the dialog closes and the title and content edits are still there

#### Scenario: Discard leaves the page
- **WHEN** the dialog is open and the user chooses **Discard changes**
- **THEN** the app navigates to `/`

#### Scenario: Browser unload is guarded only when dirty
- **WHEN** a `beforeunload` event fires on a page with unsaved changes and on a clean page
- **THEN** it is default-prevented on the first and not on the second

#### Scenario: Saving then navigating does not prompt
- **WHEN** a new note is created and the app moves to `/notes/<id>`, or a save succeeds and the user clicks the back link
- **THEN** no confirmation dialog is shown

### Requirement: Save failures
When creating or saving fails, whether by autosave or by **Save**, the page SHALL show an alert with the failure message and the status "Couldn't save" with **Retry**, keep the title and content exactly as the user left them and keep the unsaved state. **Save** SHALL stay enabled. A 404 on save SHALL show the not-found state described below. A 401 SHALL follow the shared refresh flow from AB-1010 (one refresh, retry, then `/login` if refresh is rejected). **Save** SHALL be disabled while a save is in flight so a second click cannot send a duplicate request.

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
