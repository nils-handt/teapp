# Session Notes Field Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make session notes a clickable, persisted summary field in completed brewing and history details, and relocate session deletion to the bottom of history details.

**Architecture:** `SessionSummaryView` owns the shared boxed Notes field and receives an optional action callback. `BrewingZen` and `SessionDetailScreen` open the existing textarea modal through that callback, then persist their respective session state via the brewing service or history store. `SessionDetailScreen` owns the relocated destructive action and its existing confirmation dialog.

**Tech Stack:** React, TypeScript, Ionic React, Zustand, RxJS, TypeORM, Vitest, Testing Library.

## Global Constraints

- Preserve the existing `No notes` empty state and trim saved note text.
- Reuse `InfusionNoteEditorModal`; do not add a second notes editor component.
- Keep the existing destructive confirmation wording and behavior.
- Use `npm run test:sandbox -- ...` for repository tests.
- Do not change persistence schema or delete behavior in the history-list screen.

---

### Task 1: Persist completed-session note edits through the brewing service

**Files:**
- Modify: `src/services/brewing/BrewingSessionService.ts:321-323`
- Test: `src/services/brewing/BrewingSessionService.test.ts`

**Interfaces:**
- Produces: `BrewingSessionService.updateSessionNotes(note: string): void`, which updates the current session, emits it, and persists it.
- Consumes: `this.session$.value`, `this.emitSession(session)`, and `sessionRepository.saveSession(session)`.

- [ ] **Step 1: Write the failing service test**

Add a service test next to `should manually update tea name during an active session` that calls the new method and checks both in-memory state and repository persistence:

```ts
it('updates and persists session notes', () => {
    brewingSessionService.startSession('Test Tea');

    brewingSessionService.updateSessionNotes('  floral and sweet  ');

    expect(brewingSessionService.session$.value).toEqual(expect.objectContaining({
        notes: 'floral and sweet',
    }));
    expect(sessionRepository.saveSession).toHaveBeenCalledWith(expect.objectContaining({
        notes: 'floral and sweet',
    }));
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm run test:sandbox -- src/services/brewing/BrewingSessionService.test.ts`

Expected: FAIL because `updateSessionNotes` does not exist.

- [ ] **Step 3: Add the minimal service API**

Add next to `updateSavedInfusionNote`:

```ts
public updateSessionNotes(note: string) {
    const session = this.session$.value;
    if (!session) {
        return;
    }

    session.notes = note.trim();
    this.emitSession(session);
    void sessionRepository.saveSession(session);
}
```

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `npm run test:sandbox -- src/services/brewing/BrewingSessionService.test.ts`

Expected: PASS with no failed tests.

- [ ] **Step 5: Commit the service behavior**

```powershell
git add src/services/brewing/BrewingSessionService.ts src/services/brewing/BrewingSessionService.test.ts
git commit -m "Codex (GPT-5): Persist completed session notes"
```

### Task 2: Render Notes as a reusable clickable summary field

**Files:**
- Modify: `src/components/SessionSummaryView.tsx:36-207`
- Test: `src/screens/SessionDetailScreen.test.tsx`

**Interfaces:**
- Consumes: an optional `notesAction?: () => void` from summary consumers.
- Produces: a standard `SummaryField` labeled `Notes`, containing `session.notes?.trim() || 'No notes'`.

- [ ] **Step 1: Write the failing summary interaction test**

Add a history-detail test which renders the screen and presses the Notes field:

```ts
it('edits session notes by pressing the Notes field', async () => {
    render(<SessionDetailScreen />);

    fireEvent.click(screen.getByRole('button', { name: /NotesBright and sweet/i }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'honey and grass' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
        expect(updateSession).toHaveBeenCalledWith(expect.objectContaining({
            notes: 'honey and grass',
        }));
    });
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm run test:sandbox -- src/screens/SessionDetailScreen.test.tsx`

Expected: FAIL because Notes is rendered as non-interactive text.

- [ ] **Step 3: Add the reusable field callback and field markup**

Extend the props and destructuring:

```ts
type SessionSummaryViewProps = {
    // existing props
    notesAction?: () => void;
};

const SessionSummaryView: React.FC<SessionSummaryViewProps> = ({
    // existing props
    notesAction,
}) => {
```

Replace the `showNotes` section with an always-rendered Notes section containing:

```tsx
<section className={zenPanelClass}>
    <div className={zenSummarySectionHeadingClass}>
        <p role="heading" aria-level={3} className={zenSectionEyebrowClass}>Notes</p>
    </div>
    <SummaryField
        label="Notes"
        value={session.notes?.trim() || 'No notes'}
        onClick={notesAction}
    />
</section>
```

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `npm run test:sandbox -- src/screens/SessionDetailScreen.test.tsx`

Expected: PASS with the existing tea and infusion tests still green.

- [ ] **Step 5: Commit the shared summary field**

```powershell
git add src/components/SessionSummaryView.tsx src/screens/SessionDetailScreen.test.tsx
git commit -m "Codex (GPT-5): Make session notes a summary field"
```

### Task 3: Enable Notes editing after brewing ends

**Files:**
- Modify: `src/screens/brewing/BrewingZen.tsx:66-77,287-318,604-617,678-685`
- Test: `src/screens/brewing/BrewingZen.test.tsx`

**Interfaces:**
- Consumes: `SessionSummaryView.notesAction`, `InfusionNoteEditorModal`, and `brewingSessionService.updateSessionNotes(note)`.
- Produces: the completed-brewing Notes box opens the modal, saves text through the new service method, and closes the modal.

- [ ] **Step 1: Write the failing completed-view test**

Add an ended-session case and verify the Notes field drives the service call:

```ts
it('edits session notes from the ended summary field', () => {
    renderBrewingZen({ phase: BrewingPhase.ENDED, session: createCompletedSession({ notes: 'first steep' }) });

    fireEvent.click(screen.getByRole('button', { name: /Notesfirst steep/i }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'rounder after cooling' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(updateSessionNotes).toHaveBeenCalledWith('rounder after cooling');
});
```

Mock `updateSessionNotes: vi.fn()` alongside the existing brewing-session-service method mocks.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm run test:sandbox -- src/screens/brewing/BrewingZen.test.tsx`

Expected: FAIL because the ended summary does not expose an editable Notes field.

- [ ] **Step 3: Generalize the existing modal target and wire the summary callback**

Extend `NoteEditorTarget` with `{ mode: 'session' }`, open it with the current `activeSession.notes`, and save it in `handleNoteSave`:

```ts
if (noteEditorTarget?.mode === 'session') {
    brewingSessionService.updateSessionNotes(trimmedNote);
}
```

Pass `notesAction={openSessionNotesEditor}` to the `SessionSummaryView` in `renderEndedView`. Keep the modal title `Edit Notes` when the target mode is `session`, otherwise retain `Edit Infusion Note`.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `npm run test:sandbox -- src/screens/brewing/BrewingZen.test.tsx`

Expected: PASS, including existing saved-infusion-note coverage.

- [ ] **Step 5: Commit the completed-session UI**

```powershell
git add src/screens/brewing/BrewingZen.tsx src/screens/brewing/BrewingZen.test.tsx
git commit -m "Codex (GPT-5): Edit notes after brewing completes"
```

### Task 4: Simplify history-detail controls and relocate deletion

**Files:**
- Modify: `src/screens/SessionDetailScreen.tsx:1-253`
- Test: `src/screens/SessionDetailScreen.test.tsx`

**Interfaces:**
- Consumes: `SessionSummaryView.notesAction`, `InfusionNoteEditorModal`, and the existing `showDeleteAlert` state.
- Produces: no Notes or delete toolbar controls; an in-content `Delete session` button opens the unchanged confirmation dialog.

- [ ] **Step 1: Write the failing delete-placement test**

Update the Ionic alert mock so it exposes its `isOpen` state, then add:

```ts
it('opens the delete confirmation from the bottom action instead of the toolbar', () => {
    render(<SessionDetailScreen />);

    expect(screen.queryByRole('button', { name: /edit notes/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Delete session' }));

    expect(screen.getByTestId('delete-session-alert')).toHaveAttribute('data-open', 'true');
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm run test:sandbox -- src/screens/SessionDetailScreen.test.tsx`

Expected: FAIL because the bottom delete action is absent.

- [ ] **Step 3: Replace the special Notes alert and toolbar buttons**

Remove `IonButton`, `IonIcon`, `trash`, `pencil`, `showNotesAlert`, `handleNotesSave`, and the Notes `IonAlert`. Add a local `noteDraft` state plus open, close, and save handlers that call:

```ts
await updateSession({ ...selectedSession, notes: noteDraft.trim() });
```

Pass `notesAction={openSessionNotesEditor}` into `SessionSummaryView`. Add the bottom action through its footer prop:

```tsx
footer={(
    <button
        type="button"
        onClick={() => setShowDeleteAlert(true)}
        className="w-full rounded-lg border border-danger px-4 py-3 text-danger"
    >
        Delete session
    </button>
)}
```

Render `InfusionNoteEditorModal` with `title="Edit Notes"`, `value={noteDraft}`, and its note handlers. Leave the deletion `IonAlert` unchanged.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `npm run test:sandbox -- src/screens/SessionDetailScreen.test.tsx`

Expected: PASS with notes editing, infusion editing, and bottom delete coverage.

- [ ] **Step 5: Run the final targeted regression suite**

Run: `npm run test:sandbox -- src/services/brewing/BrewingSessionService.test.ts src/screens/brewing/BrewingZen.test.tsx src/screens/SessionDetailScreen.test.tsx src/App.test.tsx`

Expected: PASS with no failed tests.

- [ ] **Step 6: Commit the history-detail changes**

```powershell
git add src/screens/SessionDetailScreen.tsx src/screens/SessionDetailScreen.test.tsx
git commit -m "Codex (GPT-5): Move session controls into summary fields"
```
