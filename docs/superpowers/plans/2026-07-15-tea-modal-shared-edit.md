# Tea Modal Shared Edit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Relink only the open session when choosing an existing Tea, while providing a prefilled shared-Tea editor that updates every linked session's cached label.

**Architecture:** `TeaEditorModal` emits a discriminated `select | create | edit` submission. Consumers route creation and shared editing separately; shared edits use one TypeORM transaction to save the Tea and synchronize matching `brewing_sessions.teaName` values.

**Tech Stack:** React 19, TypeScript, Zustand, TypeORM, Ionic React, Vitest, Testing Library

## Global Constraints

- Sessions without an assigned Tea retain the current modal behavior and layout.
- The modal always opens on `Existing Tea`.
- Existing-Tea selection changes only the open session and never saves the selected Tea.
- Shared editing preserves the Tea ID and synchronizes linked sessions' cached labels transactionally.
- Run repository tests through `npm run test:sandbox -- ...`.
- Every production change follows a witnessed red-green test cycle.

---

### Task 1: Give `TeaEditorModal` an explicit submission contract

**Files:**
- Modify: `src/components/TeaEditorModal.tsx`
- Test: `src/components/TeaEditorModal.test.tsx`

**Interfaces:**
- Consumes: `selectedTea: Tea | null` and the existing Tea form fields.
- Produces: `TeaEditorSubmission = { action: 'select' | 'create' | 'edit'; tea: Tea }`.

- [ ] **Step 1: Write failing modal tests**

Change the existing-selection assertion to:

```tsx
expect(onSave).toHaveBeenCalledWith({
    action: 'select',
    tea: expect.objectContaining({ teaId: 'tea-1', name: 'Longjing' }),
});
```

Add tests with these bodies:

```tsx
it('keeps New Tea empty without an assigned tea and emits create', () => {
    const onSave = vi.fn();
    render(<TeaEditorModal isOpen selectedTea={null} teas={[]} onCancel={vi.fn()} onSave={onSave} />);
    fireEvent.click(screen.getByRole('tab', { name: 'New Tea' }));
    expect(screen.getByLabelText('Name')).toHaveValue('');
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Silver Needle' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith({
        action: 'create',
        tea: expect.objectContaining({ teaId: expect.any(String), name: 'Silver Needle' }),
    });
});

it('prefills Edit Tea for the assigned shared tea and preserves its id', () => {
    const onSave = vi.fn();
    const assignedTea = createTea('tea-1', 'Longjing', {
        brand: 'Tea House', type: 'Green', subtype: 'Dragon Well',
        region: 'Zhejiang', subregion: 'Hangzhou', season: 'Spring', year: 2024,
    });
    render(<TeaEditorModal isOpen selectedTea={assignedTea} teas={[assignedTea]} onCancel={vi.fn()} onSave={onSave} />);
    expect(screen.queryByRole('tab', { name: 'New Tea' })).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Edit Tea' }));
    expect(screen.getByLabelText('Name')).toHaveValue('Longjing');
    expect(screen.getByLabelText('Brand')).toHaveValue('Tea House');
    expect(screen.getByLabelText('Type')).toHaveValue('Green');
    expect(screen.getByLabelText('Subtype')).toHaveValue('Dragon Well');
    expect(screen.getByLabelText('Region')).toHaveValue('Zhejiang');
    expect(screen.getByLabelText('Subregion')).toHaveValue('Hangzhou');
    expect(screen.getByLabelText('Season')).toHaveValue('Spring');
    expect(screen.getByLabelText('Year')).toHaveValue(2024);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Edited Longjing' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith({
        action: 'edit',
        tea: expect.objectContaining({ teaId: 'tea-1', name: 'Edited Longjing' }),
    });
});
```

- [ ] **Step 2: Verify RED**

Run `npm run test:sandbox -- src/components/TeaEditorModal.test.tsx`.

Expected: FAIL because submissions are bare Tea values, `Edit Tea` is absent, and assigned fields are cleared.

- [ ] **Step 3: Implement the modal contract**

Export and consume this type in `TeaEditorModal.tsx`:

```tsx
export type TeaEditorSubmission = {
    action: 'select' | 'create' | 'edit';
    tea: Tea;
};

// In TeaEditorModalProps:
onSave: (submission: TeaEditorSubmission) => void | Promise<void>;
```

Add the draft converter:

```tsx
const teaToDraft = (tea: Tea): TeaDraft => ({
    name: tea.name,
    brand: tea.brand ?? '',
    type: tea.type ?? '',
    subtype: tea.subtype ?? '',
    region: tea.region ?? '',
    subregion: tea.subregion ?? '',
    season: tea.season ?? '',
    year: tea.year == null ? '' : String(tea.year),
});
```

Replace the second-tab opener and label:

```tsx
const openTeaFormTab = () => {
    setActiveTab('new');
    setEditingTea(selectedTea);
    setDraft(selectedTea ? teaToDraft(selectedTea) : EMPTY_DRAFT);
};
```

```tsx
onClick={openTeaFormTab}
```

```tsx
{selectedTea ? 'Edit Tea' : 'New Tea'}
```

Return explicit actions in `handleSave`:

```tsx
if (activeTab === 'existing') {
    if (editingTea) void onSave({ action: 'select', tea: editingTea });
    return;
}

// Retain the current name and numeric-year validation, then construct:
const tea = Object.assign(new Tea(), {
    teaId: selectedTea?.teaId ?? crypto.randomUUID(),
    name,
    brand: trimToNullable(draft.brand),
    type: trimToNullable(draft.type),
    subtype: trimToNullable(draft.subtype),
    region: trimToNullable(draft.region),
    subregion: trimToNullable(draft.subregion),
    season: trimToNullable(draft.season),
    year,
});
void onSave({ action: selectedTea ? 'edit' : 'create', tea });
```

- [ ] **Step 4: Verify GREEN and commit**

Run `npm run test:sandbox -- src/components/TeaEditorModal.test.tsx`.

Expected: all modal tests PASS without warnings.

```powershell
git add src/components/TeaEditorModal.tsx src/components/TeaEditorModal.test.tsx
git commit -m "Codex (GPT-5): add explicit tea modal actions"
```

---

### Task 2: Add transactional shared-Tea persistence

**Files:**
- Modify: `src/repositories/TeaRepository.ts`
- Test: `src/repositories/TeaRepository.test.ts`
- Modify: `src/stores/useHistoryStore.ts`
- Test: `src/stores/useHistoryStore.test.ts`

**Interfaces:**
- Consumes: `AppDataSource.transaction`, `Tea`, `BrewingSession`, and `formatTeaLabel`.
- Produces: `teaRepository.updateSharedTea(tea: Tea): Promise<Tea>` and the same history-store action signature.

- [ ] **Step 1: Write a failing transaction test**

Expose `transaction`, transaction-scoped `save`, and `update` spies in the datasource mock, then add:

```tsx
it('updates a shared tea and only linked session labels in one transaction', async () => {
    const tea = Object.assign(new Tea(), {
        teaId: 'tea-1', name: 'Longjing', brand: 'Tea House', type: 'Green',
        subtype: null, region: null, subregion: null, year: 2024, season: null,
    });
    repositoryMocks.save.mockResolvedValue(tea);
    repositoryMocks.update.mockResolvedValue({ affected: 2 });
    repositoryMocks.transaction.mockImplementation(async (work) => work({
        getRepository: vi.fn()
            .mockReturnValueOnce({ save: repositoryMocks.save })
            .mockReturnValueOnce({ update: repositoryMocks.update }),
    }));

    const result = await teaRepository.updateSharedTea(tea);

    expect(repositoryMocks.transaction).toHaveBeenCalledTimes(1);
    expect(repositoryMocks.save).toHaveBeenCalledWith(tea);
    expect(repositoryMocks.update).toHaveBeenCalledWith(
        { teaId: 'tea-1' },
        { teaName: '2024 Longjing Tea House Green' },
    );
    expect(result).toBe(tea);
});
```

Use this hoisted mock shape:

```tsx
const repositoryMocks = vi.hoisted(() => ({ save: vi.fn(), update: vi.fn(), transaction: vi.fn() }));
```

Add `transaction: repositoryMocks.transaction` to the mocked `AppDataSource`.

- [ ] **Step 2: Verify repository RED**

Run `npm run test:sandbox -- src/repositories/TeaRepository.test.ts`.

Expected: FAIL because `updateSharedTea` is undefined.

- [ ] **Step 3: Implement the transaction**

Import `BrewingSession` and `formatTeaLabel`, then add to `teaRepository`:

```tsx
async updateSharedTea(tea: Tea): Promise<Tea> {
    return AppDataSource.transaction(async (manager) => {
        const savedTea = await manager.getRepository(Tea).save(tea);
        await manager.getRepository(BrewingSession).update(
            { teaId: savedTea.teaId },
            { teaName: formatTeaLabel(savedTea) },
        );
        return savedTea;
    });
},
```

- [ ] **Step 4: Verify repository GREEN**

Run `npm run test:sandbox -- src/repositories/TeaRepository.test.ts`.

Expected: all repository tests PASS.

- [ ] **Step 5: Write a failing history-store test**

Mock `TeaRepository` with `getAllTeas`, `saveTea`, and `updateSharedTea` spies. Import `Tea` and `teaRepository`, then add:

```tsx
it('updates a shared tea and replaces it in known teas', async () => {
    const original = Object.assign(new Tea(), { teaId: 'tea-1', name: 'Old' });
    const edited = Object.assign(new Tea(), { teaId: 'tea-1', name: 'Edited' });
    historyStore.setState({ knownTeas: [original] });
    vi.mocked(teaRepository.updateSharedTea).mockResolvedValue(edited);

    const result = await historyStore.getState().updateSharedTea(edited);

    expect(teaRepository.updateSharedTea).toHaveBeenCalledWith(edited);
    expect(result).toBe(edited);
    expect(historyStore.getState().knownTeas).toEqual([edited]);
});
```

- [ ] **Step 6: Verify store RED**

Run `npm run test:sandbox -- src/stores/useHistoryStore.test.ts`.

Expected: FAIL because `updateSharedTea` is not in the store contract.

- [ ] **Step 7: Implement the store action**

Add to `HistoryStore` and the store initializer:

```tsx
updateSharedTea: (tea: Tea) => Promise<Tea>;
```

```tsx
updateSharedTea: async (tea) => {
  const savedTea = await teaRepository.updateSharedTea(tea);
  get().upsertKnownTea(savedTea);
  return savedTea;
},
```

- [ ] **Step 8: Verify GREEN and commit**

Run `npm run test:sandbox -- src/repositories/TeaRepository.test.ts src/stores/useHistoryStore.test.ts`.

Expected: both files PASS.

```powershell
git add src/repositories/TeaRepository.ts src/repositories/TeaRepository.test.ts src/stores/useHistoryStore.ts src/stores/useHistoryStore.test.ts
git commit -m "Codex (GPT-5): persist shared tea edits transactionally"
```

---

### Task 3: Route modal actions in both consumers

**Files:**
- Modify: `src/screens/SessionDetailScreen.tsx`
- Test: `src/screens/SessionDetailScreen.test.tsx`
- Modify: `src/screens/brewing/BrewingZen.tsx`
- Test: `src/screens/brewing/BrewingZen.test.tsx`

**Interfaces:**
- Consumes: `TeaEditorSubmission`, `saveTea`, and `updateSharedTea`.
- Produces: session-only `select`, save-and-assign `create`, and shared-update-and-refresh `edit` behavior.

- [ ] **Step 1: Write failing Session Detail tests**

Add `updateSharedTea` to the test's history-store seed. Change the existing-selection expectation to:

```tsx
await waitFor(() => {
    expect(saveTea).not.toHaveBeenCalled();
    expect(updateSharedTea).not.toHaveBeenCalled();
    expect(updateSession).toHaveBeenCalledWith(expect.objectContaining({
        sessionId: 'session-1', teaId: 'tea-2', teaName: 'ORT 2015 Gao Jia Shan',
    }));
});
```

Add:

```tsx
it('edits the assigned shared tea and refreshes the open session', async () => {
    updateSharedTea.mockImplementation(async (tea: Tea) => tea);
    render(<SessionDetailScreen />);
    fireEvent.click(screen.getByRole('button', { name: /Tea nameMorning Sencha/i }));
    fireEvent.click(screen.getByRole('tab', { name: 'Edit Tea' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Evening Sencha' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => {
        expect(updateSharedTea).toHaveBeenCalledWith(expect.objectContaining({ teaId: 'tea-1', name: 'Evening Sencha' }));
        expect(saveTea).not.toHaveBeenCalled();
        expect(updateSession).toHaveBeenCalledWith(expect.objectContaining({
            sessionId: 'session-1', teaId: 'tea-1', teaName: 'Evening Sencha',
        }));
    });
});
```

- [ ] **Step 2: Verify Session Detail RED**

Run `npm run test:sandbox -- src/screens/SessionDetailScreen.test.tsx`.

Expected: FAIL because the screen saves every submitted Tea.

- [ ] **Step 3: Implement Session Detail routing**

Import `TeaEditorSubmission`, select `updateSharedTea` from the history store, and replace the handler:

```tsx
const handleTeaSave = async ({ action, tea }: TeaEditorSubmission) => {
    if (!selectedSession) return;
    const resolvedTea = action === 'select'
        ? tea
        : action === 'create' ? await saveTea(tea) : await updateSharedTea(tea);
    await updateSession({
        ...selectedSession,
        tea: resolvedTea,
        teaId: resolvedTea.teaId,
        teaName: formatTeaLabel(resolvedTea),
    });
    setShowTeaNameEditor(false);
    present({ ...APP_TOAST_POSITION, message: 'Session updated', duration: TOAST_DURATION, color: 'success' });
};
```

- [ ] **Step 4: Verify Session Detail GREEN**

Run `npm run test:sandbox -- src/screens/SessionDetailScreen.test.tsx`.

Expected: all Session Detail tests PASS.

- [ ] **Step 5: Write failing Brewing Zen tests**

Add `updateSharedTea` and `updateTea` to the existing `vi.hoisted` spy object, seed `updateSharedTea` into `BrewingZenHistorySeed`, and replace the service mock's anonymous `updateTea: vi.fn()` with `updateTea`. Change the existing-selection assertion to require no Tea persistence and `updateTea` with `tea-2`.

Add a shared-edit test that seeds an active session with `tea-1`, opens `Edit Tea`, changes Name to `Evening Sencha`, saves, and asserts:

```tsx
const assignedTea = createTea('tea-1', 'Morning Sencha');
brewingStore.setState({
    activeSession: {
        ...brewingStore.getState().activeSession!,
        tea: assignedTea,
        teaId: assignedTea.teaId,
        teaName: assignedTea.name,
    },
    brewingPhase: BrewingPhase.SETUP,
});
updateSharedTea.mockImplementation(async (tea: Tea) => tea);

render(<BrewingZen />);
fireEvent.click(screen.getByRole('button', { name: /Tea nameMorning Sencha/i }));
fireEvent.click(screen.getByRole('tab', { name: 'Edit Tea' }));
fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Evening Sencha' } });
fireEvent.click(screen.getByRole('button', { name: 'Save' }));

await waitFor(() => {
    expect(updateSharedTea).toHaveBeenCalledWith(expect.objectContaining({ teaId: 'tea-1', name: 'Evening Sencha' }));
    expect(saveTea).not.toHaveBeenCalled();
    expect(updateTea).toHaveBeenCalledWith(expect.objectContaining({ teaId: 'tea-1', name: 'Evening Sencha' }));
});
```

- [ ] **Step 6: Verify Brewing Zen RED**

Run `npm run test:sandbox -- src/screens/brewing/BrewingZen.test.tsx`.

Expected: FAIL because Brewing Zen saves every submitted Tea.

- [ ] **Step 7: Implement Brewing Zen routing**

Import `TeaEditorSubmission`, select `updateSharedTea`, and replace the handler:

```tsx
const handleTeaSave = async ({ action, tea }: TeaEditorSubmission) => {
    const resolvedTea = action === 'select'
        ? tea
        : action === 'create' ? await saveTea(tea) : await updateSharedTea(tea);
    brewingSessionService.updateTea(resolvedTea);
    closeEditor();
};
```

- [ ] **Step 8: Verify consumers GREEN and commit**

Run `npm run test:sandbox -- src/screens/SessionDetailScreen.test.tsx src/screens/brewing/BrewingZen.test.tsx`.

Expected: both files PASS without warnings.

```powershell
git add src/screens/SessionDetailScreen.tsx src/screens/SessionDetailScreen.test.tsx src/screens/brewing/BrewingZen.tsx src/screens/brewing/BrewingZen.test.tsx
git commit -m "Codex (GPT-5): separate tea selection from shared editing"
```

---

### Task 4: Verify the integration and start the worktree server

**Files:**
- Verify: all files changed in Tasks 1-3

**Interfaces:**
- Consumes: the completed modal, persistence, store, and consumer behavior.
- Produces: test/build evidence and a reachable server tied to this worktree.

- [ ] **Step 1: Run focused tests**

```powershell
npm run test:sandbox -- src/components/TeaEditorModal.test.tsx src/repositories/TeaRepository.test.ts src/stores/useHistoryStore.test.ts src/screens/SessionDetailScreen.test.tsx src/screens/brewing/BrewingZen.test.tsx
```

Expected: all focused tests PASS.

- [ ] **Step 2: Run the source suite and production build**

```powershell
npm run test:sandbox -- --exclude "tests/e2e/**"
npm run build
```

Expected: all source tests and the Vite production build PASS.

- [ ] **Step 3: Inspect the final diff**

```powershell
git status --short
git diff HEAD~3 --check
git diff HEAD~3 --stat
```

Expected: no whitespace errors and only the approved modal, persistence, store, screen, test, and docs changes.

- [ ] **Step 4: Start Vite on a random non-5173 port in a long-lived foreground cell**

```powershell
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
$listener.Start()
$port = ([System.Net.IPEndPoint]$listener.LocalEndpoint).Port
$listener.Stop()
if ($port -eq 5173) { $port = 5174 }
Write-Output "WORKTREE_PORT=$port"
npm run dev -- --host 127.0.0.1 --port $port --strictPort --configLoader native
```

Expected: Vite reports a local URL using the printed non-5173 port. Keep this foreground cell running.

- [ ] **Step 5: Verify the listener from a separate cell**

Use the exact printed port as `$port`, then run:

```powershell
Get-NetTCPConnection -LocalPort $port -State Listen
Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like "*$port*" -and $_.CommandLine -like "*teapp*" } | Select-Object ProcessId,CommandLine
Invoke-WebRequest -UseBasicParsing "http://127.0.0.1:$port/" | Select-Object StatusCode
```

Expected: a listener, a command line referencing this worktree and port, and HTTP status `200`. Leave the server running until merge and stop it immediately afterward.
