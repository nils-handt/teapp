# Acaia Scale Implementation (Deferred)

This directory is a placeholder for the Acaia scale implementation, which needs to be ported from the Beanconqueror project.

## Source

The original implementation can be found in the Beanconqueror repository:
[https://github.com/graphefruit/Beanconqueror/tree/master/src/classes/devices/acaia](https://github.com/graphefruit/Beanconqueror/tree/master/src/classes/devices/acaia)

## Complexity

The Acaia protocol is more complex than the Decent or Felicita protocols. The implementation consists of multiple files, including:
- Protocol parsers
- Constants for different models
- Separate classes for different Acaia models (Pearl, Pearl S, Lunar, Pyxis, etc.)

## Implementation Notes

Porting the Acaia implementation is deferred to a future task. When implemented, it should follow the same architectural patterns used for the other scales:
- Extend the `BluetoothScale` base class.
- Use the `BleAdapter` for all Bluetooth communications.
- Replace Angular's `EventEmitter` with RxJS `Subject` for event handling.
