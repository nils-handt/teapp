# Teapp

Teapp is a scale-aware tea brewing tracker for short, repeated infusions such as gongfu brewing. It watches a Bluetooth scale during setup and brewing, reacts to weight changes, and keeps a history of your sessions without requiring you to operate a timer for every infusion.

> Teapp is under active development. Only BOOKOO scales are currently confirmed to work; see [Supported scales](#supported-scales) before relying on it for a brew.

## Open Teapp

Use the hosted app at [nils-handt.github.io/teapp](https://nils-handt.github.io/teapp/).

You can use Teapp in the browser or install it as a Progressive Web App (PWA). When installation is available, use **Settings → Install Teapp** or your browser's install/add-to-home-screen action.

Bluetooth scale integration currently works only in Chromium-based browsers that support Web Bluetooth. Teapp must remain in the foreground while it is communicating with a scale.

## What Teapp does

- Tracks the brewing vessel and the amount of tea used.
- Starts and stops an infusion timer when water is added to or poured out of the brewing vessel.
- Records infusion time and weight as part of the brewing session.
- Keeps a searchable, filterable session history with session details and statistics.
- Stores tea and brewing-vessel details for reuse in later sessions.
- Exports and restores local data as a JSON backup.

## Supported scales

**Confirmed:** BOOKOO scales are the only scales currently verified to work with Teapp.

The codebase contains integrations for several other Bluetooth scale protocols, but none of them has been verified with Teapp. They should be treated as experimental and may fail to connect, report incorrect data, or behave unexpectedly during a brew.

## Your first brew

1. Open **Settings** and choose **Connect New Scale**.
2. Select your BOOKOO scale and grant Bluetooth permission when prompted.
3. Open the **Brewing** tab and choose **Start Session**.
4. Follow the setup prompts: add the vessel, remove its lid, add the tea leaves, and confirm the setup.
5. Add water to start the infusion timer automatically.
6. Lift the vessel to pour. Returning it to the scale completes the infusion.
7. Continue with further infusions, then end the session to save it to **History**.

The first-run walkthrough is available again at any time from **Settings → Show Tutorial Again**.

## Data and backups

Teapp stores its data locally on your device or in your browser's site storage. It does not provide cloud synchronization.

Use **Settings → Data Management → Backup Data** to download or share a backup regularly. **Restore Data** replaces all current Teapp data with the selected backup and cannot be undone.

Browser users should create a backup before clearing site data, changing browsers, or moving to another device.

## Known limitations

- Only BOOKOO scales have been verified.
- Bluetooth behavior depends on the browser, operating system, permissions, and whether Teapp remains in the foreground.
- Waste water can currently be added only during the brewing phase.

## Feedback and development

Found a problem or have an idea? [Open an issue on GitHub](https://github.com/nils-handt/teapp/issues).

Developer setup, architecture notes, commands, and deployment details are in [DEVELOPMENT.md](DEVELOPMENT.md).
