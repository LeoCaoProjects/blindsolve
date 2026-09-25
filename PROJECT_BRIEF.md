# CubeIQ — Codex project brief

> A Rubik's Cube solve analytics engine whose defining challenge is recovering a speedcuber's actual solve from one ordinary camera, then explaining where time is lost. Optional timers and smart cubes can supply independent timing or move data; they must not be prerequisites for camera analysis.

## Source and intent

This brief migrated the [original Claude plan](CLAUDE_ORIGINAL.md) and the former [CubeIQ Notion project](https://app.notion.com/p/37a518ed0c75806d8963c81ea908893b) description into this workspace. The original Notion description was saved in [CUBEIQ_NOTION_BEFORE.md](notion_draft/CUBEIQ_NOTION_BEFORE.md), including its later csTimer, cubing.js, Bluetooth, licensing, and device-abstraction additions. The Notion project has since been overhauled into a short overview with four focused child pages and 16 linked execution tasks; its current priority is **Critical** and its status is **Planning**. This file and the current Notion pages are the working specifications for Codex. The Claude source is preserved for comparison.

The aim remains a portfolio-worthy product for speedcubers: generate a fair 3×3 scramble, record a solve, recover a move timeline where the evidence permits it, detect CFOP stages and cases, and give specific training insights across solves. The engineering depth is in cube mathematics, vision, constrained sequence inference, timing, and useful domain analytics. The product should earn trust by showing what it observed and what it inferred.

## Product behavior

1. Display a 3×3 scramble and its cube diagram. Record the intended scrambled state and the user's chosen color scheme and initial orientation when needed.
2. Let a cuber start and stop with a keyboard/touch timer, or optionally a supported Bluetooth timer. Record camera video during the solve.
3. Process video after the solve. Detect the cube, visible stickers and centers, hands/occlusion, motion intervals, and orientation changes. Infer plausible move sequences constrained by the scramble, video observations, and solved end state when verified.
4. Replay the video with a timestamped move timeline and a clear evidence label for each move or interval. Allow correction when the camera evidence is ambiguous.
5. For supported CFOP solves, report cross, F2L pair insertions, OLL, PLL, pauses, case recognition, turns per second, and trends. Hide or qualify metrics that depend on uncertain moves or timing.
6. Optional smart cubes can feed exact move events to the same analytics engine and serve as ground truth while developing camera reconstruction. Optional timers provide authoritative solve time when connected. Camera-only remains the main challenge and promise.

The original aspiration is one camera, no smart cube, no manual move entry, and no manual calibration. Treat those as **product goals**, not assumptions that the first version already meets. Passive color learning, lighting guidance, and an optional correction flow are appropriate if they improve accuracy. An assisted or manual-input prototype is an engineering milestone, not the final product claim.

## Feasibility assumptions to validate

- **Scramble anchor:** The generated sequence determines an exact mathematical state *if it was applied correctly*. The app should verify the starting state when video evidence allows and flag mismatches. It must not silently treat an incorrect physical scramble as ground truth.
- **Solved anchor:** A stopped timer does not prove the cube is solved. Verify the visible finish or use trusted smart-cube state. If verification is impossible, mark the endpoint as uncertain.
- **Centers and orientation:** Center colors identify faces, but one fixed camera can normally see only one to three centers at a time, never six simultaneously. Infer initial and later orientation from visible centers, geometry, temporal continuity, and the 24 possible cube orientations. Unseen rotations remain ambiguous.
- **Known states versus visible stickers:** A frame usually provides a *partial noisy observation*, not a complete `CubeState`. Preserve the observation and its confidence instead of writing it directly into a fully known state.
- **Post-processing:** Offline analysis removes a real-time deadline; it does not remove occlusion, blur, or information ambiguity. Two sequences can fit the same before/after states. A shortest path or Kociemba solution is not proof of what the human turned.

## Architecture

```text
scramble + intended state ────────────────┐
                                          ↓
camera video → cube/sticker observations → candidate move timeline
                     ↑          ↑              ↑
             motion intervals  orientation   cube-state constraints
                                          ↓
                          verified / inferred / ambiguous events
                                          ↓
                       CFOP stages, cases, timing, analytics
                                          ↓
                         replay, dashboard, solve trends

optional timer → normalized timing events ──┘
optional smart cube → normalized moves/state ─┘
```

Keep the camera observation model, mathematical cube state, orientation, timer events, and inferred moves separate. This prevents a low-confidence sticker or solver-generated path from becoming a falsely precise fact.

## Core subsystems

### Cube state and notation

Use a cubie representation for search and stage logic: corner permutation `cp[8]`, corner orientation `co[8]`, edge permutation `ep[12]`, and edge orientation `eo[12]`. Enforce legal-state constraints: corner twist sum mod 3, edge flip sum mod 2, and matching corner/edge permutation parity. Implement face turns, inverses, doubles, algorithm parsing, and state validation. Keep a 54-facelet view as an interchange and vision layer; it is useful for observed stickers and diagrams even though cubies are better for state search. Whole-cube rotations belong in a separate orientation transform, with a documented convention for how moves are relabeled.

Use compact, collision-free state keys. The original per-entry bit estimate is **100 bits**, so it cannot fit in one 64-bit integer. Two integers or a coordinate/rank encoding are suitable. Avoid promising that a generic hash lookup is always O(1) in measured performance.

Implement and test CFOP predicates relative to the solver's chosen cross color, not a permanently fixed white-cross convention. A cross requires its four edges in the correct positions and orientations; each F2L slot requires its corner and edge; OLL requires top-layer orientation *while F2L remains intact*; PLL completion requires the whole cube solved. Temporary solved pairs and stage backtracking need timeline rules, not a one-time Boolean latch.

### Scrambles

For an unofficial CubeIQ 3×3 session, use a documented random-state scramble generator such as `cubing.js` `randomScrambleForEvent("333")`, then **apply the displayed sequence to solved** to store its resulting state. A solver sequence from a sampled state back to solved would need inversion before displaying it as a scramble. WCA rules specify a random state and a standard starting orientation for scrambling, with exceptions for unusual color schemes; CubeIQ can follow those conventions without claiming to be the official competition scramble program. Store the event, sequence, diagram, orientation assumption, and intended state together.

### Recording and timing

Record video with presentation/capture timestamps and monotonic start/stop events. Map timer events onto the video timeline and retain synchronization uncertainty. The first and last captured frames may lag the timer; their timestamps are not automatically the exact solve time. A connected timer's result can be the official session time, while the video clock remains the move timing source after alignment. Persist replayable videos under a documented retention policy. Gracefully flag camera interruption, dropped frames, poor light, a moving camera, or a cube leaving the frame.

### Vision observations

Start with a camera-mounted, deliberate-move benchmark. Detect and track the cube and visible face grids, estimate each face's perspective, and sample sticker colors from safe interior regions. OpenCV contours and homographies are useful baselines, not universal cube detectors. Use temporal tracking and candidate geometries when hands, reflections, motion blur, or unusual backgrounds break a single contour. Adapt color prototypes from visible centers and the recording rather than relying on one global HSV threshold table. Preserve per-sticker probability/confidence and occlusion status.

Use frame difference or optical flow to propose *motion intervals*. Hand movement and cube reorientation also create motion, and multiple fast turns can merge into one interval. Classify candidate face turns versus rotations using center movement, visible sticker transitions, cube geometry, and state consistency. Sample stable frames before and after intervals plus periodic checkpoints; measure actual savings rather than claiming an 80% reduction. A single image can expose at most three faces (27 facelets) in favorable geometry, usually fewer because of hands and perspective.

Represent each observation as timestamp, visible facelet IDs, color probabilities, center evidence, pose/orientation candidates, geometry score, and occlusion score. The vision pipeline should never call a partial sticker read a fully observed cube state.

### Move inference and gaps

Maintain candidate states and move/orientation sequences through time. Score candidates against partial sticker observations, motion intervals, feasible turn rates, known or verified anchors, and notation constraints. A beam search or dynamic-programming prototype can retain several plausible paths; short fully known gaps can use bidirectional search. IDA* with admissible heuristics/pattern databases is a research option for bounded, fully specified transitions. For an arbitrary target state, heuristics must be derived for that target/relative state rather than blindly using solved-state lookup values.

Do not optimize only for shortest state path: speedcubers do nonminimal algorithms, regrips, rotations, cancellations, and pauses. Keep multiple candidates when evidence is tied. A Kociemba path can establish reachability or a useful upper bound, but it cannot be labeled as the user's actual algorithm. Apply a computational budget and return an unresolved interval when no supported path is found. Never fabricate move timestamps evenly across an occluded gap. If timing evidence brackets a move, store a time interval or distribution until the timestamp can be narrowed.

Separate confidence in **state**, **move identity**, and **move time**. Validate confidence on labeled videos, including ground-truth smart-cube recordings, and calibrate any quality score. The original fixed claims such as “85% is reliable,” “below 60% is poor,” or a 15-move solver threshold are hypotheses for experiments, not product facts.

### CFOP stages, OLL/PLL, and analytics

Given a sufficiently supported move/state timeline, identify the cross completion, each F2L pair insertion, OLL completion, and PLL completion. Treat AUF, rotations, skips, color neutrality, and non-CFOP solves explicitly. A pair can be solved during cross or later broken and restored; stage boundaries should reflect final completion and expose uncertainty. Do not assign all solves to CFOP by default.

Recognize OLL and PLL with canonical case patterns under U turns/AUF and cube orientation. OLL corners have three orientations, so a simple “four corner bits plus four edge bits” code is insufficient. PLL cases require top-layer permutation, not just an 8-bit orientation pattern. Build verified case fixtures and reference algorithms. Compare actual algorithms only when their move sequence is reliable; “optimal” should specify metric (face-turn count, fingertrick preference, execution time, etc.). Move count alone is not a universal best algorithm.

Report stage time, move count, average stage TPS (including pauses), and optional execution TPS over active turning intervals. Name them separately. A pause is a sufficiently long **stable no-turn interval**, with threshold tuned to the solver/video cadence. A between-pair delay is a useful lookahead proxy, not a pure measure of mental tracking; mid-algorithm gaps may be recognition, regrip, or video ambiguity. Label causal interpretations as suggestions, not observed facts.

Stage-specific efficiency needs a solver for that stage's goal set; standard Kociemba solves a complete cube and cannot directly give an optimal cross or one-pair target count. Initially report raw counts and case-specific comparisons. Add validated stage-target search later, with clear move metric and admissible bounds.

Across solves, show rolling stage averages, TPS, pauses, OLL/PLL frequency and recognition delays, F2L slot patterns, and reconstruction confidence. Recommend drills only from a sufficient number of *reliable* solves. Compare to external benchmark data only when its provenance, solve method, and timing definition are known. Avoid claiming a solver is “stuck on” an OLL/PLL distribution that random scrambles produce.

### Optional hardware and licensing context from Notion

The Notion project gives hardware support material importance, especially GAN and QiYi timers. Keep a normalized event layer so the analytics engine accepts camera, smart-cube, and timer inputs without manufacturer logic spreading through it:

```ts
type TimerState = "disconnected" | "idle" | "hands-on" | "ready" |
  "inspection" | "running" | "stopped";
type TimerResult = { timeMs: number; inspectionMs?: number;
  penalty?: "none" | "+2" | "DNF" };
interface TimerDevice {
  connect(): Promise<void>; disconnect(): Promise<void>;
  onStateChange(callback: (state: TimerState) => void): void;
  onResult(callback: (result: TimerResult) => void): void;
  getBatteryLevel?(): Promise<number | null>;
}
interface SmartCubeAdapter {
  connect(): Promise<void>; disconnect(): Promise<void>;
  onMove(callback: (event: { move: string; timestampMs: number }) => void): void;
  getPuzzleState?(): Promise<unknown>;
}
```

Normalize connection, disconnection, battery, timer state/result, and cube move events, with source, capture clock, and optional device clock. Keep penalties and inspection timing explicit. Candidate adapters in the Notion description include GAN Smart Timer, GAN Halo Smart Timer, QiYi `QY-Timer`, QiYi `QY-Adapter` plugged into a normal timer, Stackmat-style input, and supported GAN, QiYi, GiiKER, GoCube, MoYu, or Rubik's Connected smart cubes. Compatibility must be checked per model, firmware, browser, and operating system on real hardware. A Bluetooth debug report can include event type, time, browser/OS, and model but should avoid unnecessary device identifiers such as MAC addresses.

Prefer an appropriately licensed maintained library when it supports the exact device. The Notion page prefers `cubing.js` for scrambles, puzzle math, rendering, and supported smart cubes; its project documentation states MPL licensing for library use. `gan-web-bluetooth` is MIT-licensed and documents GAN Smart Timer, GAN Halo Smart Timer, and selected GAN cubes. `csTimer` is GPL-3.0; the Notion instruction is to study it as a technical reference but **not copy its source, Bluetooth drivers, scramblers, or drawing code into proprietary CubeIQ code**. Missing protocols, notably QiYi timer/adapter, should be independently implemented after understanding service/characteristic UUIDs, identification, packets, states, acknowledgments, checksums, encryption, and handshake as applicable. Recheck the current package license and exact supported devices before adding a dependency. These are project constraints, not a legal conclusion about every possible implementation.

Current `cubing.js` Bluetooth documentation says at least one version of several makers is supported, but compatibility varies; it currently lists MoYu without a move stream. Do not promise universal manufacturer support. Its smart-cube API and scramble API should be checked against the installed version before coding.

## Solve record

Use a schema that can store uncertainty instead of one `observed: boolean`:

```text
Solve {
  id, createdAt, puzzle="333", scramble, intendedStartState,
  startStateVerification, endStateVerification, crossColor,
  videoRef, timerSource, timerStartMs, timerStopMs, officialTimeMs,
  clockAlignment, analysisVersion,
  observations: [{timeMs, visibleFacelets, colorProbabilities,
                  orientationCandidates, occlusionScore}],
  events: [{kind: faceTurn|rotation|unknown, notationCandidates,
            earliestMs, latestMs, evidence: video|device|inference|correction,
            stateConfidence, moveConfidence, timeConfidence}],
  stageBoundaries: [{stage, earliestMs, latestMs, confidence}],
  cases: [{kind: OLL|PLL, candidateCases, confidence, algorithmCandidate}],
  metrics: [{name, value, unit, confidence, provenance}],
  pauses: [{earliestMs, latestMs, durationRangeMs, stageCandidate}],
  status: recorded|processing|analyzed|partial|failed,
  warnings: []
}
```

Store move/state fixtures and algorithms with versioning. Keep raw observations so a better reconstruction algorithm can reanalyze a solve without changing its video.

## Build order and proof points

1. **Math foundation:** Define orientation and notation conventions, cubie turns, legal states, facelet conversions, and CFOP predicates. Test inverse moves, four quarter-turn identities, random sequence round trips, legal-state invariants, and known CFOP fixtures.
2. **Scramble and event contract:** Generate a 3×3 random-state scramble through a supported library, apply it to solved, and store its state. Build normalized camera/timer/cube events. Prove the displayed diagram matches the computed state.
3. **Analytics on ground truth:** Feed labeled or smart-cube move timelines into stage, case, pause, TPS, and replay logic. Test actual CFOP solves, skips, rotations, AUF, inserted/broken pairs, and uncertain timestamps. Ship a useful results prototype before asking vision to supply moves.
4. **Camera data benchmark:** Collect consented slow, medium, and fast solves with exact move ground truth where possible. Include occlusion, rotation, varied lighting, dropped frames, and nonstandard color schemes. Record event-level precision/recall and sticker accuracy, not only a final solve success rate.
5. **Vision baseline:** Cube tracking, visible facelet/color probabilities, center and orientation candidates, motion intervals, and stable-frame selection. Review overlaid debug video. Validate each component against labeled frames.
6. **Constrained reconstruction:** Begin with deliberate, camera-visible moves. Add candidate search and partial-observation scoring; use bounded gap search only where it improves results. Compare recovered move identity and timing to ground truth and report ambiguity honestly.
7. **End-to-end camera solve:** Scramble → recording → evidence → moves → CFOP analysis → replay/dashboard. Define a measured acceptance threshold from the benchmark, then expand to faster solves and multi-solve trends.
8. **Optional hardware:** Wrap supported `cubing.js` smart cubes and `gan-web-bluetooth` GAN timers behind the interfaces. Add QiYi `QY-Timer`/`QY-Adapter` or other adapters only with independent implementation, exact-device testing, and verified licenses. Use smart-cube data to validate camera inference without making it required.

Large all-corner/all-edge pattern databases, “all known algorithms” databases, PostgreSQL, and hardware coverage for every listed maker are later investments. Build them when benchmark data demonstrates a need. A first local prototype can use React, Python/OpenCV, FastAPI, and local persistence; select PostgreSQL when multi-user/history needs justify it. Recharts or D3 can render the dashboard. This preserves the proposed stack while preventing speculative infrastructure from delaying the hard vision work.

## Decisions and honest limits

- Pick whether the first release is browser-only or desktop after testing camera capture, video timestamp quality, storage, and Web Bluetooth availability on target platforms.
- Pick a default cross/color-neutrality policy and describe supported solve methods. CFOP metrics require a compatible solve.
- Set retention/export/privacy behavior for video. Give the user control over saved recordings and analysis re-runs.
- Define accuracy and confidence thresholds from real labeled footage; the original sub-10/sub-15-second limits and confidence percentages are unverified.
- Treat unobserved face turns, rotations during occlusion, and multiple equally plausible paths as first-class unresolved outcomes. A partial analysis with honest bounds is useful; a fabricated complete move list is not.

## Reference sources checked during migration

- [CubeIQ Notion project](https://app.notion.com/p/37a518ed0c75806d8963c81ea908893b) — current overview and focused product, engineering, hardware, and decision pages. The former description is preserved in [CUBEIQ_NOTION_BEFORE.md](notion_draft/CUBEIQ_NOTION_BEFORE.md).
- [WCA Regulations, version April 2026](https://www.worldcubeassociation.org/regulations/) — scramble random-state and starting-orientation requirements; official competition scrambles need the official program.
- [`cubing.js` scramble documentation](https://js.cubing.net/cubing/scramble/) and [Bluetooth documentation](https://js.cubing.net/cubing/bluetooth/) — current API and compatibility claims.
- [`cubing.js` repository/licensing](https://github.com/cubing/cubing.js/), [`gan-web-bluetooth` repository](https://github.com/afedotov/gan-web-bluetooth), and [`csTimer` repository](https://github.com/cs0x7f/cstimer) — project-stated licenses and supported hardware.
