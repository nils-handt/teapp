# User Stories

These user stories guide the implementation of the tea brewing app, ensuring that features align with the technical architecture defined in ARCHITECTURE.md and the detailed requirements in FEATURES.md. They provide clear acceptance criteria to bridge user needs with implementation details.

## Personas

*   **Alex, the GongFu Enthusiast:** Alex brews tea daily using a gaiwan and wants to perfect their technique. They want to track infusion times precisely without getting distracted by a manual stopwatch.
*   **Jordan, the Tea Beginner:** Jordan is new to GongFu brewing and needs more guidance on the process. They appreciate step-by-step instructions, visual cues, and simple explanations to build confidence in their brewing sessions. (Note: Jordan-focused stories will be added when implementing onboarding features, as described in Feature 4.4 of LONG_TERM_PLAN.md).

## Initial Setup & Connection

1. **First-Time Setup:**
    *   As Alex, I want to open the app for the first time and be guided to connect to my Bluetooth scale so I can start a brewing session.

2. **Managing Bluetooth Connection**
    * As Alex, I want to easily connect to my preferred scale without scanning every time so I can start brewing sessions quickly
    * **Acceptance Criteria:**
      - I can scan for available Bluetooth scales from SettingsScreen using BluetoothScaleService
      - I can see a list of discovered devices with their names and signal strength
      - I can select a device to pair and save it as my preferred device via SettingsRepository
      - I can enable/disable auto-connect preference so BrewingScreen automatically connects to my preferred device on mount, as described in the Bluetooth Scale Integration workflow in `./ARCHITECTURE.md`
      - I can manually connect/disconnect from BrewingScreen if auto-connect is disabled or fails
      - I can see connection status indicators (scanning, connecting, connected, disconnected)
      - I can forget a paired device and select a new one
      - The preferred device is persisted using the ScaleDevice model from `./ARCHITECTURE.md`

## Brewing Session Tracking

3. **Automatic Tea Session Tracking:**
    *   As Alex, I want the app to automatically start a timer the moment I pour hot water into my gaiwan.
    *   As Alex, I want the app to log the infusion time and increment the infusion count when I pour the tea out into a cup or pitcher.
    * **Acceptance Criteria:**
      - The app detects water addition when weight increases above the sensitivity threshold configured in Settings
      - The infusion timer starts automatically via TimerService when water is detected
      - The app detects tea pouring when weight decreases by at least minEndInfusionWeight after vessel return
      - The infusion timer stops, infusion data is saved via SessionRepository, and the infusion counter increments
      - All automatic detection follows the workflow described in `./FEATURES.md` and `./ARCHITECTURE.md`

4. **Handling Lid During Brewing**
    * As Alex, I want to add or remove the lid during infusion without affecting the timer so I can check the tea leaves or adjust temperature
    * **Acceptance Criteria:**
      - During setup phase, the app detects and records lid weight when I remove it from the vessel
      - During infusion, weight changes matching the lid weight (within tolerance) are ignored by BrewingSessionService
      - The infusion timer continues running when I add or remove the lid
      - During rest phase, I can freely manipulate the lid without affecting the rest timer
      - This behavior aligns with the Lid Handling During Infusion and Rest Phase steps in the GongFu Brewing Tracking Process from `./FEATURES.md`

5. **Removing Vessel During Infusion**
    * As Alex, I want to remove the brewing vessel from the scale during infusion (e.g., to swirl the tea) without losing my timer progress
    * **Acceptance Criteria:**
      - When I remove the vessel (weight drops to near zero), BrewingSessionService pauses the infusion timer but doesn't stop it
      - The timer duration is saved so I don't lose progress
      - When I return the vessel to the scale, the app checks if tea was poured out (weight decreased by minEndInfusionWeight)
      - If tea was poured, the infusion ends, timer stops, infusion data is saved, counter increments, and rest timer starts
      - If tea was not poured (weight similar to before removal), the infusion timer resumes from where it paused
      - This workflow matches the Vessel Removal and Vessel Return & Pour Detection steps in `./FEATURES.md` and the Automatic Session Tracking workflow in `./ARCHITECTURE.md`

6. **Tracking Rest Time Between Infusions**
    * As Alex, I want the app to track how long I rest the tea leaves between infusions so I can understand how rest time affects flavor
    * **Acceptance Criteria:**
      - After an infusion ends, BrewingSessionService automatically starts a rest timer via TimerService
      - The rest timer is displayed in BrewingScreen with a clear indicator that I'm in rest phase
      - I can manipulate the vessel and lid during rest without affecting the timer
      - When I add water for the next infusion, the rest timer stops and restDuration is saved to the previous Infusion model
      - Rest duration is displayed for each infusion in SessionDetailScreen
      - This aligns with the Post-Infusion and Rest Phase steps in `./FEATURES.md`

7. **Recording Wet Leaves Weight**
    * As Alex, I want the app to record the weight of wet tea leaves after each infusion so I can track how much water the leaves absorb
    * **Acceptance Criteria:**
      - After an infusion ends and before the rest timer starts, BrewingSessionService captures the current weight
      - The wetLeavesWeight is calculated (current weight minus vessel and lid weights) and stored in the Infusion model
      - Wet leaves weight is displayed for each infusion in SessionDetailScreen
      - I can see how wet leaves weight changes across infusions in the same session
      - This matches the Post-Infusion step in the Automatic Session Tracking workflow in `./ARCHITECTURE.md`

8. **Using Manual Timer Controls**
    * As Alex, I want to manually start or stop timers when automatic detection fails so I can still track my session accurately
    * **Acceptance Criteria:**
      - BrewingScreen provides manual override buttons: start infusion timer, stop infusion timer, start rest timer
      - Manual controls are clearly distinguished from automatic mode
      - When I use manual controls, the app still records all weight data for the session
      - I can switch between automatic and manual mode mid-session
      - Manual overrides don't break the session flow or data integrity
      - This manual override capability is mentioned in the Error handling and edge cases section of `./ARCHITECTURE.md`

## Session Information & Notes

9. **Adding Information to a Session:**
    *   As Alex, I want to be able to add notes to my session, like:
      * tasting notes
      * With suggestions based on previous Sessions 
        * Name of Tea (examples: 'ORT Daily Rougui', 'YN Big Red Robe')
        * Kind of water used (examples: 'Volvic', 'Brita Filter')

10. **Tracking Tea Information**
    * As Alex, I want to record which tea I'm brewing so I can compare brewing sessions for the same tea over time
    * **Acceptance Criteria:**
      - I can enter a tea name when starting a session in BrewingScreen
      - [Post-MVP] I can optionally specify tea type (e.g., oolong, puerh, black, green)
      - The app suggests previously used tea names as I type (autocomplete from SessionRepository)
      - Tea information is saved with the session via SessionRepository using the BrewingSession model from `./ARCHITECTURE.md`
      - I can view sessions filtered by tea name in HistoryScreen
      - [Post-MVP] Tea names and types are stored using the Tea model for future tea library features

11. **Adding and Editing Session Notes**
    * As Alex, I want to add detailed notes during or after a session so I can remember important details about the brewing experience
    * **Acceptance Criteria:**
      - I can add notes in a text field in BrewingScreen during an active session
      - I can edit notes in SessionDetailScreen after a session is completed
      - The app suggests note categories or prompts: tasting notes, water type, brewing observations
      - Notes are saved with the session via SessionRepository in the BrewingSession model
      - I can search sessions by note content in HistoryScreen
      - This expands on the existing "Adding Information to a Session" story with more specific acceptance criteria

## Session History & Review

12. **Reviewing past Sessions** 
    *   After the session is over, I want to be able to look back at the log to see how long each infusion was / how much tea and water was used / how many infusions were brewed / what tasting notes were added.
    * **Acceptance Criteria:**
      - HistoryScreen displays sessions in chronological order (most recent first)
      - Each session entry shows tea name, date, and number of infusions
      - Tapping a session navigates to SessionDetailScreen
      - SessionDetailScreen shows all infusion details and session notes
      - Data is retrieved from SessionRepository using the BrewingSession and Infusion models
      - This aligns with Session History requirements in `./FEATURES.md`

13. **Viewing Detailed Session Statistics**
    * As Alex, I want to see comprehensive statistics for each brewing session so I can analyze my brewing technique
    * **Acceptance Criteria:**
      - In SessionDetailScreen, I can see session metadata: tea name, date, total session time, vessel weight, lid weight, tea weight
      - I can see a list of all infusions with details: infusion number, water weight, infusion duration, rest duration, wet leaves weight
      - I can see calculated statistics: total infusions, average infusion duration, total water used, total brewing time
      - Data is retrieved from SessionRepository and displayed using the BrewingSession and Infusion models from `./ARCHITECTURE.md`
      - This extends the "Reviewing past Sessions" story with specific details from `./FEATURES.md`

## Settings & Configuration

14. **Configuring Scale Settings**
    * As Alex, I want to configure my scale's sensitivity settings so that the app accurately detects when I'm pouring tea versus just moving the vessel slightly
    * **Acceptance Criteria:**
      - I can access scale configuration from SettingsScreen
      - I can adjust the sensitivity threshold (minimum weight change) that triggers pour detection, referencing the sensitivity setting in the Settings model from `./ARCHITECTURE.md`
      - I can set the minEndInfusionWeight value that determines how much weight reduction is needed to end an infusion, as described in Scale Configuration section of `./FEATURES.md`
      - I can toggle tare behavior preferences
      - Changes are persisted via SettingsRepository and immediately affect BrewingSessionService detection logic

15. **Configuring Timer Preferences**
    * As Alex, I want to customize timer alerts so I'm notified when an infusion is ready without being disruptive during quiet tea sessions
    * **Acceptance Criteria:**
      - I can access timer preferences from SettingsScreen
      - I can toggle sound alerts on/off
      - I can toggle vibration alerts on/off
      - I can preview alert sounds before saving
      - Changes are persisted via SettingsRepository and affect TimerService alert behavior
      - Settings align with timer preferences in the Settings model from `./ARCHITECTURE.md`

## Error Handling & Edge Cases

16. **Handling Bluetooth Disconnection**
    * As Alex, I want the app to gracefully handle Bluetooth disconnection during a brewing session so I don't lose my session data
    * **Acceptance Criteria:**
      - If BluetoothScaleService loses connection during an active session, BrewingSessionService pauses the session
      - I see a clear notification that Bluetooth connection was lost
      - The app attempts automatic reconnection in the background
      - If reconnection succeeds, the session resumes from where it paused
      - If reconnection fails, I can manually trigger reconnection or continue the session with manual timer controls
      - All session data up to the disconnection point is preserved
      - This error handling approach is described in the Error handling and edge cases section of `./ARCHITECTURE.md`

17. **Dealing with Ambiguous Weight Changes**
    * As Alex, I want the app to handle unclear weight changes intelligently so it doesn't incorrectly start or stop timers
    * **Acceptance Criteria:**
      - BrewingSessionService uses configurable thresholds from SettingsRepository to determine significant weight changes
      - Small weight fluctuations (below sensitivity threshold) are ignored to prevent false triggers
      - Debouncing is applied to weight readings to filter out noise and vibrations
      - If the app is uncertain about a weight change (e.g., ambiguous pour), it provides visual feedback asking for confirmation
      - I can see why the app made a decision (e.g., "Water detected: +150g above threshold")
      - This aligns with the error handling for ambiguous weight changes in `./ARCHITECTURE.md`

18. **Recovering from App Interruption**
    * As Alex, I want the app to preserve my active session if I switch apps or receive a phone call so I don't lose my brewing data
    * **Acceptance Criteria:**
      - If the app goes to background during an active session, BrewingState is preserved
      - Timers continue running in the background (or pause with duration saved)
      - When I return to the app, the session resumes from the correct state
      - If the app is killed by the system, the session data up to the last saved infusion is preserved in SessionRepository
      - I receive a notification or prompt to resume the interrupted session when reopening the app
