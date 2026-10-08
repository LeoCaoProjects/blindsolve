# M2 execution correctness audit

Audited 2026-10-08 against `cubing` 0.63.7.

## External rules used

- [Stefan Pochmann's original M2/R2 guide](https://www.stefan-pochmann.info/spocc/blindsolving/M2R2/) defines target-by-target M2 and its parity relationship.
- [Andy Klise's M2 / Old Pochmann guide](https://www.kungfoomanchu.com/guides/andy-klise-m2-oldpoch.pdf) supplies the target algorithms, the UF/DB and FU/BD exceptions, worked examples, and the combined parity case.
- [Cubefreak's M2 guide](https://www.cubefreak.net/bld/m2_guide.php) independently distinguishes the original target-by-target convention (which swaps the four M-slice targets in the second position) from its later direct-pair execution variant (which does not).
- [RubikCube.org's M2 algorithm reference](https://rubikcube.org/video-guides/m2-old-pochmann-blindfold-tutorial-part-3/) was used to cross-check the four special physical target algorithms.

For classic target-by-target M2 with the physical DF buffer, the second, fourth,
sixth, ... target uses the opposite physical M-slice sticker when applicable:
UF ↔ DB and FU ↔ BD. Counting is global across the complete edge trace; a cycle
break does not reset it. A final target is treated according to its actual global
position. Letter labels are looked up only after this physical mapping.

An odd number of M2 targets is not solved by target letters alone. It is the M2
parity case and must be joined to the chosen corner method/order. The tested
M2/Old Pochmann bridge has the physical effect of one edge transposition and one
corner transposition. BlindSolve now surfaces this fact as method metadata; it
does not insert an algorithm into the raw memo or mutate the cube trace.

## Pipeline audited

1. `cubing.js` applies the scramble and produces edge/corner permutation and orientation arrays.
2. `traceSection` swaps abstract buffer/target stickers in a cloned state. It records physical sticker IDs, tokens, and cycle-break markers separately.
3. Flipped edges remain real oriented cubies and are traced through the same physical cycle model.
4. Cycle-break choices add targets but never reset the global edge-target index.
5. `applyM2SecondTargetSwap` copies the trace and maps only eligible even-numbered physical edge targets.
6. The mapped physical sticker is resolved through the active lettering scheme, including arbitrary multi-character tokens.
7. Presentation groups the resulting tokens. Persisted reconstruction retains raw sticker IDs separately from displayed tokens.

The Magic training adapter uses the same exported physical face-pair mapping as
the typed domain engine. Its facelet IDs are adapted only at the boundary.

## Independent physical simulation

`src/domain/bld/m2ExecutionAudit.test.ts` contains target algorithms transcribed
from the external references rather than derived from BlindSolve's transform. For
each state it:

1. traces BlindSolve's raw physical edge targets;
2. independently calculates the target-by-target M2 interpretation;
3. checks auto-swap IDs and custom tokens against that interpretation;
4. executes every real target algorithm on the `cubing.js` `KPattern`;
5. executes the documented combined M2/Old Pochmann parity bridge for odd target counts;
6. requires the physical edge permutation and orientation to be solved.

The deterministic sample contains 1,000 legal full states and 250 legal
edges-only states. All 1,250 solved. Coverage included 155 states with no cycle
break, 427 with one, 668 with multiple, 7,488 flipped edge positions, 503 odd
target counts, 747 even target counts, and every UF/DB/FU/BD sticker in both odd
and even target positions. A separate legal two-in-place-flipped-edges fixture
also solved. A literally isolated single flipped edge cannot exist in a legal
3×3 state because total edge orientation must be even.

## Scope and method caveats

- The verified swap convention is the classic one-target-at-a-time M2 method. A direct pair/commutator M2 variant must leave the convenience toggle off.
- The verified physical frame uses the standard DF M2 buffer. Custom sticker labels and cube-view orientation do not change physical identities.
- `Solve within cycles` is what the current trace engine executes and what this audit verifies. A distinct, separately executed edge-orientation memo is a different convention and must not be inferred from these targets.
- The raw target trace, cube state, cycle structure, and saved raw sticker identity are unchanged by M2 presentation settings.

## Regression examples

The three fixed scrambles, raw targets, substitutions, displayed tokens, and
physical solve assertions live inline in the audit test so future changes cannot
silently alter them. One example has no parity, one has M2/Old Pochmann parity,
and all special substitutions are exercised across the deterministic sample.
