# 3BLD technical research

## Design conclusions

- `cubing.js` is used for `333bf` random-state scrambles, algorithm parsing, 3×3 state transitions, and Twisty Player. The app applies the displayed algorithm to solved and traces that state.
- Memo tracing is sticker-oriented but marks physical pieces visited. The engine keeps raw targets distinct from visible tokens and execution-method settings. This avoids treating an M2 target-order transform as cube state.
- A cycle closes when tracing reaches the configured buffer piece. If unsolved pieces remain, tracing stops and exposes every sticker on the remaining unsolved pieces as an explicit cycle-break choice.
- Edge flips and corner twists are represented by cubing.js orbit orientation. Legal-state validation independently checks flip sum, twist sum, and matching permutation parity.
- Pair identity is a tuple of two physical sticker IDs. Display labels may be `A`, `CH`, `1`, or any other short token without creating concatenation collisions.

## References and licence notes

- [cubing.js scramble docs](https://js.cubing.net/cubing/scramble/) — `randomScrambleForEvent("333bf")`, `Alg`, and supported event semantics. The project is MPL-2.0; used as a library.
- [cubing.js repository](https://github.com/cubing/cubing.js) — KPuzzle orbit representation and Twisty Player. No source copied.
- [Stefan Pochmann’s M2/R2 guide](https://www.stefan-pochmann.info/spocc/blindsolving/M2R2/) — original M2 target conventions and worked examples.
- [Cubefreak M2 guide](https://cubefreak.net/bld/m2_guide.php) — cross-check for M2/Old Pochmann cycle behaviour and parity explanation.
- [SpeedSolving resources](https://www.speedsolving.com/pages/resources/) — directory of established blindsolving references and community terminology.
- [WCA Regulations](https://www.worldcubeassociation.org/regulations/) — competition BLD timing and scramble context. This app does not claim to be the official scramble program.

## Supported and deliberately separated

The current trace engine supports legal states, arbitrary sticker buffers, custom tokens, disjoint cycles, explicit cycle breaks, edge orientation, and corner orientation. Classic target-by-target M2 can optionally transform the user-facing execution targets while retaining the raw sticker trace unchanged. Odd M2 target counts are surfaced as a corner-method parity dependency rather than silently represented as a complete edge-only instruction. See [M2_EXECUTION_AUDIT.md](M2_EXECUTION_AUDIT.md) for the external rules and physical execution simulation.

The 3D renderer cannot safely accept arbitrary per-facelet text through the public Twisty Player API. V2 therefore retains the interactive colour cube and adds a labelled, scrambled 2D sticker map. Cycle breaks can be chosen on the map or in the accessible target list. Labels identify positions, not the travelling sticker's home token. A 3D text/click overlay remains unsupported rather than being guessed.

## V2 independently verified corrections

The V1 engine's passing tests did not cover cycle-entry targets. V2 records a selected cycle-break entry and its closure; an isolated flip/twist is represented by two oriented targets. The abstract buffer-swap simulator is not an execution algorithm and its intermediate states need not represent a legal standalone 3×3 operation.

- [J Perm's blindfold tutorial](https://jperm.net/bld) publishes scramble `B2 R2 B2 L U2 R' B2 R2 B2 R' U' B' F L' B D R B2 D B' D' U`. With UR buffer and the published break choices, the edge sequence is `QUSRNXIVPRDE`. This independently sourced regression passes, including the flipped edge.
- The cubing.js `3x3x3` SVG facelet IDs independently establish corner orbit order UFR, URB, UBL, ULF, DFR, DFL, DLB, DBR, and orientation faces URF, UBR, ULB, UFL, DFR, DLF, DBL, DRB. The previous metadata did not match. Speffz side-face corner order is corrected for new presets. Existing physical IDs and user labels are retained during migration; users may explicitly reapply Speffz if desired.
- 333bf wide-turn suffixes can rotate centres. State conversion now restores a centre-relative frame before tracing, then conjugates into the chosen memo orientation. The scramble itself is neither altered nor relabelled. Rotation-only, wide-turn legality/parity, and red-front R→F regression cases are covered.
- Method settings do not synthesize arbitrary execution algorithms, floating buffers, or a separate flip/twist phase. The verified M2 convenience applies only to the classic physical second-target convention; the raw trace remains authoritative.

No algorithms or source code were copied from csTimer or another BLD tool. The external example is a short factual regression fixture with attribution, not a republished tutorial.
