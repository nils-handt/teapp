# Teapp - Automatic Tea Brewing Tracker

Teapp is an Android application designed for tea enthusiasts to automatically track and log tea brewing sessions, with a focus on short, multiple infusions (like GongFu style). The app connects to a Bluetooth-enabled scale to monitor weight changes, allowing for hands-free logging of each infusion.

## Core Features

*   **Bluetooth Scale Integration:** Seamlessly connect to your Bluetooth scale for real-time weight monitoring.
*   **Automatic Infusion Tracking:** The app automatically detects weight changes to start and stop infusion timers.
*   **Session History:** Browse and review your past brewing sessions.

## Project Documentation

This project is described in more detail in the following documents:

*   **Requirements**:
    *   `docs/FEATURES.md`: A detailed list of planned application features.
    *   `docs/USER_STORIES.md`: Scenarios describing how a user will interact with the app.
*   **Architecture**:
    *   `docs/ARCHITECTURE.md`: An overview of the proposed technical architecture.
*   **Planning**:
    *   `docs/SHORT_TERM_PLAN.md`: MVP development roadmap and implementation phases.
    *   `docs/LONG_TERM_PLAN.md`: Post-MVP features and long-term enhancements.

## Bluetooth Scale Integration

The Bluetooth scale integration is built upon protocol implementations ported from the open-source [Beanconqueror](https://github.com/graphefruit/Beanconqueror) project. We extend our gratitude to the Beanconqueror team for their excellent work.

*   **Supported Scales:**
    *   Decent Scale
    *   Felicita Scale
    *   (Acaia scale support is planned, with the basic structure in place but implementation deferred).
*   **Architecture:**
    *   The core logic resides in `src/services/bluetooth/`.
    *   A base `BluetoothScale` class provides common functionality.
    *   Device-specific implementations (e.g., `DecentScale.ts`) extend the base class.
    *   The `BleAdapter` abstracts the `@capacitor-community/bluetooth-le` plugin, providing a consistent interface for the scale classes.
    *   The event system uses RxJS `Subject` for handling weight, timer, and flow events, adapted from Beanconqueror's original `EventEmitter` implementation.
*   **Development Notes:**
    *   To add a new scale, extend the `BluetoothScale` class and implement the device-specific BLE protocol.
    *   The `Logger` utility in `src/services/bluetooth/utils/` can be used for debugging.
    *   All code is written to be compliant with strict TypeScript rules.
