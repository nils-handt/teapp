# Remove Unused Brew Screens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make BrewingZen the sole brewing screen and remove the obsolete screen-selection feature.

**Architecture:** Route every Brewing entry point directly to `/tabs/brewing/1`, which renders `BrewingZen`. Delete the unused screen components and all selector-related constants, state, settings UI, and tests.

**Tech Stack:** React, Ionic, React Router, Zustand, Vitest.

## Global Constraints

- Keep only `src/screens/brewing/BrewingZen.tsx` as a brewing screen.
- Remove persisted `lastUsedBrewingScreen` handling rather than retaining compatibility data.
- Run tests with `npm run test:sandbox -- ...`.

---

### Task 1: Lock Brewing navigation to Zen

**Files:**
- Modify: `src/App.test.tsx`
- Modify: `src/screens/Tabs.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Produces: `/`, `/tabs`, and the Brewing tab resolve to `/tabs/brewing/1`.

- [ ] **Step 1: Write the failing navigation assertions**

Assert that the root redirect and Brewing tab use the literal Zen route and that Tabs has no obsolete brewing routes.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:sandbox -- src/App.test.tsx`
Expected: FAIL because routing still reads the selected screen.

- [ ] **Step 3: Write the minimal routing implementation**

Remove screen-selection imports, state subscriptions, and numbered routes; retain only `/tabs/brewing/1` mapped to `BrewingZen`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:sandbox -- src/App.test.tsx`
Expected: PASS.

### Task 2: Remove selector persistence and obsolete UI

**Files:**
- Modify: `src/screens/SettingsScreen.test.tsx`
- Modify: `src/stores/useSettingsStore.test.ts`
- Modify: `src/screens/SettingsScreen.tsx`
- Modify: `src/stores/useSettingsStore.ts`
- Delete: `src/constants/brewingScreens.ts`
- Delete: `src/components/DesignSwitcher.tsx`
- Delete: `src/screens/BrewingScreen.tsx`
- Delete: `src/screens/brewing/BrewingLab.tsx`
- Delete: `src/screens/brewing/BrewingFlow.tsx`
- Delete: `src/screens/brewing/BrewingCard.tsx`
- Delete: `src/screens/brewing/BrewingFocus.tsx`

**Interfaces:**
- Produces: Settings no longer exposes a brewing-screen selector and SettingsStore no longer persists a screen choice.

- [ ] **Step 1: Write the failing Settings and store assertions**

Assert that the Settings screen has no `Brewing Tab Screen` control and SettingsStore has no `lastUsedBrewingScreen` state after the selector feature is removed.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:sandbox -- src/screens/SettingsScreen.test.tsx src/stores/useSettingsStore.test.ts`
Expected: FAIL because the selector and persisted field still exist.

- [ ] **Step 3: Write the minimal removal**

Delete selector code, state persistence/loading, constants, old screens, and obsolete design switcher.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:sandbox -- src/screens/SettingsScreen.test.tsx src/stores/useSettingsStore.test.ts`
Expected: PASS.

### Task 3: Verify the cleanup

**Files:**
- Modify: `src/App.test.tsx`, `src/screens/SettingsScreen.test.tsx`, `src/stores/useSettingsStore.test.ts`

- [ ] **Step 1: Check no removed identifiers remain**

Run: `rg -n "BrewingLab|BrewingFlow|BrewingCard|BrewingFocus|BrewingScreen|brewingScreens|lastUsedBrewingScreen|DesignSwitcher" src`
Expected: no matches.

- [ ] **Step 2: Run focused tests**

Run: `npm run test:sandbox -- src/App.test.tsx src/screens/SettingsScreen.test.tsx src/stores/useSettingsStore.test.ts src/screens/brewing/BrewingZen.test.tsx`
Expected: PASS.

- [ ] **Step 3: Run the build**

Run: `npm run build`
Expected: exit code 0.
