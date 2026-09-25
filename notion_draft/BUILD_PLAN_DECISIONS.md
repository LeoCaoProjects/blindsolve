## Build order
1. **Cube engine.** Fix notation/orientation conventions, implement legal cubie states and turns, facelet conversion, scramble application, and CFOP predicates. Prove invariants and round trips with known cases.
2. **Analytics on known moves.** Feed labeled or smart-cube timelines through stage detection, OLL/PLL recognition, pauses, TPS, replay, and result storage. Handle rotations, AUF, skips, pair breaks, and uncertain timestamps before using video-derived moves.
3. **Labeled video benchmark.** Record slow deliberate moves, then complete solves at several speeds with ground-truth sequences. Include hands, rotations, different light, and camera faults. Define measurements and review overlays.
4. **Vision baseline.** Track cube faces and centers, sample color probabilities, find motion intervals, and record partial observations. Measure each component against labeled frames.
5. **Candidate reconstruction.** Combine observations with state constraints and motion timing. Begin with fully visible deliberate moves; add bounded gap search and multi-candidate inference as evidence requires. Measure move and timing recovery against ground truth.
6. **Camera-only product.** Join scramble, recording, reconstruction, replay, CFOP analytics, and solve history. Ship only with measured confidence behavior: uncertain moves and metrics must be visibly qualified.
7. **Trends and optional hardware.** Add recommendations from enough reliable solves. Wrap verified smart cubes and timers behind common interfaces. Test each advertised device on real hardware.

The proposed stack is React for the interface, Python/OpenCV for video work, Python cube logic/search, FastAPI for the API, and Recharts or D3 for graphs. Local persistence is enough for an early prototype; PostgreSQL becomes useful when history, accounts, or multi-user use warrant it. Large pattern databases and exhaustive algorithm collections should follow a measured need rather than lead the build.

## Gates before a camera claim
- A displayed scramble and diagram produce the same computed state.
- The stage/case engine agrees with known CFOP solve fixtures, including skips and pair breaks.
- Labeled video reports separate accuracy for stickers, motion intervals, rotations, move identity, and move time.
- Confidence scores are calibrated: high-confidence events are actually more accurate than low-confidence ones.
- A full solve result never quietly replaces missing camera evidence with a solver path.
- The app can return a useful partial result after occlusion, dropped frames, or an unverified start/end.
- Device claims name tested models and firmware rather than only manufacturers.

## Decisions already made
- 3×3 and CFOP are the first analytics target; cross color is configurable or inferred rather than fixed to white.
- Camera-only analysis is the defining goal. Smart cubes and timers are optional modes and validation tools.
- Processing happens after the solve. Video and raw observations remain available for replay and reanalysis, subject to a retention decision.
- Uncertain events remain uncertain. Search can suggest a path, not certify a human sequence.
- `cubing.js` and `gan-web-bluetooth` are preferred candidates where their current license and device support fit. Proprietary CubeIQ code does not copy csTimer GPL source.

## Decisions needed before dependent work
- [ ] **First platform:** Browser, desktop, or both? Test camera timestamps, saved-video behavior, and Web Bluetooth on the intended devices before choosing.
- [ ] **Camera target:** Which mounts, frame rates, resolution, lighting range, and solve speeds define the first supported setup?
- [ ] **Color/setup flow:** How should unusual color schemes and an incorrect scramble be handled without making setup cumbersome?
- [ ] **Solve method:** What happens when a solve is color-neutral, non-CFOP, or only partly follows CFOP?
- [ ] **Confidence policy:** What measured error rate allows a move, case, or training suggestion to be shown as reliable?
- [ ] **Video retention:** How long are recordings kept, and how can users export, delete, or reanalyze them?
- [ ] **First hardware:** Which exact timer and cube models are available for development and real-device compatibility tests?
- [ ] **Algorithm comparisons:** Which move metric and verified reference algorithms should the first release use?

The original plan's precise claims about sub-10/sub-15-second degradation, 80% frame savings, and fixed reconstruction-quality bands are research hypotheses. Set limits after collecting data.

