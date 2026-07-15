# Tea Modal Shared Edit Design

## Goal

Make the tea modal distinguish three operations:

1. Assign an existing Tea to only the currently open session.
2. Create a new Tea and assign it to only the currently open session.
3. Edit the Tea already assigned to the session, affecting that shared Tea and every session linked to it.

Sessions without an assigned Tea retain the current modal behavior and layout.

## Modal behavior

`TeaEditorModal` will return an explicit action with the submitted Tea:

- `select`: the user chose a Tea from the `Existing Tea` tab.
- `create`: the user completed the `New Tea` form.
- `edit`: the user changed the assigned Tea through the `Edit Tea` form.

When `selectedTea` is `null`, the modal behaves as it does today. It opens on `Existing Tea`, the second tab is labeled `New Tea`, and its fields are empty.

When `selectedTea` is present, the modal still opens on `Existing Tea`, but the second tab is labeled `Edit Tea`. Opening that tab prefills every Tea field from `selectedTea`. Saving preserves its `teaId` and returns the `edit` action.

Choosing a Tea in the existing-tea tab returns `select`, even if the chosen Tea happens to be the Tea currently assigned to the session. The modal never infers persistence intent from IDs.

## Consumer behavior

Both `SessionDetailScreen` and `BrewingZen` will handle the explicit action result.

For `select`, the consumer updates only the current session's `tea`, `teaId`, and cached `teaName`. It does not save or update the selected Tea.

For `create`, the consumer saves the new Tea, then assigns the saved Tea to the current session.

For `edit`, the consumer invokes the shared Tea update operation, then refreshes the current session with the returned Tea so the open UI immediately displays the edited values.

## Shared Tea persistence

Shared editing will be one database transaction:

1. Save the edited Tea row while preserving its `teaId`.
2. Format its current display label.
3. Bulk-update `brewing_sessions.teaName` only where `teaId` equals the edited Tea's ID.

The transaction ensures the Tea and its sessions' cached labels remain consistent. A failure rolls back both writes. Unrelated sessions are never updated.

The history store will expose the shared-update operation and replace the edited entry in `knownTeas` with the saved Tea. Ordinary Tea creation continues to use the existing save operation.

## Failure behavior

The modal closes only after the consumer's awaited persistence work succeeds. If selecting, creating, or editing fails, the modal remains open. Existing application-level error reporting behavior is unchanged.

## Tests

Component tests will prove that:

- A session without an assigned Tea still gets `New Tea` and empty fields.
- A session with an assigned Tea gets `Edit Tea` and all fields are prefilled.
- Editing preserves the assigned Tea's ID and returns `edit`.
- Existing selection returns `select`.
- New creation returns `create` with a new ID.

Screen tests for both consumers will prove that:

- `select` changes only the open session and does not call Tea persistence.
- `create` saves the Tea before assigning it to the open session.
- `edit` calls the shared Tea update operation and refreshes the current session.

Repository tests will prove that the shared update is transactional and synchronizes cached labels only for sessions whose `teaId` matches the edited Tea.
