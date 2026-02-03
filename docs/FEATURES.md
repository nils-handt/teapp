# Application Features

This document outlines the core features of the Teapp application. For a detailed breakdown of which features are included in the Minimum Viable Product (MVP) and which are planned for future releases, please see `docs/SHORT_TERM_PLAN.md` and `docs/LONG_TERM_PLAN.md`.

## MVP Features

### Core Functionality

*   **Bluetooth Device Discovery & Pairing:**
    *   Scan for nearby Bluetooth Low Energy (BLE) devices.
    *   Filter for compatible scales.
    *   Save a preferred device for quick connection.

*   **Real-time Brewing Screen:**
    *   Display current weight from the scale.
    *   Show current infusion number and timer.
    *   Button to manually start/stop/reset a session.
    *   Display the name of the tea being brewed.
    *   Field for adding session notes.

*   **Automatic Session Tracking:**
    *   Detect initial weight of the brewing vessel (e.g., gaiwan or teapot).
    *   Detect a significant weight increase to automatically start an infusion timer (adding water).
    *   Detect a weight decrease to automatically stop the timer and log the infusion (pouring tea).
    *   Increment the infusion counter.

### GongFu Brewing Tracking Process

* **Brewing Setup**
  * Start Session in App
  * Put brewing vessel on Scale to automatically initiate vessel Weight
  * Remove brewing vessel Lid from brewing vessel to automatically initiate vessel lid weight
    * alternatively add and remove brewing vessel lid from brewing vessel
  * Weigh out tea for Session
  * Start infusion tracking by pressing button
* **Infusions (repeating)**
  * Pour water into brewing vessel, note amount of water used and start infusion timer
    * Add and (optional) remove the brewing vessel lid without influencing the timer 
    * ignore random weight fluctuations
    * When the whole brewing vessel is removed save timer duration without stopping timer
      * After the brewing Vessel is put back on the scale check if tea soup was poured out
      * If yes, end infusion timer, save infusion time, increase infusion counter by one
      * If no continue infusion timer
  * After infusion timer ends
    * start rest timer
    * save new 'wet' tea leaves weight
    * Add and (optional) remove the brewing vessel lid without influencing the timer
    * Add and (optional) remove the brewing vessel without influencing the timer
    * start next Infusion when new water is poured into brewing vessel, stop and save rest timer
* **End session**
  * End and save brewing session via button

### Session History

*   View a chronological list of all past brewing sessions.
*   Each entry should show the tea used, date, and number of infusions.
*   Tap a session to view a detailed log, including the duration of each infusion and any notes.

### Settings & Preferences

*   **Scale Configuration:**
    *   Set tare behavior.
    *   Adjust sensitivity for detecting pours (e.g., the minimum weight change to trigger an event).
    *   minEndInfusionWeight Set amount of weight reduction needed to trigger end of infusion 
*   **Timer Preferences:**
    *   Sound/vibration alerts.

## Future Features

For a comprehensive list of planned post-MVP features, see the following documents:

*   `docs/LONG_TERM_PLAN.md`: Describes long-term enhancements such as the Tea Library, advanced analytics, and multi-brew support.
*   `docs/USER_STORIES.md`: Contains detailed scenarios for both MVP and future features.

