# Blindsolving model

`web/src/domain/bld` implements state validation and sticker tracing. The workspace adapters translate that model into Timer reconstruction and Training. `cubing.js` supplies `333bf` random-state scrambles, algorithm parsing and cube-state transitions; the interface uses the application's own `Cube3D` and `SchemeCube` components.

## State and memo

- Apply the displayed scramble to solved, restore a centre-relative frame, and transform into the selected memo orientation. Wide-turn suffixes can rotate centres; the displayed scramble itself is not rewritten.
- Trace sticker targets while tracking visited physical pieces. Keep raw targets, displayed tokens and execution-method settings separate.
- Close a cycle at the configured buffer piece. If unsolved pieces remain, expose their stickers as explicit cycle-break choices. Record both the selected entry and its closure.
- Validate edge-flip sum, corner-twist sum and matching permutation parity independently. An isolated flip or twist contributes two oriented targets.
- Use physical sticker IDs for pair identity. Short labels such as `A`, `CH` or `1` are display tokens, not concatenated storage keys.

The workspace renders labelled, selectable cube views. Camera orientation and the fixed scramble colour reference are separate from the user's lettering and physical buffers.

Classic M2 can transform user-facing execution targets without mutating the raw trace. Odd target counts remain separate parity metadata. See [M2 execution](m2-execution.md) for conventions and physical simulation. The abstract buffer-swap simulator is a tracing check, not an execution algorithm; its intermediate states need not be legal standalone cube positions.

## Regression references

- [cubing.js](https://github.com/cubing/cubing.js) provides the KPuzzle orbit model and [scramble API](https://js.cubing.net/cubing/scramble/). Its 3x3x3 SVG identifiers independently establish corner order and orientation. The library is unmodified; see the third-party notices for licensing.
- [J Perm's tutorial](https://jperm.net/bld) supplies the attributed scramble fixture `B2 R2 B2 L U2 R' B2 R2 B2 R' U' B' F L' B D R B2 D B' D' U`. With UR buffer and the published cycle breaks, the edge trace is `QUSRNXIVPRDE`, including the flipped edge.
- [Stefan Pochmann's M2/R2 guide](https://www.stefan-pochmann.info/spocc/blindsolving/M2R2/) and the [Cubefreak M2 guide](https://cubefreak.net/bld/m2_guide.php) document target conventions and parity.

Tests cover cycle entry/closure, orientation-only cases, wide-turn legality, memo orientation and the attributed fixture. Historical physical IDs and user labels remain migration inputs; users can explicitly reapply Speffz. Method settings do not synthesize arbitrary execution algorithms or floating buffers. BlindSolve does not claim to be the official WCA scramble program.
