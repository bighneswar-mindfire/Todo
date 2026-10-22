# Spec Delta

## Purpose

Lets the owner of a saved note create a new tag from the note editor's Tags group and have it attached to that note, so a user with no tags can start tagging without leaving the editor.

## ADDED Requirements

### Requirement: New tag form
On a saved note, the Tags group SHALL show a **New tag** button that opens an inline form named "New tag" with a text input labelled "Tag name", a colour input labelled "Tag colour" starting at `#6b7280`, a **Create tag** button and a **Cancel** button. Opening the form SHALL focus "Tag name" and hide **New tag**. On `/notes/new` the **New tag** button SHALL be present and disabled together with the rest of the group, which keeps its text "Save the note to add tags".

#### Scenario: New tag opens the form
- **WHEN** a user on a saved note activates **New tag**
- **THEN** a form labelled "New tag" is shown with "Tag name" focused, "Tag colour" set to `#6b7280`, **Create tag** and **Cancel**, and no request is sent

#### Scenario: New note cannot create tags yet
- **WHEN** the editor is on `/notes/new`
- **THEN** **New tag** is disabled and "Save the note to add tags" is shown

### Requirement: Cancelling the new tag form
**Cancel** SHALL hide the form, discard what was typed, send no request and focus **New tag**.

#### Scenario: Cancel closes the form without a request
- **WHEN** the user has typed a name and activates **Cancel**
- **THEN** the form is hidden, **New tag** is shown and focused, and no request is sent

#### Scenario: Reopened form starts empty
- **WHEN** the user types a name, cancels, and activates **New tag** again
- **THEN** "Tag name" is empty and "Tag colour" is `#6b7280`

### Requirement: Create and attach a tag
Submitting the form SHALL send `POST /tags` with `{ name, color }` (the trimmed name and the colour input's value) and, on 201, `PUT /notes/{id}/tags/{tagId}` for the open note. On 204 the new tag SHALL appear in the Tags group as a pressed toggle, the form SHALL close, focus SHALL return to **New tag**, and the tags and notes-list queries SHALL be refreshed. While the requests are in flight **Create tag** SHALL be disabled, so a second activation sends no second `POST /tags`.

#### Scenario: Creating a tag adds it and attaches it
- **WHEN** a user on a saved note enters `Work`, keeps the default colour and activates **Create tag**, and the API answers 201 then 204
- **THEN** the app calls `POST /tags` with `{ "name": "Work", "color": "#6b7280" }` and then `PUT /notes/{id}/tags/{tagId}`, "Work" appears as a pressed button in the Tags group, the form is closed and **New tag** is focused

#### Scenario: Name is trimmed before sending
- **WHEN** the user enters `  Work  ` and activates **Create tag**
- **THEN** the body of `POST /tags` has `name` equal to `Work`

#### Scenario: Chosen colour is sent
- **WHEN** the user sets "Tag colour" to `#ff0000` and creates the tag `Urgent`
- **THEN** the body of `POST /tags` is `{ "name": "Urgent", "color": "#ff0000" }`

#### Scenario: Creating refreshes tags and lists
- **WHEN** a tag is created and attached successfully
- **THEN** `GET /tags` is requested again and the notes-list queries are marked stale

#### Scenario: Double submit sends one request
- **WHEN** the user activates **Create tag** twice before `POST /tags` has answered
- **THEN** exactly one `POST /tags` request is sent and **Create tag** is disabled until it answers

### Requirement: Creating a tag is not an edit
Creating a tag SHALL NOT change the title or content, SHALL NOT count as an unsaved change and SHALL NOT send `PATCH`.

#### Scenario: Created tag keeps unsaved edits
- **WHEN** the user has unsaved title edits and creates a tag successfully
- **THEN** the title input still holds the edit, "Unsaved changes" is still shown and no `PATCH` request is sent

#### Scenario: Created tag on a clean note keeps the state clean
- **WHEN** the user creates a tag on a note with no other edits
- **THEN** "Unsaved changes" is not shown and no `PATCH` request is sent

### Requirement: Tag name validation
The form SHALL validate the name with the shared create-tag request schema before sending. A name that is empty, only whitespace or longer than 50 characters SHALL show the inline error "Enter a tag name of 1 to 50 characters" on "Tag name" (`aria-invalid` true, linked with `aria-describedby`), send no request and keep the form open with what was typed.

#### Scenario: Blank name rejected in the browser
- **WHEN** the user leaves "Tag name" empty or types only spaces and activates **Create tag**
- **THEN** the error "Enter a tag name of 1 to 50 characters" is shown on "Tag name" and no request is sent

#### Scenario: Overlong name rejected in the browser
- **WHEN** the user enters a 51-character name and activates **Create tag**
- **THEN** the error "Enter a tag name of 1 to 50 characters" is shown and no request is sent

#### Scenario: Name of 50 characters is accepted
- **WHEN** the user enters a 50-character name and activates **Create tag**
- **THEN** `POST /tags` is sent with that name

### Requirement: Duplicate tag names
A 409 `TAG_NAME_TAKEN` from `POST /tags` SHALL show the inline error "You already have a tag with that name" on "Tag name", keep the form open with what was typed and send no attach request. Names are case-sensitive: the browser SHALL NOT compare the name with the loaded tags.

#### Scenario: Duplicate name shows a field error
- **WHEN** `POST /tags` answers 409 `TAG_NAME_TAKEN`
- **THEN** "You already have a tag with that name" is shown on "Tag name", the typed name is kept, the form stays open and no `PUT` request is sent

#### Scenario: Same name in another case is sent
- **WHEN** the user already has a tag `Work` and creates `work`
- **THEN** `POST /tags` is sent with `work`

### Requirement: Tag creation failures
When `POST /tags` fails for any reason other than a 409 (a 400 `VALIDATION_ERROR` the browser should have caught, a 500, a malformed body or a network failure), the form SHALL stay open with the typed name and colour and show the alert "Something went wrong, please try again", and **Create tag** SHALL be enabled again.

#### Scenario: Server failure keeps the form
- **WHEN** `POST /tags` answers 500
- **THEN** an alert "Something went wrong, please try again" is shown, the name and colour are kept, the form stays open and **Create tag** is enabled

#### Scenario: Unexpected validation error from the server
- **WHEN** `POST /tags` answers 400 `VALIDATION_ERROR` for a name the browser accepted
- **THEN** the alert "Something went wrong, please try again" is shown and the form stays open

#### Scenario: Network failure keeps the form
- **WHEN** the `POST /tags` request fails without a response
- **THEN** the alert "Something went wrong, please try again" is shown and the typed values are kept

### Requirement: Attach failure after create
When `POST /tags` succeeds but the attach request fails with any status, including 404 `NOT_FOUND` (the note was deleted elsewhere), the tags query SHALL be refreshed, the new tag SHALL be listed unpressed, the form SHALL close and an alert SHALL say "Tag created, but it could not be added to this note. Press it to try again". The editor SHALL stay usable.

#### Scenario: Attach failure after create
- **WHEN** `POST /tags` answers 201 and `PUT /notes/{id}/tags/{tagId}` answers 500
- **THEN** the alert "Tag created, but it could not be added to this note. Press it to try again" is shown, the new tag is listed unpressed, the form is closed and pressing the tag retries the attach

#### Scenario: Attach on a deleted note
- **WHEN** `POST /tags` answers 201 and the `PUT` answers 404 `NOT_FOUND`
- **THEN** the same alert is shown and the new tag is listed unpressed

### Requirement: Session handling for tag creation
`POST /tags` and the attach request SHALL send the access token and follow the AB-1010 session flow: a 401 triggers one refresh and one retry, and if the server rejects the refresh the session SHALL be cleared and the user sent to `/login`.

#### Scenario: Expired session on create
- **WHEN** `POST /tags` answers 401 and the refresh request is rejected
- **THEN** the session is cleared, the app shows the login page and no further request to `/tags` is sent

#### Scenario: Expired token is refreshed once
- **WHEN** `POST /tags` answers 401 and the refresh succeeds
- **THEN** the create is retried once with the new token and the tag is created and attached

### Requirement: Tag creation API function
`apps/frontend/src/api/notes.ts` SHALL export `createTag(input)`. It SHALL validate `input` with `createTagRequestSchema` from `@todo/shared` before any request, send `POST /tags` with bearer auth and the validated body, validate the 201 response with `tagSchema`, and throw an `ApiError` carrying the error code for failures. The frontend SHALL NOT redefine any type or Zod schema that exists in `packages/shared`.

#### Scenario: createTag posts the validated body
- **WHEN** `createTag({ name: " Work ", color: "#ff0000" })` is called
- **THEN** it sends `POST /tags` with `{ "name": "Work", "color": "#ff0000" }` and resolves with the parsed tag

#### Scenario: createTag rejects invalid input without a request
- **WHEN** `createTag({ name: "   ", color: "#6b7280" })` is called
- **THEN** it rejects and no request is sent

#### Scenario: createTag rejects a malformed response
- **WHEN** `POST /tags` answers 201 with a body that fails `tagSchema`
- **THEN** `createTag` rejects and the form shows the generic alert

### Requirement: Tag form accessibility
The "Tag name" input and "Tag colour" input SHALL be reachable by their labels, the form SHALL be a `form` landmark named "New tag", the validation and failure messages SHALL be announced through `role="alert"`, and **Create tag**, **Cancel** and **New tag** SHALL be reachable by keyboard in that DOM order. Pressing Enter in "Tag name" SHALL submit the form and Escape SHALL cancel it.

#### Scenario: Fields have accessible names
- **WHEN** the New tag form is shown
- **THEN** `getByLabelText("Tag name")`, `getByLabelText("Tag colour")` and a form named "New tag" are found

#### Scenario: Enter submits
- **WHEN** the user types a valid name and presses Enter in "Tag name"
- **THEN** `POST /tags` is sent

#### Scenario: Escape cancels
- **WHEN** the form is shown and the user presses Escape in "Tag name"
- **THEN** the form is hidden, **New tag** is focused and no request is sent
