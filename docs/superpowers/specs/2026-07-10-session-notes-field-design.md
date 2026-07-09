# Session Notes as a Summary Field

## Goal

Make session notes a standard editable summary field in the completed-brewing and history-detail views. Remove its toolbar-only editing path and relocate session deletion to the bottom of the history detail.

## Design

`SessionSummaryView` will expose notes as the same boxed, clickable field used for editable setup values. It will always show the stored note or the empty-state text `No notes`.

The consuming screen supplies a notes action when editing is available:

- The completed-brewing view opens the existing styled textarea editor and saves the edited note through `BrewingSessionService`, which persists the active completed session.
- The history-detail view opens the same editor and saves through the history store, refreshing its selected session as it does for other session edits.

The toolbar in history detail will retain only navigation and title. A destructive `Delete session` action will be placed after the summary content at the bottom of the detail screen. It will continue to open the existing irreversible-deletion confirmation dialog before deleting and navigating back.

## Testing

- Verify clicking the completed-brewing Notes field edits and persists the completed session note.
- Verify the history Notes field uses the same box interaction and updates the selected session.
- Verify the history toolbar no longer contains editing or deletion controls and the bottom delete action still opens the existing confirmation flow.
