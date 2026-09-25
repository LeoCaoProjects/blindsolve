## The central problem
The scramble gives CubeIQ a strong mathematical constraint. The camera gives partial, noisy views of the cube over time. Reconstruction must find move and rotation sequences that agree with both, while respecting the motion seen in the recording. This is a sequence-inference problem, not just a shortest-path search between two fully known states.

A fixed camera usually sees one to three faces. Hands, blur, glare, and cube rotation reduce that further. The six centers keep their colors relative to the cube, but all six cannot be read in one ordinary frame. The system tracks visible centers and face geometry over time, considering the 24 cube orientations when necessary.

## Cube mathematics
Represent the searchable 3×3 state by corner permutation/orientation and edge permutation/orientation: `cp[8]`, `co[8]`, `ep[12]`, `eo[12]`. Facelets remain useful for diagrams and camera observations. Define the face-label and rotation convention before implementing moves. Validate corner-twist sum, edge-flip sum, and permutation parity; test inverse moves, four quarter turns, round trips, and known states.

Use state keys that cannot collide. The old draft's bit layout totals **100 bits**, not 64. Two integers or a ranked coordinate encoding can work. A state engine should answer CFOP questions relative to the chosen cross color: correct cross edges, inserted F2L slots, top-layer orientation while F2L is intact, and fully solved state. A pair may be solved, disturbed, and restored; the stage timeline has to reflect that.

For scrambles, use a fair random-state 3×3 generator such as `cubing.js` for unofficial sessions. Apply the *displayed* moves to solved and save the resulting state. If a sampled state was solved back to solved to produce a sequence, invert that sequence before calling it a scramble. Follow WCA starting-orientation rules when applicable without claiming CubeIQ's scrambles are the official competition program.

## Camera observations
Record capture timestamps and monotonic timer events separately, then align them. The first video frame may arrive after the timer begins; the last may arrive before it stops. Keep alignment error visible in the data.

For each useful frame, find and track the cube, estimate visible face grids, sample sticker interiors, classify colors with probabilities, and record visible centers and possible orientation. OpenCV contours, perspective transforms, HSV, frame difference, or optical flow are baseline tools. None is a guarantee under hands, odd backgrounds, reflections, or fast turns. Color prototypes can be learned from the recording rather than relying on fixed global HSV ranges.

Motion detection proposes **intervals** to inspect. A hand moving can trigger the detector; several quick turns can merge. Sample stable frames around intervals and regular checkpoints. Each observation keeps timestamp, visible facelet IDs, color confidence, center evidence, pose candidates, and occlusion score. It is a partial observation, not a full `CubeState`.

## Reconstruction
Keep several candidate cube states, orientations, and move sequences when the video permits more than one. Score candidates against sticker observations, motion timing, feasible turn rates, the intended/verified start state, and a verified finish. Use bounded search for short, fully known gaps. Bidirectional search and IDA* with admissible heuristics can help there; a solved-state pattern database must be adapted for an arbitrary gap target. A Kociemba path can show reachability but cannot prove which algorithm the cuber used.

Search needs a compute budget and an “unresolved” result. Human solves are not always minimal: algorithms, AUF, rotations, regrips, and cancellations all matter. When candidate sequences tie, preserve the ambiguity. If a turn happened somewhere in a gap, store a time range rather than inventing one timestamp.

## Case and metric logic
Recognize OLL and PLL from canonical last-layer patterns under U turns/AUF and orientation, with tested fixtures for cases and skips. OLL corner orientations require three values, not one bit each; PLL needs permutation information. Compare a user's algorithm to verified alternatives only when the sequence is supported by video or smart-cube events.

Average stage TPS is moves divided by full stage time, including pauses. Execution TPS is a different measure over active turning intervals. A between-pair gap may point to weak lookahead, but it can also include regrip or unclear video. Standard Kociemba solves the whole cube and does not directly calculate an optimal cross or single F2L pair; stage-specific optimal counts need their own goal search.

## Data and validation
Store video reference, scramble, intended and verified endpoint states, cross color, timer source, clock alignment, frame observations, move/rotation candidates, evidence source, stage boundaries, cases, pauses, metrics, warnings, and analysis version. Track state, move identity, and move-time confidence separately. Keep raw observations so improvements can reprocess old solves.

Build a labeled dataset with deliberate moves and complete solves. Include rotations, heavy occlusion, varied light, cube colors, camera angles, dropped frames, and fast solvers. A smart cube can provide move ground truth, but its clocks must also be aligned. Measure sticker accuracy, motion event precision/recall, rotation accuracy, move-sequence recovery, move-time error, stage-boundary error, and confidence calibration. Publish camera limits from those measurements; the prior “sub-10/sub-15 seconds” and fixed reliability percentages are untested assumptions.

