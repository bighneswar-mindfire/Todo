# Spec Delta

## ADDED Requirements

### Requirement: History entry in the editor
The editor of an existing note SHALL contain a **History** button in its footer next to **Share** and **Delete**. It SHALL NOT be shown for a note that has not been created yet. Activating it SHALL open the version history drawer and SHALL NOT change the note, the title, the content or the dirty state.

#### Scenario: History button on an existing note
- **WHEN** a user opens `/notes/{id}` and the note has loaded
- **THEN** the footer has a **History** button

#### Scenario: No History button on a new note
- **WHEN** a user opens `/notes/new`
- **THEN** there is no **History** button

#### Scenario: History button appears after the first save
- **WHEN** a user saves a new note and lands on `/notes/{id}`
- **THEN** the footer has a **History** button

#### Scenario: Opening history leaves the editor untouched
- **WHEN** a user opens and closes the history drawer without editing
- **THEN** the title, content and **Save** button state are unchanged and no note request is sent
