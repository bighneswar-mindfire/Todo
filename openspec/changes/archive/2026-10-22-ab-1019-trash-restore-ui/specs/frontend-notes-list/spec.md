## ADDED Requirements

### Requirement: Trash entry in the notes-list header
The notes-list header SHALL contain a link named **Trash** to `/trash`, beside **New note**, shown in every list state (loading, empty, error and loaded).

#### Scenario: Trash link is shown
- **WHEN** a signed-in user opens `/` and the API returns notes
- **THEN** the header shows a **Trash** link whose `href` is `/trash`

#### Scenario: Trash link is shown for an empty account
- **WHEN** a signed-in user with no notes opens `/`
- **THEN** the **Trash** link is still shown

#### Scenario: Trash link opens the trash page
- **WHEN** the user clicks **Trash**
- **THEN** the app is on `/trash` and `GET /notes/trash` is requested
