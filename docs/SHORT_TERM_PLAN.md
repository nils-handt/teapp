### Introduction Section
- Brief overview stating this document defines the MVP scope and development phases for the Teapp GongFu brewing tracker
- Emphasize the goal: deliver a functional app that automatically tracks brewing sessions via Bluetooth scale integration
- Note the innovative dev mode strategy that enables rapid development without constant physical hardware access

### MVP Scope Section
- Define what's included in MVP:
  - Bluetooth scale connection and real-time weight display
  - Automatic brewing session tracking with infusion/rest timers
  - Session history with detailed infusion logs
  - Basic settings for scale configuration and timer preferences
- Define what's explicitly excluded from MVP (deferred to [`LONG_TERM_PLAN.md`](./LONG_TERM_PLAN.md)):
  - Tea library management with detailed brewing parameters
  - Advanced analytics and visualizations
  - Cloud sync and multi-device support
  - Social features and sharing

### Development Philosophy Section
- Explain the weight logger dev mode approach as a core strategy:
  - Real-world data capture creates reusable test scenarios
  - Mock scale replay enables browser-based development without hardware
  - Fast-forward mode (100x speed) accelerates integration testing
  - This approach reduces hardware dependency and speeds up iteration cycles

### Phase 1: Initial Project Setup
- **Priority:** Critical (blocking all other work)
- **Dependencies:** None
- **Deliverables:**
  - Initialize Capacitor project with Ionic React and TypeScript
  - Configure project structure: src/components, src/services, src/repositories, src/models, src/stores, src/screens
  - Set up SQLite via Capacitor Community SQLite plugin with IndexedDB shim for browser
  - Configure Zustand for state management (reference BrewingState, BluetoothState, HistoryState, SettingsState from [`ARCHITECTURE.md`](./ARCHITECTURE.md#state-management))
  - Set up build tooling and development scripts
  - Create basic app shell with navigation between BrewingScreen, HistoryScreen, and SettingsScreen
- **Architectural References:**
  - [Technology Stack section](./ARCHITECTURE.md#technology-stack)
  - [State Management section](./ARCHITECTURE.md#state-management) defining Zustand stores
  - [Core Components section](./ARCHITECTURE.md#core-components) defining screen structure
- **Acceptance Criteria:**
  - ✅ Project is initialized and runs in a browser and on a device.
  - ✅ Basic navigation between screens is functional.
  - ✅ Zustand store is set up and accessible from components.

### Phase 2: Bluetooth Scale Integration
- **Priority:** Critical (core functionality)
- **Dependencies:** Phase 1 complete
- **Deliverables:**
  - Integrate Beanconqueror BluetoothScale implementations (from https://github.com/graphefruit/Beanconqueror/blob/master/src/classes/devices/bluetoothDevice.ts and extending classes)
  - Implement BluetoothScaleService with device discovery, connection management, and real-time weight streaming (reference [Service Layer](./ARCHITECTURE.md#core-components))
  - Create BluetoothState store slice to manage connected device, connection status, current weight, and available devices
  - Implement ScaleDevice model for device persistence (reference [Domain Models](./ARCHITECTURE.md#domain-models))
  - Create SettingsRepository to save preferred device (reference [Data Layer](./ARCHITECTURE.md#core-components))
  - Handle connection states: scanning, connecting, connected, disconnected, with automatic reconnection logic
- **Architectural References:**
  - [BluetoothScaleService](./ARCHITECTURE.md#core-components) in Service Layer
  - [ScaleDevice model](./ARCHITECTURE.md#domain-models) in Domain Models
  - [SettingsRepository](./ARCHITECTURE.md#core-components) in Data Layer
  - [Bluetooth Scale Integration workflow](./ARCHITECTURE.md#component-interaction-details) in Component Interaction Details
- **Feature References:**
  - [Bluetooth Device Discovery & Pairing](./FEATURES.md#core-functionality)
- **Acceptance Criteria:**
  - ✅ App can scan for and discover Bluetooth scales.
  - ✅ App can connect to and disconnect from a selected scale.

### Phase 3: Basic UI for Scale Connection and Weight Display
- **Priority:** Critical (validates Bluetooth integration)
- **Dependencies:** Phase 2 complete
- **Deliverables:**
  - Implement SettingsScreen with device scanning, device list display, and device selection UI
  - Add connection status indicator and manual connect/disconnect controls
  - Implement basic BrewingScreen with large real-time weight display
  - Add connection status badge and quick connect action in BrewingScreen
  - Wire up BluetoothState to UI components using Zustand hooks
  - Display connection errors and provide retry mechanisms
- **Architectural References:**
  - [SettingsScreen and BrewingScreen](./ARCHITECTURE.md#core-components) in UI Layer
  - [BluetoothState consumption pattern](./ARCHITECTURE.md#state-management) in State Management section
  - [Data Flow diagram](./ARCHITECTURE.md#data-flow) showing BluetoothScaleService to UI updates
- **Feature References:**
  - [Bluetooth Device Discovery & Pairing](./FEATURES.md#core-functionality)
  - [Real-time Brewing Screen weight display](./FEATURES.md#core-functionality)
- **Acceptance Criteria:**
  - ✅ User can select a preferred scale from a list of discovered devices.
  - ✅ The UI correctly displays the connection status.
  - ✅ The BrewingScreen shows the real-time weight from the connected scale.

### Phase 4: Create, Install, and Test Android App
- **Priority:** High (validates cross-platform functionality)
- **Dependencies:** Phase 3 complete
- **Deliverables:**
  - Configure Capacitor for Android build
  - Set up Android Studio project and build configuration
  - Configure Bluetooth permissions in `AndroidManifest.xml`, including runtime permissions for Android 12+ (`BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT`) with `usesPermissionFlags="neverForLocation"`.
  - Build and install APK on physical Android device
  - Test Bluetooth scale connection and weight streaming on real hardware
  - Document any platform-specific issues or workarounds
  - Verify SQLite persistence works correctly on Android
- **Architectural References:**
  - [Technology Stack section](./ARCHITECTURE.md#technology-stack) mentioning Capacitor cross-platform framework
  - [BluetoothScaleService platform compatibility](./ARCHITECTURE.md#core-components)
- **Acceptance Criteria:**
  - ✅ App installs and runs on a physical Android device.
  - ✅ Bluetooth permissions are requested and granted correctly on Android 12+.
  - ✅ App can connect to a scale and stream weight on Android.

### Phase 5: Weight Logger Dev Mode Functionality
- **Priority:** High (critical enabler for efficient development)
- **Dependencies:** Phase 3 complete (need real hardware data first)
- **Deliverables:**
  - Create WeightLoggerService that records timestamped weight data during real brewing sessions
  - Implement UI toggle in SettingsScreen to enable/disable weight logging mode
  - Add recording controls in BrewingScreen: start recording, stop recording, save recording with session name
  - Store recorded weight time series as JSON files (timestamp, weight pairs) with metadata (session name, date, scale device)
  - Implement export functionality to save recordings to device storage or share via email/cloud
  - Create recording management UI: list saved recordings, preview, delete, export
- **Architectural References:**
  - [WeightLoggerService](./ARCHITECTURE.md#core-components) as new service in Service Layer pattern
  - [Integration with BluetoothScaleService](./ARCHITECTURE.md#core-components) weight stream
  - [SettingsScreen extension](./ARCHITECTURE.md#core-components) in UI Layer
- **Implementation Notes:**
  - This enables capturing real-world brewing patterns for replay
  - Recordings should include all weight fluctuations: vessel placement, lid removal, water addition, pouring, vessel removal/return
  - Metadata should capture scale sensitivity and any relevant settings used during recording
- **Acceptance Criteria:**
  - ✅ Weight logging can be enabled/disabled in settings.
  - ✅ A brewing session can be recorded and saved as a JSON file.
  - ✅ Saved recordings can be viewed and managed in the UI.

### Phase 6: Log Real-World Tea Brewing Sessions
- **Priority:** High (generates test data corpus)
- **Dependencies:** Phase 5 complete
- **Deliverables:**
  - Conduct multiple real-world GongFu brewing sessions with weight logger enabled
  - Capture diverse scenarios:
    - Different tea types (varying infusion counts and timings)
    - Different vessels (varying weights and lid weights)
    - Edge cases: quick vessel removal/return, lid manipulation during infusion, ambiguous pours
    - Error scenarios: interrupted sessions, Bluetooth disconnections
  - Document each recording with notes about what happened during the session
  - Create a library of at least 5-10 representative brewing sessions
  - Organize recordings by scenario type for easy selection during development
- **Feature References:**
  - [Complete GongFu Brewing Tracking Process](./FEATURES.md#gongfu-brewing-tracking-process)
  - All automatic detection scenarios from [Automatic Session Tracking workflow](./ARCHITECTURE.md#component-interaction-details)
- **Acceptance Criteria:**
  - ✅ At least 5 diverse brewing sessions are recorded.
  - ✅ Recordings are documented and organized for use in development.

### Phase 7: Import recordings and Create MockScale
- **Priority:** High (enables hardware-free development)
- **Dependencies:** Phase 6 complete
- **Deliverables:**
  - Create MockScaleService that implements the same interface as BluetoothScaleService
  - Implement recordings replay functionality: load recorded JSON weight data into MockScaleService
  - Add replay logic: emit weight updates at recorded timestamps to simulate real scale behavior
  - Implement replay controls: start, pause, resume, restart, seek to timestamp
  - Create dev mode toggle in SettingsScreen to switch between real BluetoothScaleService and MockScaleService
  - Add recording selector UI: choose which recorded session to replay
  - Ensure MockScaleService integrates seamlessly with BrewingSessionService (no service layer changes needed)
  - Add visual indicator in UI when using mock scale vs real scale
- **Architectural References:**
  - [MockScaleService](./ARCHITECTURE.md#core-components) follows same interface pattern as BluetoothScaleService
  - [Integrates with BrewingSessionService](./ARCHITECTURE.md#core-components) via same weight update events
  - [BluetoothState](./ARCHITECTURE.md#state-management) can represent mock connection status
  - [Data Flow diagram](./ARCHITECTURE.md#data-flow) remains identical whether using real or mock scale
- **Implementation Notes:**
  - This decouples development from physical hardware availability
  - Enables consistent, repeatable testing scenarios
  - Allows multiple developers to work simultaneously without scale conflicts
- **Acceptance Criteria:**
  - ✅ App can switch between real and mock scale services.
  - ✅ A recorded session can be imported and replayed via the mock scale.
  - ✅ Replay controls (start, pause, seek) are functional.

### Phase 8: Fast-Forward Mode for MockScale
- **Priority:** Medium-High (accelerates testing)
- **Dependencies:** Phase 7 complete
- **Deliverables:**
  - Add playback speed control to MockScaleService: 1x, 10x, 50x, 100x speed multipliers
  - Implement time scaling for weight update intervals while maintaining data accuracy
  - Add speed control UI in SettingsScreen dev mode section
  - Ensure TimerService respects fast-forward mode: scale timer durations proportionally
  - Verify BrewingSessionService detection logic works correctly at accelerated speeds
  - Add visual indicator showing current playback speed
  - Test that UI updates smoothly at high speeds without performance degradation
- **Architectural References:**
  - [TimerService modifications](./ARCHITECTURE.md#core-components) to support time scaling
  - [BrewingSessionService threshold detection](./ARCHITECTURE.md#core-components) must work at any speed
  - [State Management updates](./ARCHITECTURE.md#state-management) must handle rapid state changes
- **Implementation Notes:**
  - 100x speed turns a 20-minute brewing session into 12 seconds
  - Critical for rapid integration testing and debugging
  - Enables quick iteration on detection algorithms without waiting for real-time sessions
- **Acceptance Criteria:**
  - ✅ Playback speed can be adjusted in the dev mode settings.
  - ✅ A 20-minute session can be replayed in under 15 seconds at 100x speed.
  - ✅ Detection logic and timers work correctly at high speeds.

### Phase 9: Create Database Entities
- **Priority:** High (required for persistence)
- **Dependencies:** Phase 1 complete (can be done in parallel with Phases 2-8)
- **Deliverables:**
  - Implement SQLite schema based on [Domain Models](./ARCHITECTURE.md#domain-models):
    - `BrewingSessionEntity` table: `sessionId` (PK),  `teaName`, `startTime`, `endTime`, `vesselWeight`, `lidWeight`, `dryTeaLeavesWeight`, `notes`, `status`, `waterTemperature`
    - `InfusionEntity` table: `infusionId` (PK), `sessionId` (FK), `infusionNumber`, `waterWeight`, `startTime`, `duration`, `restDuration`, `wetTeaLeavesWeight`
    - `ScaleDeviceEntity` table: `deviceId` (PK), `name`, `address`, `isPreferred`, `lastConnected`
    - `SettingsEntity` table: key-value pairs for scale configuration and timer preferences
  - Use TypeORM to generate the schema
  - Create TypeScript entity classes with proper typing
  - Implement database migration scripts for schema creation
  - Set up foreign key relationships: Infusion → BrewingSession
- **Architectural References:**
  - [Domain Models section](./ARCHITECTURE.md#domain-models)
  - [Technology Stack](./ARCHITECTURE.md#technology-stack) specifying SQLite via Capacitor Community SQLite
  - [Data Layer repositories](./ARCHITECTURE.md#core-components) that will use these entities
- **Acceptance Criteria:**
  - ✅ Database schema is created successfully on app startup.
  - ✅ Entity classes are defined and match the schema.
  - ✅ Basic CRUD operations can be performed on the core entities.

### Phase 10: Create Basic UI for Settings
- **Priority:** Medium (enables user configuration)
- **Dependencies:** Phase 9 complete, Phase 3 complete
- **Deliverables:**
  - Dev Mode section (if enabled):
    - Mock scale toggle
    - Recording selector
    - Playback speed control
    - Weight logger toggle
  - Implement SettingsState store slice
  - Persist and load settings to/from SQLite via `Settings.Entity.ts`
- **Architectural References:**
  - [SettingsScreen](./ARCHITECTURE.md#core-components) in UI Layer
  - [SettingsRepository](./ARCHITECTURE.md#core-components) in Data Layer
  - [SettingsState](./ARCHITECTURE.md#state-management) in State Management
  - [Settings model](./ARCHITECTURE.md#domain-models) in Domain Models
- **Feature References:**
  - [Settings & Preferences section](./FEATURES.md#settings--preferences)
- **Acceptance Criteria:**
  - ✅ User can modify and save all exposed settings.
  - ✅ Saved settings are correctly loaded and applied on app restart.
  - ✅ Dev mode settings are only visible when dev mode is enabled.

### Phase 11: Setup Testing Library
- **Priority:** High (enables automated testing)
- **Dependencies:** Phase 1 complete
- **Deliverables:**
  - Install and configure Vitest and React Testing Library.
  - Set up mock configurations for services and libraries where required (e.g., mock for Capacitor plugins).
  - Create a sample unit test for a simple component to verify the setup.
  - Add test scripts to `package.json` (e.g., `test`, `test:watch`).
- **Architectural References:**
  - Testing Strategy section [`testing-strategy`](./SHORT_TERM_PLAN.md#testing-strategy)
- **Acceptance Criteria:**
  - [x] `npm test` command runs successfully.
  - [x] A sample component unit test passes.
  - [x] Mocks for Capacitor plugins are working correctly in the test environment.

### Phase 12: Create Logic for Automatic Tracking
- **Priority:** Critical (core feature)
- **Dependencies:** Phase 2 complete, Phase 9 complete
- **Deliverables:**
  - Implement `BrewingSessionService` with complete automatic detection logic following the [GongFu Brewing Tracking Process](./FEATURES.md#gongfu-brewing-tracking-process):
    - Setup phase: detect stable vessel weight, detect lid removal and calculate `lidWeight`, track tea addition
    - Infusion detection: detect water addition (significant weight increase above sensitivity threshold), auto-start infusion timer
    - Lid handling: ignore weight changes matching `lidWeight` during infusion
    - Vessel removal: detect weight drop to near zero, pause timer without stopping
    - Pour detection: on vessel return, check if weight decreased by `minEndInfusionWeight`, end infusion if yes, resume if no
    - Post-infusion: calculate and save `wetLeavesWeight`, start rest timer
    - Next infusion: detect new water addition, stop rest timer, save `restDuration`, start new infusion timer
  - Implement `TimerService` for infusion and rest timers with alert notifications
  - Create `BrewingState` store slice to track active session, current infusion, timer status, brewing phase
  - Implement `SessionRepository` to persist infusions and complete sessions to database
  - Add debouncing and threshold logic to handle weight fluctuations and ambiguous scenarios
  - Implement manual override capabilities for edge cases
- **Architectural References:**
  - [BrewingSessionService](./ARCHITECTURE.md#core-components) in Service Layer
  - [TimerService](./ARCHITECTURE.md#core-components) in Service Layer
  - [SessionRepository](./ARCHITECTURE.md#core-components) in Data Layer
  - [BrewingState](./ARCHITECTURE.md#state-management) in State Management
  - [BrewingSession and Infusion models](./ARCHITECTURE.md#domain-models) in Domain Models
  - [Complete Automatic Session Tracking workflow](./ARCHITECTURE.md#component-interaction-details) in Component Interaction Details section
  - [Data Flow sequence diagram](./ARCHITECTURE.md#data-flow) showing service interactions
- **Feature References:**
  - [Complete GongFu Brewing Tracking Process](./FEATURES.md#gongfu-brewing-tracking-process)
  - [Automatic Session Tracking feature requirements](./FEATURES.md#core-functionality)
- **Testing Strategy:**
  - Use MockScaleService with recorded sessions to test detection logic
  - Use fast-forward mode to rapidly iterate on threshold tuning
  - Test edge cases: quick vessel movements, ambiguous pours, interrupted sessions
- **Acceptance Criteria:**
  - ✅ A full brewing session is automatically tracked from start to finish using the mock scale.
  - ✅ Infusion and rest timers are triggered correctly based on weight changes.
  - ✅ The session data is correctly persisted to the database.

### Phase 13: Create Basic UI for Automatic Tracking
- **Priority:** Critical (user-facing core feature)
- **Dependencies:** Phase 12 complete
- **Deliverables:**
  - Implement comprehensive BrewingScreen UI:
    - Large current weight display
    - Current infusion number and timer display (infusion or rest)
    - Brewing phase indicator (setup, infusion, rest, ended)
    - Tea name input/selector
    - Session notes field
    - Control buttons: start session, begin infusion tracking, end session
    - Manual override buttons: manual start/stop timer (for edge cases)
    - Visual feedback for automatic detections: vessel placed, lid removed, water added, tea poured
    - Progress indicators for setup phase: vessel weight ✓, lid weight ✓, tea weight ✓
  - Wire up `BrewingState` to UI using Zustand hooks
  - Add real-time updates as weight changes and timers progress
  - Implement alert notifications (sound/vibration) when timers complete
  - Add confirmation dialogs for session end
  - Display connection status and weight source (real scale vs mock)
- **Architectural References:**
  - [BrewingScreen](./ARCHITECTURE.md#core-components) in UI Layer
  - [BrewingState consumption](./ARCHITECTURE.md#state-management) in State Management section
  - [Data Flow diagram](./ARCHITECTURE.md#data-flow) showing state updates triggering UI re-renders
- **Feature References:**
  - [Real-time Brewing Screen requirements](./FEATURES.md#core-functionality)
  - [GongFu Brewing Tracking Process user interactions](./FEATURES.md#gongfu-brewing-tracking-process)
- **Acceptance Criteria:**
  - ✅ The UI accurately reflects the current state of the brewing session in real-time.
  - ✅ Timers and phase indicators are clearly visible and update correctly.
  - ✅ User can manually override the automatic tracking if needed.

### Phase 14: Create Logic for Session Management
- **Priority:** High (completes core functionality)
- **Dependencies:** Phase 12 complete
- **Deliverables:**
  - Extend `SessionRepository` with query methods:
    - `getAllSessions()`: retrieve all sessions ordered by date
    - `getSessionById(sessionId)`: retrieve single session with all infusions
    - `getSessionsByTeaName(teaName)`: filter sessions by tea
    - `deleteSession(sessionId)`: remove session and associated infusions
  - Implement `HistoryState` store slice to cache session list and selected session
  - Add session statistics calculations: total infusions, total brew time, average infusion duration
  - Add session search and filtering capabilities
  - **Optional enhancement:** Implement session export functionality (e.g., generate JSON/CSV).
- **Architectural References:**
  - [SessionRepository](./ARCHITECTURE.md#core-components) in Data Layer
  - [HistoryState](./ARCHITECTURE.md#state-management) in State Management
  - [Session persistence flow](./ARCHITECTURE.md#data-flow) in Data Flow section
- **Feature References:**
  - [Session History requirements](./FEATURES.md#session-history)
- **Acceptance Criteria:**
  - ✅ All past brewing sessions are retrieved from the database.
  - ✅ A single session's details can be queried and viewed.
  - ✅ Sessions can be deleted from the database.

### Phase 15: Create Basic UI for Session Management
- **Priority:** High (completes MVP)
- **Dependencies:** Phase 14 complete
- **Deliverables:**
  - Implement HistoryScreen with session list:
    - Display sessions in chronological order (most recent first)
    - Show tea name, date, number of infusions for each session
    - Add search and filter controls
    - Add delete session action with confirmation
    - **Optional enhancement:** Implement pull-to-refresh.
  - Implement SessionDetailScreen:
    - Display session metadata: tea name, date, total time, notes
    - Show infusion list with details: infusion number, duration, rest duration, water weight, wet leaves weight
    - Display session statistics
    - Add edit notes capability
    - **Optional enhancement:** Add export session button.
  - Wire up `HistoryState` to UI components
  - Implement navigation from HistoryScreen to SessionDetailScreen
- **Architectural References:**
  - [HistoryScreen and SessionDetailScreen](./ARCHITECTURE.md#core-components) in UI Layer
  - [HistoryState consumption](./ARCHITECTURE.md#state-management) in State Management section
- **Feature References:**
  - [Session History requirements](./FEATURES.md#session-history)
- **Acceptance Criteria:**
  - ✅ The history screen lists all past sessions correctly.
  - ✅ User can navigate to a session's detail screen.
  - ✅ User can delete a session from the history screen.

### Dependencies Summary
- **Critical Path:** Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 12 → Phase 13 (core brewing functionality)
- **Dev Mode Path:** Phase 4 → Phase 5 → Phase 6 → Phase 7 → Phase 8 (enables efficient development)
- **Parallel Tracks:**
  - Phase 9 (entities) can start after Phase 1. Note: `TeaEntity` is not an MVP blocker.
  - Phase 10 (settings UI) requires Phase 9 and Phase 3
  - Phase 11 (testing setup) can start after Phase 1
  - Phase 14-15 (session management) can be developed in parallel with Phase 12-13

### Testing Strategy
- Use MockScaleService with recorded sessions for consistent, repeatable testing
- Use fast-forward mode to accelerate integration tests
- Test on real Android hardware periodically to validate Bluetooth integration
- Capture edge cases as recorded sessions for regression testing
- Manual testing of complete GongFu brewing workflows before MVP release

### Success Criteria for MVP
- ✅ App successfully connects to Bluetooth scale and displays real-time weight
- ✅ Automatic detection correctly identifies all phases of GongFu brewing process
- ✅ Infusion and rest timers start/stop automatically based on weight changes
- ✅ Sessions are persisted with complete infusion data
- ✅ History screen displays past sessions with detailed infusion logs
- ✅ Settings allow customization of detection thresholds
- ✅ Dev mode enables hardware-free development and testing
- ✅ App runs smoothly on Android devices

### Post-MVP Considerations
- Advanced features deferred to [`LONG_TERM_PLAN.md`](./LONG_TERM_PLAN.md):
  - Tea library with detailed brewing parameters
  - Analytics and visualizations
  - Cloud sync and backup
  - iOS support
  - Multi-device support
  - timer functionality
- clean up ui
- zen brew mode
