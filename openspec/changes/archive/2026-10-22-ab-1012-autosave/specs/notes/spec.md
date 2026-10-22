# Spec Delta

## MODIFIED Requirements

### Requirement: Update note
The system SHALL let the owner partially update an active note via `PATCH /notes/{id}` with `title` and/or `content`. At least one of them SHALL be supplied. The request MAY also carry `autosave` (boolean, default false); on its own it is not enough, and a non-boolean value SHALL be rejected. Validation rules match creation. When `content` changes, `contentText` SHALL be re-derived. `updatedAt` SHALL advance. When the resulting title or content differs from the note's current title or content, the change SHALL be recorded in the same transaction (see the `versions` capability); when neither differs, the response SHALL be 200 and nothing SHALL be recorded.

#### Scenario: Update title only
- **WHEN** the owner patches only `title`
- **THEN** the response is 200 with the new title, unchanged content and a later `updatedAt`

#### Scenario: Update content re-derives text
- **WHEN** the owner patches `content` with new text
- **THEN** the response is 200 and the stored `contentText` reflects the new content only

#### Scenario: Empty patch rejected
- **WHEN** the owner patches with an empty object
- **THEN** the response is 400 with error code `VALIDATION_ERROR`

#### Scenario: Invalid field rejected
- **WHEN** the owner patches with an empty title
- **THEN** the response is 400 with error code `VALIDATION_ERROR` and the note is unchanged

#### Scenario: Cannot update another user's note
- **WHEN** a user patches a note owned by someone else
- **THEN** the response is 404 with error code `NOT_FOUND` and the note is unchanged

#### Scenario: Cannot update a deleted note
- **WHEN** the owner patches a soft-deleted note
- **THEN** the response is 404 with error code `NOT_FOUND`

#### Scenario: Update records a new version
- **WHEN** the owner patches the title of a note that has version 1
- **THEN** the note has two versions and version 2 carries the new title and current content

#### Scenario: Unchanged patch records no version
- **WHEN** the owner patches `title` and `content` with values equal to the current ones
- **THEN** the response is 200 and the note still has the same number of versions

#### Scenario: First edit of a pre-existing note starts its history
- **WHEN** the owner edits a note that has no versions because it predates versioning
- **THEN** the edit is recorded as version 1

#### Scenario: Autosave patch is accepted
- **WHEN** the owner patches `content` with `autosave` true
- **THEN** the response is 200 with the new content, and the response body has no `autosave` field

#### Scenario: Autosave flag alone rejected
- **WHEN** the owner patches with only `{ "autosave": true }`
- **THEN** the response is 400 with error code `VALIDATION_ERROR`

#### Scenario: Non-boolean autosave rejected
- **WHEN** the owner patches `title` with `autosave` set to the string "yes"
- **THEN** the response is 400 with error code `VALIDATION_ERROR` and the note is unchanged

#### Scenario: Autosave cannot touch another user's note
- **WHEN** a user sends an autosave patch for a note owned by someone else
- **THEN** the response is 404 with error code `NOT_FOUND` and the note and its versions are unchanged

#### Scenario: Unchanged autosave records nothing
- **WHEN** the owner sends an autosave patch whose `title` and `content` equal the current ones
- **THEN** the response is 200 and the note still has the same number of versions
