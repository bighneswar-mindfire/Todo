# tags Specification

## Purpose
TBD - created by archiving change ab-1005. Update Purpose after archive.

## Requirements

### Requirement: Tags require authentication
All `/tags` endpoints and the `/notes/{id}/tags/{tagId}` endpoints SHALL require a valid access token and SHALL only read or modify tags owned by the authenticated user.

#### Scenario: Missing token rejected
- **WHEN** a client calls `GET /tags` without an `Authorization` header
- **THEN** the response is 401 with error code `UNAUTHORIZED`

### Requirement: Create tag
The system SHALL let an authenticated user create a tag via `POST /tags` with a `name` and optional `color`. The name SHALL be trimmed and 1 to 50 characters. The color SHALL match `#RRGGBB` and default to `#6b7280`. Names SHALL be unique per user (case-sensitive).

#### Scenario: Create tag with valid input
- **WHEN** an authenticated user posts `{ "name": "Work", "color": "#ff0000" }` to `/tags`
- **THEN** the response is 201 with the tag `id`, `name`, `color` and `createdAt`, owned by that user

#### Scenario: Color defaults
- **WHEN** a user creates a tag without a color
- **THEN** the response is 201 and `color` is `#6b7280`

#### Scenario: Name is trimmed
- **WHEN** a user creates a tag named `"  Work  "`
- **THEN** the returned and stored name is `Work`

#### Scenario: Empty or overlong name rejected
- **WHEN** a user creates a tag whose name is empty, only whitespace, or longer than 50 characters
- **THEN** the response is 400 with error code `VALIDATION_ERROR`

#### Scenario: Invalid color rejected
- **WHEN** a user creates a tag with color `"red"` or `"#12345"`
- **THEN** the response is 400 with error code `VALIDATION_ERROR` and no tag is created

#### Scenario: Duplicate name rejected
- **WHEN** a user creates a tag with a name they already use
- **THEN** the response is 409 with error code `TAG_NAME_TAKEN`

#### Scenario: Same name allowed for different users
- **WHEN** two different users each create a tag named `Work`
- **THEN** both responses are 201

### Requirement: List tags
The system SHALL return all of the authenticated user's tags via `GET /tags`, ordered by `name` ascending, each with `id`, `name`, `color`, `createdAt` and `noteCount`. `noteCount` SHALL count only the user's active (not soft-deleted) notes carrying the tag. The response SHALL be `{ items }` with no pagination.

#### Scenario: List returns only own tags
- **WHEN** a user with two tags and a second user with one tag calls `GET /tags`
- **THEN** the response is 200 with exactly the caller's two tags ordered by name

#### Scenario: noteCount counts active notes only
- **WHEN** a tag is attached to three notes and one of them is soft deleted
- **THEN** that tag's `noteCount` is 2

### Requirement: Update tag
The system SHALL let the owner partially update a tag via `PATCH /tags/{id}` with `name` and/or `color`, under the same validation as creation. At least one field is required.

#### Scenario: Rename and recolor
- **WHEN** a user patches their tag with a new valid name and color
- **THEN** the response is 200 with the updated tag

#### Scenario: Empty patch rejected
- **WHEN** a user patches a tag with an empty body
- **THEN** the response is 400 with error code `VALIDATION_ERROR`

#### Scenario: Rename to existing name rejected
- **WHEN** a user renames a tag to the name of another of their tags
- **THEN** the response is 409 with error code `TAG_NAME_TAKEN`

#### Scenario: Renaming to its own current name succeeds
- **WHEN** a user patches a tag with its existing name and a new color
- **THEN** the response is 200

#### Scenario: Other user's tag hidden on update
- **WHEN** a user patches a tag owned by someone else
- **THEN** the response is 404 with error code `NOT_FOUND` and the tag is unchanged

### Requirement: Delete tag
The system SHALL let the owner delete a tag via `DELETE /tags/{id}`. Deleting SHALL remove the tag and its note associations and SHALL NOT modify or delete any note.

#### Scenario: Delete tag detaches from notes
- **WHEN** a user deletes a tag attached to two notes
- **THEN** the response is 204, the tag no longer appears in `GET /tags`, and both notes still exist with the tag absent from their `tags`

#### Scenario: Other user's tag hidden on delete
- **WHEN** a user deletes a tag owned by someone else
- **THEN** the response is 404 with error code `NOT_FOUND` and the tag still exists

#### Scenario: Unknown tag
- **WHEN** a user deletes a well-formed id that does not exist
- **THEN** the response is 404 with error code `NOT_FOUND`

#### Scenario: Malformed tag id rejected
- **WHEN** a user calls `DELETE /tags/not-a-uuid`
- **THEN** the response is 400 with error code `VALIDATION_ERROR`

### Requirement: Attach tag to note
The system SHALL let the owner attach one of their tags to one of their active notes via `PUT /notes/{id}/tags/{tagId}`. The operation SHALL be idempotent. A note or tag that does not exist, belongs to another user, or (for the note) is soft deleted SHALL yield 404 `NOT_FOUND`.

#### Scenario: Attach tag
- **WHEN** a user attaches their tag to their active note
- **THEN** the response is 204 and `GET /notes/{id}` lists that tag in `tags`

#### Scenario: Attach is idempotent
- **WHEN** a user attaches the same tag to the same note twice
- **THEN** both responses are 204 and the note lists the tag once

#### Scenario: Other user's tag cannot be attached
- **WHEN** a user attaches a tag owned by someone else to their own note
- **THEN** the response is 404 with error code `NOT_FOUND` and the note is unchanged

#### Scenario: Other user's note hidden on attach
- **WHEN** a user attaches their own tag to a note owned by someone else
- **THEN** the response is 404 with error code `NOT_FOUND`

#### Scenario: Deleted note cannot be tagged
- **WHEN** a user attaches a tag to their own soft-deleted note
- **THEN** the response is 404 with error code `NOT_FOUND`

#### Scenario: Malformed ids rejected on attach
- **WHEN** a user calls `PUT /notes/{id}/tags/{tagId}` with a non-UUID `id` or `tagId`
- **THEN** the response is 400 with error code `VALIDATION_ERROR`

### Requirement: Detach tag from note
The system SHALL let the owner detach a tag from one of their active notes via `DELETE /notes/{id}/tags/{tagId}`. The operation SHALL be idempotent. A note or tag that does not exist, belongs to another user, or (for the note) is soft deleted SHALL yield 404 `NOT_FOUND`. Detaching SHALL NOT delete the tag.

#### Scenario: Detach tag
- **WHEN** a user detaches an attached tag from their note
- **THEN** the response is 204, the note's `tags` no longer contains it, and the tag still appears in `GET /tags`

#### Scenario: Detach is idempotent
- **WHEN** a user detaches a tag that is not attached to their note
- **THEN** the response is 204

#### Scenario: Other user's note hidden on detach
- **WHEN** a user detaches their own tag from a note owned by someone else
- **THEN** the response is 404 with error code `NOT_FOUND`

#### Scenario: Deleted note cannot be untagged
- **WHEN** a user detaches a tag from their own soft-deleted note
- **THEN** the response is 404 with error code `NOT_FOUND`

### Requirement: Notes expose their tags
`GET /notes/{id}`, `POST /notes`, `PATCH /notes/{id}` and `POST /notes/{id}/restore` SHALL include a `tags` array of `{ id, name, color }` on the returned note, ordered by name ascending. A newly created note SHALL have an empty `tags` array.

#### Scenario: Get note includes tags
- **WHEN** a user gets a note with two attached tags
- **THEN** the response includes both in `tags`, ordered by name

#### Scenario: New note has no tags
- **WHEN** a user creates a note
- **THEN** the response `tags` is an empty array

#### Scenario: Restore keeps tags
- **WHEN** a user soft deletes a tagged note and then restores it
- **THEN** the restored note's `tags` still contains the tag

#### Scenario: Deleting a note keeps its tag
- **WHEN** a user soft deletes a tagged note
- **THEN** the tag still appears in `GET /tags`
