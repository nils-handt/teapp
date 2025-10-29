**Introduction Section:**
- Brief overview stating this document outlines post-MVP enhancements and future roadmap for Teapp
- Emphasize that these features build upon the MVP foundation established in [`SHORT_TERM_PLAN.md`](./SHORT_TERM_PLAN.md)
- Note that features are organized by thematic areas to facilitate prioritization and phased development
- Clarify that implementation order and priorities will be determined based on user feedback and usage patterns after MVP release

**MVP Foundation Reference Section:**
- Summarize the MVP capabilities that serve as the foundation:
  - Bluetooth scale integration with real-time weight streaming (BluetoothScaleService)
  - Automatic brewing session tracking with infusion/rest timers (BrewingSessionService, TimerService)
  - Session persistence and history (SessionRepository, HistoryState)
  - Basic settings for scale configuration (SettingsRepository, SettingsState)
  - Dev mode with mock scale replay and fast-forward testing (MockScaleService, WeightLoggerService)
- Reference the complete MVP architecture from [`SHORT_TERM_PLAN.md`](./SHORT_TERM_PLAN.md) Phase 1-15
- Note that all long-term features will leverage and extend these existing components

**Theme 1: Tea Library Management**

**Overview:**
- Introduce a comprehensive tea library system to manage tea collection with detailed brewing parameters
- Enable users to store, search, and reference tea-specific information during brewing sessions
- Replace the simple teaName string field with rich tea profiles

**Feature 1.1: Tea Library Database Schema**
- **Description:**
  - Implement the TeaEntity table that was deferred from MVP (noted in [`SHORT_TERM_PLAN Phase 9`](./SHORT_TERM_PLAN.md#phase-9-create-database-entities))
  - Schema: teaId (PK), name, type (green, black, oolong, puerh, white, etc.), origin, vendor, purchaseDate, storageLocation, quantity, notes, defaultBrewingParameters (JSON), imageUri, isFavorite
  - Create foreign key relationship: BrewingSession.teaId → Tea.teaId
  - Implement database migration to add TeaEntity and update existing BrewingSessionEntity records
- **Architectural Components:**
  - Create Tea domain model (referenced in ARCHITECTURE.md Domain Models section)
  - Implement TeaRepository in Data Layer for CRUD operations
  - Create TeaState store slice in State Management for tea library cache
- **Dependencies:**
  - MVP Phase 9 (Database Entities) complete
  - SessionRepository must be updated to handle teaId foreign key
- **Priority:** High (foundation for all tea library features)

**Feature 1.2: Tea Library UI**
- **Description:**
  - Create TeaLibraryScreen with searchable, filterable list of teas
  - Display tea cards showing name, type, origin, and favorite status
  - Implement search by name, filter by type, sort by name/date/favorite
  - Add floating action button to create new tea entry
  - Implement pull-to-refresh for tea list
- **Architectural Components:**
  - Create TeaLibraryScreen in UI Layer
  - Wire up TeaState to UI using Zustand hooks
  - Add navigation route from main app shell to TeaLibraryScreen
- **Dependencies:**
  - Feature 1.1 complete
- **Priority:** High (user-facing tea library access)

**Feature 1.3: Tea Detail and Edit UI**
- **Description:**
  - Create TeaDetailScreen to view and edit tea information
  - Display all tea metadata fields with edit capability
  - Add image picker for tea photo (store imageUri in TeaEntity)
  - Implement defaultBrewingParameters editor: recommended water temperature, vessel type, tea-to-water ratio, suggested infusion durations array
  - Add delete tea action with confirmation (check for associated sessions first)
  - Show quick stats: total sessions brewed, last brewed date, average infusions per session
- **Architectural Components:**
  - Create TeaDetailScreen in UI Layer
  - Extend TeaRepository with getTeaStatistics(teaId) method
  - Integrate with device camera/gallery via Capacitor Camera plugin
- **Dependencies:**
  - Feature 1.2 complete
- **Priority:** High (completes basic tea library functionality)

**Feature 1.4: Tea Selection in Brewing Session**
- **Description:**
  - Replace simple tea name text input in BrewingScreen with tea selector
  - Implement tea picker modal: search and select from tea library or create quick entry
  - Display selected tea's defaultBrewingParameters as reference during brewing
  - Show suggested infusion duration for current infusion number based on tea's parameters
  - Allow quick access to tea details from BrewingScreen
- **Architectural Components:**
  - Update BrewingScreen UI to integrate tea selector
  - Modify BrewingSessionService to accept teaId instead of teaName
  - Update BrewingState to include selected tea object
- **Dependencies:**
  - Feature 1.3 complete
  - MVP Phase 13 (Brewing UI) complete
- **Priority:** Medium-High (improves brewing workflow)

**Feature 1.5: Tea Library Import/Export**
- **Description:**
  - Implement tea library export to JSON/CSV format
  - Implement tea library import from JSON/CSV with duplicate detection
  - Enable sharing tea library between devices or with other users
  - Support batch operations: import multiple teas at once
- **Architectural Components:**
  - Extend TeaRepository with exportAllTeas() and importTeas(data) methods
  - Use Capacitor Filesystem plugin for file operations
  - Implement data validation and conflict resolution logic
- **Dependencies:**
  - Feature 1.3 complete
- **Priority:** Medium (enables data portability)

**Theme 2: Advanced Analytics and Visualizations**

**Overview:**
- Provide insights into brewing patterns, tea consumption, and brewing technique evolution
- Enable data-driven optimization of brewing parameters
- Visualize trends over time to help users improve their GongFu brewing skills

**Feature 2.1: Session Analytics Service**
- **Description:**
  - Create AnalyticsService to compute statistics across sessions
  - Implement aggregation queries:
    - Total sessions, total infusions, total brew time (all-time and date-range filtered)
    - Sessions per tea, average infusions per tea type
    - Brewing frequency over time (sessions per day/week/month)
    - Most brewed teas, favorite tea types
    - Average infusion durations by tea type and infusion number
    - Consistency metrics: standard deviation of infusion durations for same tea
- **Architectural Components:**
  - Create AnalyticsService in Service Layer
  - Extend SessionRepository with complex aggregation queries
  - Create AnalyticsState store slice to cache computed statistics
- **Dependencies:**
  - MVP Phase 14 (Session Management Logic) complete
  - Feature 1.1 (Tea Library Database) recommended but not required
- **Priority:** Medium-High (foundation for analytics features)

**Feature 2.2: Analytics Dashboard Screen**
- **Description:**
  - Create AnalyticsScreen with overview dashboard
  - Display key metrics cards: total sessions, total infusions, favorite tea, brewing streak
  - Show brewing frequency chart: sessions over time (line chart)
  - Display tea type distribution (pie chart or bar chart)
  - Add date range selector for filtering analytics
  - Implement refresh mechanism to recompute statistics
- **Architectural Components:**
  - Create AnalyticsScreen in UI Layer
  - Integrate charting library (e.g., Chart.js, Recharts, or Victory Native)
  - Wire up AnalyticsState to UI components
  - Add navigation route to AnalyticsScreen from main app shell
- **Dependencies:**
  - Feature 2.1 complete
- **Priority:** Medium (user-facing analytics)

**Feature 2.3: Tea-Specific Analytics**
- **Description:**
  - Add detailed analytics view for individual teas in TeaDetailScreen
  - Display infusion duration trends over time for specific tea (line chart showing how user's technique evolves)
  - Show infusion duration distribution by infusion number (e.g., average 1st infusion: 15s, 2nd: 20s, etc.)
  - Compare user's brewing parameters against tea's defaultBrewingParameters
  - Highlight consistency: show variance in infusion durations across sessions
  - Suggest parameter adjustments based on historical data
- **Architectural Components:**
  - Extend AnalyticsService with getTeaAnalytics(teaId, dateRange) method
  - Update TeaDetailScreen to include analytics section
  - Implement comparison logic between actual and recommended parameters
- **Dependencies:**
  - Feature 2.1 complete
  - Feature 1.3 (Tea Detail UI) complete
- **Priority:** Medium (enhances tea library with insights)

**Feature 2.4: Brewing Technique Insights**
- **Description:**
  - Analyze brewing patterns to provide actionable insights
  - Detect anomalies: unusually short/long infusions, inconsistent rest times
  - Identify improvement opportunities: suggest more consistent timing, optimal water amounts
  - Track skill progression: measure consistency improvement over time
  - Generate weekly/monthly brewing reports with highlights and recommendations
- **Architectural Components:**
  - Extend AnalyticsService with insight generation algorithms
  - Create InsightsScreen or add insights section to AnalyticsScreen
  - Implement notification system for weekly reports (optional)
- **Dependencies:**
  - Feature 2.1 complete
- **Priority:** Low-Medium (advanced analytics feature)

**Theme 3: Multi-Brew Support**

**Overview:**
- Enable tracking multiple brewing sessions simultaneously
- Support scenarios where users brew different teas in parallel or switch between vessels
- Enhance flexibility for advanced users with multiple brewing setups

**Feature 3.1: Multiple Active Sessions Architecture**
- **Description:**
  - Refactor BrewingSessionService to support multiple concurrent active sessions
  - Change BrewingState from single active session to array of active sessions
  - Implement session switching logic: pause current session, activate different session
  - Add session identification: assign unique sessionId on creation, display session name/tea name
  - Handle weight data routing: associate weight updates with correct active session
- **Architectural Components:**
  - Refactor BrewingSessionService to manage sessions array instead of single session
  - Update BrewingState schema: activeSessions array, currentSessionId
  - Modify TimerService to track multiple timers simultaneously
  - Update SessionRepository to handle multiple active sessions
- **Dependencies:**
  - MVP Phase 12 (Automatic Tracking Logic) complete
  - Significant architectural refactoring required
- **Priority:** Low-Medium (niche use case, complex implementation)
- **Considerations:**
  - Single scale limitation: only one session can receive weight updates at a time
  - UI complexity: need clear indication of which session is active
  - Potential confusion: may complicate user experience for majority of users

**Feature 3.2: Multi-Brew UI**
- **Description:**
  - Update BrewingScreen to display multiple active sessions
  - Implement session tabs or cards: swipe between active sessions
  - Add visual indicator for currently active session (receiving weight data)
  - Implement session switcher: tap to activate different session
  - Show mini-timers for all active sessions simultaneously
  - Add "pause session" action: temporarily deactivate without ending
- **Architectural Components:**
  - Refactor BrewingScreen to support multiple session views
  - Implement session carousel or tab navigation
  - Update UI to consume activeSessions array from BrewingState
- **Dependencies:**
  - Feature 3.1 complete
- **Priority:** Low-Medium (completes multi-brew functionality)

**Feature 3.3: Multi-Scale Support**
- **Description:**
  - Extend BluetoothScaleService to connect to multiple scales simultaneously
  - Associate each active session with a specific scale device
  - Route weight updates from each scale to its corresponding session
  - Handle scale disconnections gracefully: pause affected session only
  - Add scale selector in session creation: choose which scale to use
- **Architectural Components:**
  - Refactor BluetoothScaleService to manage multiple connections
  - Update BluetoothState to track multiple connected devices
  - Modify BrewingSessionService to accept scaleDeviceId parameter
  - Update BrewingState to include scaleDeviceId per session
- **Dependencies:**
  - Feature 3.1 complete
  - MVP Phase 2 (Bluetooth Integration) requires significant refactoring
- **Priority:** Low (very niche use case, high complexity)
- **Considerations:**
  - Hardware limitation: most users have only one scale
  - Bluetooth connection limits: device may not support many concurrent connections
  - Increased battery drain and complexity

**Theme 4: Usability Enhancements**

**Overview:**
- Improve user experience with quality-of-life features
- Reduce friction in common workflows
- Enhance accessibility and customization options

**Feature 4.1: Brewing Templates and Presets**
- **Description:**
  - Create brewing templates: predefined parameter sets for common tea types
  - Allow users to create custom templates from successful sessions
  - Quick-start brewing: select template to pre-populate session parameters
  - Template library: share and import templates from community
- **Architectural Components:**
  - Create BrewingTemplate domain model: templateId, name, teaType, parameters, isCustom
  - Implement TemplateRepository in Data Layer
  - Add template selector to BrewingScreen session start flow
- **Dependencies:**
  - MVP Phase 12-13 (Brewing Logic and UI) complete
- **Priority:** Medium (improves onboarding and workflow)

**Feature 4.2: Quick Actions and Shortcuts**
- **Description:**
  - Add home screen widget (Android) showing current brewing status
  - Implement quick actions: "Start Brewing" from home screen
  - Add notification controls: pause/resume timer from notification
  - Create Siri Shortcuts / Google Assistant integration for voice commands
- **Architectural Components:**
  - Implement Android widget using Capacitor or native code
  - Extend notification system with action buttons
  - Integrate with platform-specific shortcut APIs
- **Dependencies:**
  - MVP Phase 13 (Brewing UI) complete
- **Priority:** Low-Medium (convenience feature)

**Feature 4.3: Customizable Themes and UI**
- **Description:**
  - Implement dark mode and light mode themes
  - Add theme selector in SettingsScreen
  - Create custom color schemes: allow users to choose accent colors
  - Implement font size adjustment for accessibility
  - Add option to customize timer display format and size
- **Architectural Components:**
  - Extend SettingsState with theme preferences
  - Implement CSS variables or styled-components theming
  - Update all UI components to respect theme settings
- **Dependencies:**
  - MVP Phase 10 (Settings UI) complete
- **Priority:** Medium (improves accessibility and personalization)

**Feature 4.4: Onboarding and Tutorials**
- **Description:**
  - Create first-run onboarding flow: explain app concept and GongFu brewing process
  - Implement interactive tutorial: guide user through first brewing session using mock scale
  - Add contextual help tooltips throughout app
  - Create help center screen with FAQs and troubleshooting guides
  - Implement "What's New" screen for app updates
- **Architectural Components:**
  - Create OnboardingScreen with multi-step wizard
  - Implement tutorial mode: special state that guides user actions
  - Add help overlay system for contextual tooltips
  - Create HelpScreen in UI Layer
- **Dependencies:**
  - MVP Phase 7-8 (MockScale) can be leveraged for tutorial
- **Priority:** Medium-High (improves user adoption)

**Feature 4.5: Backup and Restore**
- **Description:**
  - Implement local backup: export complete database to file
  - Create restore functionality: import database from backup file
  - Add automatic backup scheduling: daily/weekly backups to device storage
  - Implement backup to cloud storage (Google Drive, iCloud) with user consent
  - Include backup management UI: view backups, restore from specific backup, delete old backups
- **Architectural Components:**
  - Create BackupService in Service Layer
  - Implement database export/import using SQLite backup API
  - Integrate with Capacitor Filesystem plugin for local storage
  - Integrate with cloud storage APIs (optional)
- **Dependencies:**
  - MVP Phase 9 (Database Entities) complete
- **Priority:** High (data safety and user trust)

**Theme 5: Platform Expansion**

**Overview:**
- Expand app availability to additional platforms
- Ensure feature parity across platforms
- Optimize for platform-specific capabilities

**Feature 5.1: iOS Support**
- **Description:**
  - Configure Capacitor for iOS build
  - Set up Xcode project and build configuration
  - Configure Bluetooth permissions in Info.plist
  - Test Bluetooth scale connection on iOS devices
  - Verify all features work correctly on iOS
  - Submit app to Apple App Store
- **Architectural Components:**
  - No architectural changes required (Capacitor handles cross-platform)
  - May need platform-specific code for iOS-specific features
- **Dependencies:**
  - MVP complete and stable on Android
- **Priority:** High (major platform expansion)
- **Considerations:**
  - Apple App Store review process and guidelines
  - iOS-specific Bluetooth permission requirements
  - Potential need for Apple Developer account and certificates

**Theme 6: Session sharing**

**Overview:**
- Enable users to share brewing experiences

**Feature 6.1: Session Sharing**
- **Description:**
  - Implement session export as shareable format: image card with session summary
  - Generate beautiful session cards: tea name, infusion count, total time, infusion timeline visualization
  - Add share button in SessionDetailScreen: share to social media, messaging apps
  - Support sharing session data as JSON for import by other users
- **Architectural Components:**
  - Create SessionCardGenerator service: render session data as image
  - Integrate with Capacitor Share plugin
  - Implement session import from shared JSON
- **Dependencies:**
  - MVP Phase 15 (Session Management UI) complete
- **Priority:** Low-Medium (social feature)

**Implementation Prioritization Framework:**

**High Priority (implement first after MVP):**
- Feature 1.1-1.4: Tea Library Management (core functionality extension)
- Feature 4.5: Backup and Restore (data safety)
- Feature 4.4: Onboarding and Tutorials (user adoption)
- Feature 5.1: iOS Support (platform expansion)

**Medium Priority (implement based on user feedback):**
- Feature 2.1-2.2: Basic Analytics (user insights)
- Feature 4.1: Brewing Templates (workflow improvement)
- Feature 4.3: Customizable Themes (accessibility)

**Low Priority (implement for advanced users or niche use cases):**
- Feature 3.1-3.3: Multi-Brew Support (complex, niche)

**Dependencies on External Factors:**
- iOS support requires Apple Developer account and App Store approval

**Conclusion:**
- This roadmap provides a comprehensive vision for Teapp's evolution beyond MVP
- Implementation should be guided by user feedback, usage analytics, and resource availability
- Features are designed to build incrementally on the solid MVP foundation
- Prioritization framework helps focus development on highest-impact features first
- Regular reassessment of priorities based on user needs is recommended
