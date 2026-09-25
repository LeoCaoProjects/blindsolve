## Why hardware belongs here
CubeIQ should work with one camera and an ordinary cube. Bluetooth devices are optional: a smart cube supplies exact moves for an owner who has one, and timer hardware supplies timing. During development, smart-cube move streams make it possible to measure how often the camera actually reconstructs a solve correctly.

Hardware-specific code should stop at an adapter boundary. The rest of the app receives common events for timer state/result, cube move, battery, connection, and disconnection, each with a source and timestamp. Timer results can include inspection time and `none`, `+2`, or `DNF` penalties. Device and video clocks must be aligned before combining their events.

## Candidate devices
The existing project description calls out GAN Smart Timer and GAN Halo Smart Timer; QiYi `QY-Timer`; QiYi `QY-Adapter` plugged into a normal QiYi timer; Stackmat-style timer input; and smart cubes from GAN, QiYi, GiiKER, GoCube, MoYu, and Rubik's Connected, among others. This is a candidate list, not a support promise. Check exact model, firmware, browser, operating system, and real-device behavior before listing a device as compatible. In particular, current `cubing.js` documentation does not promise a move stream for every MoYu model.

The first adapters should wrap maintained libraries for devices they actually support. Add QiYi timer/adapter or missing protocols later, with independent code and hardware testing. A Bluetooth debug report should capture useful state changes and errors while avoiding unnecessary personal/device identifiers such as MAC addresses.

## Library rules
**`cubing.js`:** preferred for scramble generation, notation, puzzle math/diagrams, rendering, and supported smart puzzles. The project documents MPL use for applications. Check the installed version's APIs, license, and device compatibility before relying on a sample import.

**`gan-web-bluetooth`:** MIT-licensed library documenting GAN Smart Timer, GAN Halo Smart Timer, and selected GAN smart cubes. Check the model list and its dependencies when integrating it.

**`csTimer`:** GPL-3.0. It can inform research into hardware behavior, but the project rule is **not to copy its source, scramblers, drawing code, or Bluetooth drivers into proprietary CubeIQ code**. Do not lightly rewrite `qiyitimer.js`. Independently implement any missing protocol from technical behavior and original tests. Record the library/license decision when each dependency is added.

For QiYi timer work, the investigation may involve device names, Bluetooth service and characteristic UUIDs, manufacturer data, packet fields, command IDs, timer states/results, sequence numbers, acknowledgements, checksums, encryption, and handshake. Which of these apply must be verified on the exact device. Real hardware tests matter because makers can change protocols and firmware.

## Adapter contract
The timer side needs connect/disconnect, state-change events, result events, and optional battery level. The smart-cube side needs connect/disconnect, timestamped move events, and optional puzzle state/battery. A device manager converts both into normalized internal events. The analytics pipeline consumes those events without knowing whether they came from GAN, QiYi, another maker, or a camera reconstruction.

Sources: [`cubing.js` scramble](https://js.cubing.net/cubing/scramble/) and [Bluetooth](https://js.cubing.net/cubing/bluetooth/) documentation; [`cubing.js` repository](https://github.com/cubing/cubing.js/); [`gan-web-bluetooth` repository](https://github.com/afedotov/gan-web-bluetooth); [`csTimer` repository](https://github.com/cs0x7f/cstimer).

