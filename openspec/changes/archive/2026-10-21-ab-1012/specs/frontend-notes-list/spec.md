## ADDED Requirements

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
