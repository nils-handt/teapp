# Reactive mock-scale controls and resting timer tone

## Goal

Manual infusion controls are development aids. Show them only while mock-scale
mode is active, and make the primary timer visually subdued during the resting
phase.

## Design

`useScaleStore` will own an `isMockMode` boolean alongside its existing
connection state. `BluetoothScaleService.setMockMode()` will synchronise that
value after it switches active scale services. `SettingsScreen` and
`BrewingZen` will subscribe to the store rather than retaining independent,
non-reactive copies of the mode.

`BrewingZen` will render its manual Start/End Infusion actions only when the
reactive `isMockMode` value is true. This applies across Ready, Rest, Infusing,
and Pouring. End Session remains available in every mode.

The active timer's shared base class will no longer prescribe a text colour.
The phase-specific tone class will provide that colour, so Rest uses the muted
Zen rest colour rather than competing with the normal dark timer class.

## Testing

`BrewingZen` regression tests will cover hidden controls in real-scale mode,
visible controls in mock mode, and the concrete muted text class while resting.
Scale-store/service tests will cover mode synchronisation after switching.

## Scope

No brewing-state-machine behaviour, stored settings schema, or mock replay
behaviour changes are included.
