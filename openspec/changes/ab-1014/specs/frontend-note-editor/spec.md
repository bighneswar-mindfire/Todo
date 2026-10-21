# Spec Delta

## ADDED Requirements

### Requirement: Share entry in the editor
The editor of an existing note SHALL contain a **Share** button in its footer next to **Delete**. It SHALL NOT be shown for a note that has not been created yet. Activating it SHALL open the share dialog and SHALL NOT change the note, the title, the content or the dirty state.

#### Scenario: Share button on an existing note
- **WHEN** a user opens `/notes/{id}` and the note has loaded
- **THEN** the footer has a **Share** button

#### Scenario: No Share button on a new note
- **WHEN** a user opens `/notes/new`
- **THEN** there is no **Share** button

#### Scenario: Share button appears after the first save
- **WHEN** a user saves a new note and lands on `/notes/{id}`
- **THEN** the footer has a **Share** button

#### Scenario: Opening share leaves the editor untouched
- **WHEN** a user opens and closes the share dialog without editing
- **THEN** the title, content and **Save** button state are unchanged and no note request is sent
