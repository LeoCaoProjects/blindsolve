
<empty-block/>
# CubeIQ — Rubik’s Cube Analytics Engine
> A computer vision powered solve analyzer that reconstructs every move from a single camera, breaks your solve into stages, and tells you exactly where you’re losing time.
---
## What Is This Project
A web or desktop application where a speedcuber generates a scramble, solves their cube in front of one camera, and after the solve receives a complete breakdown of every move they made, which stage each move belonged to, where they paused, how efficient their F2L was, which OLL/PLL case occurred, and whether they used the optimal algorithm for it.
No smart cube required. No manual input. No calibration. One camera.
This is not a timer app with some stats bolted on. The core engineering challenge is reconstructing a complete solve from video — computer vision, graph search, cube state analysis, and a domain-specific analytics engine all working together.
---
## Why It’s Impressive
- Solves a real problem for a real community (speedcubers)
- Novel combination of computer vision + combinatorial search
- Personal domain expertise — you’re a speedcuber building this for speedcubers
- Nobody has built this properly
- The technical depth hits every dimension FAANG cares about: algorithms, systems design, vision, data
---
## The Key Insights That Make It Feasible
**Insight 1 — Known initial state:**<br>The user follows a generated scramble. The app always knows the exact cube state after the scramble is applied mathematically. You are not doing blind cube state reading from scratch. You have a guaranteed anchor at the start and a guaranteed anchor at the end (solved state). Reconstruction fills in the middle.
**Insight 2 — Centers never move:**<br>On a Rubik’s cube, the center piece of each face never changes position relative to that face. White center always means white face. So the app reads the 6 center colors once early in the video to establish which face is which, then uses that mapping for the entire solve. No calibration step, no user input required.
**Insight 3 — Standard orientation:**<br>Every WCA scramble assumes white top, green front. The app generates scrambles in this orientation. If the user rotates the whole cube before solving (which speedcubers do for cross efficiency), that is just a tracked x/y/z rotation — the cube state hasn’t changed, just the physical orientation. The face-label mapping updates accordingly.
**Insight 4 — Post-processing not real time:**<br>Nothing is processed during the solve. The camera records raw video. After the user stops the timer, the entire pipeline runs on the saved video. This removes the real-time constraint entirely and makes every hard problem tractable.
---
## System Architecture Overview
```plain text
[Scramble Generator]
        |
        v
[Cube State Engine] ──── computes and stores initial cube state
        |
        v
[Camera Records Raw Video]
        |
        v
[Frame Sampler] ──── extracts frames at intervals, flags occluded frames
        |
        v
[Move Detector] ──── detects when moves happen via frame differencing
        |
        v
[Orientation Tracker] ──── tracks which face is which using center colors + cube geometry
        |
        v
[Color Reader] ──── reads sticker colors on visible faces, updates cube state
        |
        v
[State Snapshots Timeline] ──── timestamped sequence of known cube states
        |
        v
[Gap Reconstructor — IDA* / Bidirectional BFS] ──── fills unknown segments
        |
        v
[Complete Move Sequence with Timestamps]
        |
        v
[Stage Detector] ──── labels every move as cross / f2l / oll / pll
        |
        v
[OLL/PLL Recognizer] ──── identifies cases, compares algorithms used
        |
        v
[Analytics Engine] ──── pauses, lookahead, efficiency, TPS per stage
        |
        v
[Dashboard + Multi-Solve Trends]
```
---
## Component Breakdown
---
### 1. Cube State Engine
This is the foundation everything else is built on. Must be implemented first. It is pure logic — no vision, no UI — and must be rock solid before anything else is written.
**What it does:**<br>Represents a Rubik’s cube state in memory and can apply any move to it, returning a new state. Also detects whether any given condition is true (cross solved, F2L pair inserted, OLL done, fully solved).
**State representation:**<br>Do NOT use a 54-element sticker array. It is large, slow to compare, and awkward to manipulate. Use piece-permutation + orientation encoding instead.
A cube has 20 movable pieces: 8 corners and 12 edges. Each piece has a position (where it is) and an orientation (which way it is twisted). Represent the full cube state as four arrays:
```plain text
CubeState {
  cp: [8 integers]   // corner permutation — which corner is in each slot (0-7)
  co: [8 integers]   // corner orientation — how each corner is twisted (0, 1, or 2)
  ep: [12 integers]  // edge permutation — which edge is in each slot (0-11)
  eo: [12 integers]  // edge orientation — whether each edge is flipped (0 or 1)
}
```
Corner orientations are 0, 1, 2 (three possible twists). Edge orientations are 0 or 1 (flipped or not). This encoding is compact, fast to compare, and directly maps to how Kociemba and Korf’s solvers work internally.
**Move application:**<br>For each of the 18 moves (U, U’, U2, D, D’, D2, F, F’, F2, B, B’, B2, R, R’, R2, L, L’, L2), hardcode the permutation tables — which pieces go where and how their orientation changes. These tables are fixed and well documented online. Applying a move is just array index remapping — very fast.
**Whole cube rotations (x, y, z):**<br>These are not moves — they do not change the cube state. They only change which face label maps to which physical direction. Track the current orientation as a separate variable. When an x, y, or z rotation is detected, update the face-label mapping without touching the cube state.
**Stage detection conditions:**
- **Cross done:** The 4 bottom-layer edge pieces (DF, DB, DL, DR) are in their correct slots with correct orientation
- **F2L pair N done:** The Nth corner and its corresponding edge are both in the correct first-two-layer slot with correct orientation. There are 4 pairs, numbered by their position (FR, FL, BR, BL)
- **OLL done:** All 8 corner orientations and all 4 top-layer edge orientations are 0 (all top stickers face up)
- **PLL done / Solved:** All cp, co, ep, eo arrays match the solved state
**To encode the state as a single integer for BFS:**<br>Convert the four arrays to a single 64-bit integer using bit packing. This makes hash set lookups O(1) which is critical for BFS performance. Corner permutation needs 3 bits per piece × 8 = 24 bits. Corner orientation needs 2 bits × 8 = 16 bits. Edge permutation needs 4 bits × 12 = 48 bits. Edge orientation needs 1 bit × 12 = 12 bits. Total fits in a 64-bit integer or two combined.
---
### 2. Scramble Generator
Generate WCA-compliant random state scrambles. A proper WCA scramble is not just random moves — it is a random cube state expressed as a move sequence. The distinction matters: pure random moves tend to cluster near solved states.
**Implementation:**
1. Generate a random valid cube state (random permutations with correct parity)
2. Run Kociemba on it to get the move sequence that reaches that state from solved
3. That sequence, applied to a solved cube, gives you the scrambled state
4. Store the resulting cube state — this is your known initial state
**Output:** A move sequence string (e.g. `R U R' F2 L D' B2 U2 R' F`) and the corresponding CubeState object.
**Standard orientation:** All scrambles assume white face up, green face front. The user holds the cube in this orientation when applying the scramble.
---
### 3. Video Recording
The user sees a timer on screen. They press space (or tap) to start — this is when recording begins. They solve. They press space again to stop — recording ends.
**Timer:** Derived from video frame timestamps, not a system clock. The first frame after start is t=0. The last frame after stop is the final time. This guarantees the time is exactly synchronized with the video.
**Storage:** Save video locally in a temp directory. After processing, keep the video linked to the solve record so the user can replay it. Do not stream or process in real time.
**Camera requirements to document for users:** Stable mount or stand recommended. Decent lighting. Cube visible in center of frame throughout solve. These are guidelines, not hard requirements — the system should degrade gracefully, not crash.
---
### 4. Move Detector
Before doing any expensive color reading or orientation tracking, detect exactly when moves are happening in the video. This massively reduces the number of frames that need full processing.
**How it works — frame differencing:**<br>Compare consecutive frames by computing the per-pixel absolute difference across the cube region. When a face turn is happening, a large region of pixels changes rapidly. When the cube is stationary between moves, pixel difference is near zero (small noise from camera).
**Algorithm:**
1. Extract the cube bounding region from each frame
2. Convert to grayscale
3. Compute absolute pixel difference between frame N and frame N+1
4. Sum all differences — this is the motion score
5. If motion score exceeds threshold T → a move is in progress
6. When motion score drops back below T → move has completed
7. Sample the frame just before motion started (pre-move state) and just after motion ended (post-move state)
**Why this is important:** You are not sampling every frame. You are only sampling frames that bracket actual moves. This gives you cleaner before/after state pairs and reduces total frames processed by 80%+.
**Threshold T:** Tune empirically. Start with 2% of total cube region pixels changing. Too low = noise triggers it. Too high = misses slow moves.
---
### 5. Orientation Tracker
At any point during the solve you need to know which physical face of the cube corresponds to which label (U, D, F, B, L, R). This changes whenever the solver does a whole-cube rotation (x, y, z moves).
**Initial orientation from center colors:**<br>Early in the video, before the solve begins, read the 6 center sticker colors from the visible faces. Since the scramble was applied in white-top green-front orientation, you know:
- White center = U face
- Yellow center = D face
- Green center = F face
- Blue center = B face
- Red center = R face
- Orange center = L face
Map HSV color ranges to these labels. This mapping is stored as the current orientation model.
**Detecting whole-cube rotations vs face turns:**<br>A face turn moves the 8 stickers around one face but centers stay in place. A whole-cube rotation moves everything including centers.
Detection: after a motion event, check whether the center colors on visible faces have changed position. If centers moved — whole cube rotation. If centers stayed — face turn. Update the orientation model accordingly.
**Tracking orientation across occluded frames:**<br>If hands cover the cube and you cannot see centers, maintain the last known orientation. When the cube reappears, verify centers match expected positions. If they do not match, a whole-cube rotation happened during occlusion — determine which one by comparing the new center layout to all 24 possible cube orientations and pick the closest match.
---
### 6. Color Reader
Given a frame with known orientation, read the sticker colors on the visible faces to determine the current cube state.
**Faces visible at any time:** At most 3 faces are visible from a single camera at once. You get 27 stickers maximum per frame. Combined with the known initial state and IDA\* gap filling, this is sufficient.
**Step by step:**
1. **Find the cube in the frame:** Use contour detection (OpenCV findContours) to find the largest roughly-square region in the frame. This is the cube face closest to camera. From its position and the known orientation, compute where the other visible faces should be.
2. **Perspective correction:** The cube faces will appear as trapezoids due to perspective. Apply a homography transform (OpenCV getPerspectiveTransform + warpPerspective) to flatten each face into a perfect 3×3 grid of squares. This corrects for camera angle.
3. **Sample sticker colors:** Divide the flattened face into a 3×3 grid. Sample a small central region of each cell (not just one pixel — average a 5×5 patch to reduce noise). Convert the sampled color from BGR to HSV.
4. **Color classification:** Define HSV ranges for each of the 6 cube colors. These ranges are determined empirically for standard WCA color schemes:
- White: H any, S \< 50, V \> 200
- Yellow: H 20-35, S \> 100, V \> 150
- Red: H 0-10 or 170-180, S \> 150, V \> 100
- Orange: H 10-20, S \> 150, V \> 100
- Blue: H 100-130, S \> 100, V \> 80
- Green: H 55-85, S \> 100, V \> 80
	These ranges will need tuning. Build a debug mode that shows you the HSV values it reads so you can adjust ranges.
1. **Update cube state:** For each sticker whose color you read, update the corresponding position in the cube state model. Since you know the current orientation (which face is which), you know exactly which piece each sticker belongs to.
**Confidence scoring:** If a sampled color falls near the boundary between two HSV ranges, flag it as low confidence. Low confidence sticker readings are not written to the state — they are left for BFS reconstruction instead.
---
### 7. State Snapshots Timeline
The output of the vision pipeline is a chronological list of timestamped cube state snapshots:
```plain text
t=0.000s  → KNOWN state (scrambled state from scramble generator)
t=0.412s  → OBSERVED state (from color reader after move 1 completed)
t=0.798s  → OBSERVED state (after move 2)
t=1.103s  → OCCLUDED (hands covering — skipped, flagged for BFS)
t=1.103s  → OCCLUDED
t=1.440s  → OBSERVED state (hands cleared)
t=2.190s  → OBSERVED state
...
t=9.340s  → KNOWN state (fully solved — always certain)
```
Every gap between two consecutive snapshots is a segment that needs move sequence reconstruction. The size of the gap (in time) tells you approximately how many moves happened. Short gaps need shallow BFS. Long occluded gaps need IDA\*.
---
### 8. Gap Reconstructor — IDA\* with Pattern Database Heuristics
This is the most technically impressive component. Given two cube states A and B, find the sequence of moves that transforms A into B.
**Why not plain BFS:**<br>BFS explores all states at depth 1, then depth 2, etc. With 18 possible moves at each step, depth 10 has 18\^10 ≈ 3.5 trillion nodes. Memory explodes. Infeasible for gaps larger than \~6 moves.
**Why not bidirectional BFS for large gaps:**<br>Bidirectional BFS is good for medium gaps (up to \~10 moves) because it halves the effective depth, but still uses exponential memory for deep searches.
*The right tool — IDA (Iterative Deepening A*):\*\*<br>IDA\* combines the memory efficiency of depth-first search with the optimality guarantees of BFS. It uses a heuristic function h(state) that estimates the minimum number of moves needed to reach the target state. If h is admissible (never overestimates), IDA\* finds the optimal path.
*IDA algorithm:*\*
```plain text
function ida_star(start, target):
    threshold = h(start, target)
    path = [start]
    while True:
        result = search(path, 0, threshold, target)
        if result == FOUND: return path
        threshold = result  // next iteration uses the minimum exceeded value

function search(path, cost, threshold, target):
    current = path.last
    f = cost + h(current, target)
    if f > threshold: return f
    if current == target: return FOUND
    minimum = infinity
    for each move M in ALL_18_MOVES:
        next_state = apply(current, M)
        if next_state not in path:  // avoid cycles
            path.push(next_state)
            result = search(path, cost+1, threshold, target)
            if result == FOUND: return FOUND
            minimum = min(minimum, result)
            path.pop()
    return minimum
```
**The heuristic function h(state, target):**<br>This is what makes IDA\* fast. A good heuristic prunes massive branches of the search tree. The best heuristic for this problem uses pattern databases.
**Pattern databases:**<br>Precompute and store the minimum number of moves needed to solve specific subsets of pieces. For example: “corner pattern database” stores the minimum moves to correctly place all 8 corners from any configuration. There are 8! × 3\^7 = 88 million corner states — precompute all of them with BFS from the solved state and store in a lookup table.
At search time, h(state) = max(corner_db\[state.corners\], edge_db\[state.edges\]). This is always admissible (never overestimates) because solving corners alone takes at least that many moves.
**Bounding the search with time gap:**<br>Before running IDA\*, estimate the maximum plausible moves in the gap: gap_seconds × user_avg_TPS × 1.5 (safety margin). Cap the IDA\* search depth at this value. This prevents runaway searches on long occlusion gaps.
**Fallback for very large gaps:**<br>If the gap exceeds \~15 moves, IDA\* becomes slow even with good heuristics. Fall back to Kociemba’s two-phase algorithm. This finds a solution in under 20 moves very fast, but it will not match the user’s actual move sequence. Flag this segment in the output as “reconstructed — sequence may differ from actual.”
**Reconstruction quality score:**<br>Track what percentage of the final move sequence was directly observed from video vs BFS/Kociemba reconstructed. Show this per solve. A score of 85%+ means the analytics are highly reliable. Below 60% means the video quality was poor.
---
### 9. Stage Detector
Given the complete move sequence with timestamps, label every move with its stage. This is pure cube state logic — run through the move sequence applying each move to the cube state and check stage conditions after each one.
**Detection logic:**
**Cross:** Check after every move whether the 4 bottom edges (DF, DB, DL, DR positions in the ep array) are in their home slots with correct orientation (eo = 0 for those 4 edges). When all 4 conditions are true simultaneously — cross is done. Timestamp that move as end of cross stage.
**F2L pairs:** After cross is done, check after every move whether each of the 4 corner-edge pairs is correctly inserted. A pair is inserted when: its corner piece is in the correct slot with co = 0, AND its corresponding edge piece is in the correct slot with eo = 0. Track which pairs were already inserted before this solve (they might be inserted in any order). When a new pair becomes inserted, that move ends that pair’s F2L stage.
**OLL:** After all 4 F2L pairs are inserted, check after every move whether all top-layer pieces are oriented correctly. Condition: all 4 top edges have eo = 0 AND all 4 top corners have co = 0. When true — OLL is done.
**PLL:** After OLL is done, check after every move whether the cube is fully solved (all cp, co, ep, eo match solved state). When true — PLL is done and solve is complete.
**Edge case — pairs inserted during cross:**<br>Sometimes a solver inserts F2L pairs while solving the cross. Handle this: after the cross is done, check which pairs are already inserted and mark them as done with a zero F2L time.
---
### 10. OLL / PLL Recognition
**OLL recognition:**<br>After F2L is complete, read the orientation of the top layer pieces from the cube state. The pattern of which top corners and edges are oriented or not defines the OLL case. There are 57 OLL cases (plus the skip — already oriented).
Build a lookup table: map each unique top-layer orientation pattern to an OLL case number. The pattern can be encoded as an 8-bit integer: 4 bits for corner orientations + 4 bits for edge orientations. Index directly into the lookup table — O(1) recognition.
**PLL recognition:**<br>After OLL is done, read the permutation of the top layer pieces. There are 21 PLL cases (plus the skip). Build a similar lookup table mapping each unique top-layer permutation pattern to a PLL case name (T-perm, U-perm, etc.).
**Algorithm comparison database:**<br>Store a JSON file with every OLL and PLL case containing:
```json
{
  "T-perm": {
    "moveCount": 14,
    "algorithms": [
      { "name": "standard", "moves": "R U R' U' R' F R2 U' R' U' R U R' F'", "moveCount": 14 },
      { "name": "alternate", "moves": "...", "moveCount": 14 }
    ]
  }
}
```
After identifying the PLL case, compare the move sequence the user actually executed (from the reconstructed solve) against the known algorithms using move sequence similarity. Flag if the user used a suboptimal move count.
---
### 11. Pause Detection
Between every two consecutive moves in the reconstructed move sequence, you have a time gap. Most gaps are very short (\< 0.1 seconds for a fast solver). Gaps above a threshold are pauses.
**Implementation:**
```plain text
for each consecutive move pair (move_i, move_i+1):
    gap = move_i+1.timestamp - move_i.timestamp
    if gap > PAUSE_THRESHOLD (default 0.3s):
        record pause {
            start: move_i.timestamp,
            duration: gap,
            stage: move_i.stage,
            type: classify_pause(gap, stage)
        }
```
**Pause classification:**
- Gap during F2L between pairs → lookahead breakdown
- Gap mid-algorithm → hesitation (recognition issue)
- Gap before OLL algorithm starts → OLL recognition time
- Gap before PLL algorithm starts → PLL recognition time
**Lookahead score specifically:**<br>The gap between the last move of F2L pair N and the first move of F2L pair N+1. This is the purest measure of lookahead quality. A sub-0.5 second gap means the solver was tracking the next pair during the previous insertion. Over 1 second means they stopped to search.
---
### 12. Analytics Engine
Aggregates all data from the processed solve into the final metrics output.
**Per-solve output:**
- Total time (from video timestamps)
- Time per stage with percentage breakdown
- Move count per stage with optimal move count comparison
- TPS per stage (moves ÷ stage time)
- All pauses with duration and stage label
- Lookahead score per F2L pair transition
- OLL case and algorithm efficiency
- PLL case and algorithm efficiency
- Reconstruction quality score
**TPS calculation:**<br>TPS = (number of moves in stage) ÷ (stage time in seconds). This separates execution speed from recognition/lookahead time. A solver with good TPS but bad lookahead scores needs different training than one with bad TPS.
**Efficiency ratio:**<br>For each stage, run Kociemba on the starting state targeting only that stage’s goal (cross solved, one F2L pair inserted, etc.). The optimal move count divided by the user’s move count gives an efficiency ratio. 1.0 = perfect. 0.5 = used twice as many moves as needed.
---
### 13. Multi-Solve Trends Dashboard
Aggregate across many solves to surface actionable patterns.
**Metrics tracked per solve, aggregated over time:**
- Rolling average time per stage (last 5, last 12, all-time)
- Histogram of OLL cases encountered (are you getting a diverse distribution or stuck on the same cases?)
- Histogram of PLL cases encountered
- Average lookahead score per F2L pair position
- TPS trend over time (is execution speed improving?)
- Reconstruction quality trend (are your solves improving in camera visibility?)
**Actionable insights engine:**<br>After N solves (start with 10), run pattern detection:
- Find the F2L pair position with the highest average time — flag it
- Find the OLL cases with the longest recognition pauses — flag them
- Find PLL cases where you consistently use suboptimal algorithms — flag them
- Compare your stage time distribution to benchmark data from top solvers
Output specific recommendations: “Your BL F2L pair takes 3.8s on average vs 2.1s for your other pairs. The 3 most common cases causing this are \[diagrams\]. Here are the fastest known solutions for each.”
---
## Data Model
### CubeState
```plain text
CubeState {
  cp: int[8]    // corner permutation (0-7)
  co: int[8]    // corner orientation (0-2)
  ep: int[12]   // edge permutation (0-11)
  eo: int[12]   // edge orientation (0-1)
}

// Serialised for BFS hash set as single 64-bit integer via bit packing
```
### Solve Record
```plain text
Solve {
  id: uuid
  createdAt: timestamp
  scramble: string
  videoPath: string
  totalTime: float (ms)
  reconstructionQuality: float (0.0 - 1.0)

  moves: Array<{
    move: string          // e.g. "R", "U'", "F2"
    timestamp: float      // ms from solve start
    stage: string         // "cross" | "f2l1" | "f2l2" | "f2l3" | "f2l4" | "oll" | "pll"
    observed: boolean     // true = seen directly, false = BFS reconstructed
  }>

  stages: {
    cross:  { startTime, endTime, moveCount, optimalMoveCount, tps }
    f2l1:   { startTime, endTime, moveCount, optimalMoveCount, tps, lookaheadGap }
    f2l2:   { startTime, endTime, moveCount, optimalMoveCount, tps, lookaheadGap }
    f2l3:   { startTime, endTime, moveCount, optimalMoveCount, tps, lookaheadGap }
    f2l4:   { startTime, endTime, moveCount, optimalMoveCount, tps, lookaheadGap }
    oll:    { startTime, endTime, case: int, recognitionPause, algorithmUsed, optimalAlgorithm, moveCount, optimalMoveCount }
    pll:    { startTime, endTime, case: string, recognitionPause, algorithmUsed, optimalAlgorithm, moveCount, optimalMoveCount }
  }

  pauses: Array<{
    timestamp: float
    duration: float
    stage: string
    type: string   // "lookahead" | "recognition" | "hesitation"
  }>
}
```
---
## Tech Stack
<table header-row="true">
<tr>
<td>Component</td>
<td>Technology</td>
<td>Why</td>
</tr>
<tr>
<td>Frontend</td>
<td>React</td>
<td>Your existing stack</td>
</tr>
<tr>
<td>Video processing</td>
<td>Python + OpenCV</td>
<td>Industry standard for CV</td>
</tr>
<tr>
<td>Cube state engine</td>
<td>Python</td>
<td>Fast prototyping, numpy for bit ops</td>
</tr>
<tr>
<td>IDA\* / BFS</td>
<td>Python</td>
<td>Implement yourself, no library</td>
</tr>
<tr>
<td>Pattern databases</td>
<td>Python + binary file</td>
<td>Precomputed, loaded at startup</td>
</tr>
<tr>
<td>OLL/PLL database</td>
<td>JSON</td>
<td>Simple lookup, easy to edit</td>
</tr>
<tr>
<td>Backend API</td>
<td>FastAPI</td>
<td>Lightweight, async, Python native</td>
</tr>
<tr>
<td>Database</td>
<td>PostgreSQL</td>
<td>Solve history, trends</td>
</tr>
<tr>
<td>Charts</td>
<td>Recharts or D3</td>
<td>Dashboard visualizations</td>
</tr>
</table>
---
## Build Order
Each step is independently testable. Do not skip ahead.
1. **Cube state model** — CubeState class, move application, all 18 moves hardcoded, stage detection conditions. Test: apply a known scramble, verify state matches expected. Apply full solve sequence, verify solved state.
2. **Scramble generator** — WCA random state scrambles, compute and store resulting CubeState. Test: apply scramble to solved state, verify matches stored state.
3. *IDA gap reconstructor*— given two CubeStates, find move sequence connecting them. Test: apply random 8-move sequence, verify IDA\* recovers those 8 moves (or equivalent).
4. **Pattern database builder** — precompute corner and edge pattern databases, save to binary file. This is a one-time offline computation. Run it once, commit the binary. Test: verify h(solved) = 0, verify h is admissible on random states.
5. **OLL/PLL database** — JSON files for all 57 OLL and 21 PLL cases with all known algorithms. Build recognition lookup tables. Test: generate known OLL/PLL states, verify recognition is correct.
6. **Stage detector** — given a complete move sequence, correctly identify all stage transitions. Test: use known human solve sequences with known splits.
7. **Analytics engine** — given a fully staged solve, compute all metrics. Test: verify pause detection, TPS, efficiency ratios on known data.
8. **Basic UI** — scramble display, timer, results page. No vision yet. At this point you have a fully working analytics app that could accept manual move input. Deployable MVP.
9. **Frame differencing move detector** — detect when moves happen in video. Test: video of slow deliberate moves, verify every move triggers a motion event.
10. **Color reader** — perspective correction, HSV classification. Test: photograph a solved cube in known orientation, verify all 54 stickers read correctly. Build HSV debug mode.
11. **Orientation tracker** — center color detection, face-label mapping, whole cube rotation detection. Test: record slow cube rotations, verify face labels update correctly.
12. **Full vision pipeline** — integrate all vision components into end-to-end flow. Test: record a slow manual solve with known move sequence, verify pipeline reconstructs it correctly.
13. **End to end integration** — vision pipeline feeds into IDA\* → stage detector → analytics → UI.
14. **Multi-solve trends** — aggregate data, pattern detection, recommendations engine.
---
## Known Limitations (Document Honestly in README)
- Reconstruction quality degrades below \~15 second solves due to occlusion frequency
- Very fast sub-10 solves will have significant BFS-reconstructed segments — analytics still valid but move sequence may not match actual
- Color reading sensitive to extreme lighting conditions — recommend filming near a window or under consistent artificial light
- Whole cube rotation detection during heavy occlusion relies on state comparison, not direct observation — rare edge cases possible
- Reconstruction quality score shown per solve so user always knows confidence level of their analytics
---
## What Makes This Portfolio-Worthy
In one project this demonstrates:
- Computer vision pipeline (contour detection, homography, HSV color classification)
- 3D orientation tracking (center-based face mapping, rotation detection)
- Combinatorial search algorithms (IDA\* with admissible heuristics)
- Pattern database construction and use (offline precomputation, binary serialization)
- Domain modeling (cube state as permutation groups, piece encoding)
- Full data pipeline design (video → frames → states → moves → analytics)
- Full stack product (frontend, Python backend, PostgreSQL, dashboard)
- Real domain expertise — you understand the problem from the inside as a speedcuber
A FAANG engineer reviewing this sees: someone who identified a genuinely hard problem, made smart architectural decisions (post-processing not real-time, known initial state as anchor, center colors not markers), implemented non-trivial algorithms from research papers, and shipped something real that solves a real problem. That is exactly what the job is.
---
## Resources
- Kociemba’s two-phase algorithm: [http://kociemba.org/cube.htm](http://kociemba.org/cube.htm)
- Korf’s optimal solver paper (1997): “Finding Optimal Solutions to Rubik’s Cube Using Pattern Databases”
- OpenCV homography and perspective transform documentation
- OpenCV contour detection documentation
- WCA OLL/PLL algorithm sheets (Badmephisto, SpeedSolving wiki)
- Herbert Kociemba’s cubelib Python package — read the source, do not use as a dependency
<empty-block/>
<empty-block/>
<empty-block/>
<empty-block/>
<empty-block/>
<empty-block/>
<empty-block/>
<empty-block/>
<empty-block/>
<empty-block/>
<empty-block/>
<empty-block/>
<empty-block/>
<empty-block/>
<empty-block/>
<empty-block/>
# **Libraries, csTimer Code Use, and Bluetooth Hardware Support**
**csTimer**
csTimer is open source, but it is licensed under **GPLv3**.
GPLv3 allows commercial use, including charging money, but it is a **copyleft license**. This means copying csTimer code directly into proprietary software can create obligations to release the affected software under GPLv3 and provide the corresponding source code.
Because of that:
- Do **not** directly copy csTimer source code into proprietary code.
- Do **not** copy its Bluetooth drivers, scramble generators, or drawing code directly.
- csTimer can still be used as a technical reference for understanding how devices and protocols work.
- Technical facts such as Bluetooth UUIDs, packet formats, device names, command values, checksums, and timer states can be independently reimplemented.
- The new implementation should be written independently rather than copied or lightly rewritten from csTimer code.
csTimer currently contains Bluetooth support for hardware including:
- GAN smart cubes
- GAN timers
- GiiKER
- GoCube
- MoYu smart cubes
- QiYi smart cubes
- QiYi smart timers
- QiYi Bluetooth timer adapters
- Stackmat-style timer input
For QiYi specifically, csTimer supports device names including:
QY-Timer
QY-Adapter
QY-Timer is the QiYi Bluetooth smart timer.
QY-Adapter is the QiYi Bluetooth adapter that plugs into a normal QiYi timer.
csTimer added native QiYi Bluetooth timer support in 2025, so older information saying these devices only work with the QiYi app may now be outdated.
The safest approach is to study how the protocol behaves, then create an independent implementation rather than copying qiyitimer.js.
# **cubing.js**
Prefer **cubing.js** for puzzle-related functionality instead of copying equivalent code from csTimer.
cubing.js is licensed under **Mozilla Public License 2.0 (MPL-2.0)**.
MPL is significantly easier to use inside proprietary software than GPL.
It can provide functionality including:
- WCA scramble generation
- Cube and puzzle state representation
- Algorithm parsing
- Scramble visualisation
- 2D puzzle rendering
- 3D puzzle rendering
- TwistyPlayer
- Smart cube Bluetooth support
Potential imports include:
import \{ randomScrambleForEvent \} from "cubing/scramble";
import \{ TwistyPlayer \} from "cubing/twisty";
Example:
const scramble = await randomScrambleForEvent("333");
console.log(scramble.toString());
Use the latest documented cubing.js APIs rather than relying permanently on these exact examples.
cubing.js supports various Bluetooth smart puzzles, including devices from manufacturers such as:
- GAN
- QiYi
- GiiKER
- GoCube
- Rubik’s Connected
- Xiaomi
- HEYKUBE
Support depends on specific hardware versions and firmware.
Whenever cubing.js already supports a Bluetooth cube, prefer using its Bluetooth implementation rather than recreating it.
# **gan-web-bluetooth**
Another useful library is:
gan-web-bluetooth
It uses the **MIT License**.
MIT is very permissive and is generally suitable for proprietary and commercial software as long as its license requirements are followed.
It supports various GAN Bluetooth devices, including hardware such as:
- GAN Smart Timer
- GAN Halo Smart Timer
- GAN smart cubes
- Some other compatible devices
This makes it a better source for GAN timer integration than directly copying GAN support from csTimer.
# **Bluetooth Hardware Architecture**
Do not make the rest of the code depend directly on specific manufacturers.
Instead, every Bluetooth timer should expose the same interface.
For example:
export type TimerState =
\| "disconnected"
\| "idle"
\| "hands-on"
\| "ready"
\| "inspection"
\| "running"
\| "stopped";
export interface TimerResult \{
timeMs: number;
inspectionMs?: number;
penalty?: "none" \| "+2" \| "DNF";
\}
export interface TimerDevice \{
connect(): Promise\<void\>;
disconnect(): Promise\<void\>;
isConnected(): boolean;
onStateChange(
callback: (state: TimerState) =\> void
): void;
onResult(
callback: (result: TimerResult) =\> void
): void;
getBatteryLevel?(): Promise\<number \| null\>;
\}
Then create individual adapters such as:
GanTimerAdapter
GanHaloTimerAdapter
QiyiTimerAdapter
QiyiBluetoothAdapter
StackmatAdapter
The application should only interact with TimerDevice.
It should not need to know which manufacturer is connected.
Example:
class DeviceManager \{
private activeTimer: TimerDevice \| null = null;
async connectTimer(timer: TimerDevice) \{
await timer.connect();
this.activeTimer = timer;
\}
async disconnectTimer() \{
if (!this.activeTimer) return;
await this.activeTimer.disconnect();
this.activeTimer = null;
\}
\}
# **Smart Cube Bluetooth Architecture**
Use a similar common interface for smart cubes.
Example:
export interface CubeMove \{
move: string;
timestamp: number;
\}
export interface SmartCubeAdapter \{
connect(): Promise\<void\>;
disconnect(): Promise\<void\>;
isConnected(): boolean;
onMove(
callback: (move: CubeMove) =\> void
): void;
getBatteryLevel?(): Promise\<number \| null\>;
getPuzzleState?(): Promise\<unknown\>;
\}
Then individual implementations can include:
GanCubeAdapter
QiyiCubeAdapter
GiikerCubeAdapter
GoCubeAdapter
MoyuCubeAdapter
Where possible, these adapters should wrap existing appropriately licensed libraries such as cubing.js rather than implementing everything again.
# **Normalised Bluetooth Events**
All hardware should be converted into standard internal events.
Example:
export type DeviceEvent =
\| \{
type: "timer-state";
state: TimerState;
\}
\| \{
type: "timer-result";
timeMs: number;
\}
\| \{
type: "cube-move";
move: string;
timestamp: number;
\}
\| \{
type: "battery";
percent: number;
\}
\| \{
type: "connected";
device: string;
\}
\| \{
type: "disconnected";
device: string;
\};
This prevents manufacturer-specific Bluetooth code from spreading throughout the codebase.
# **QiYi Timer and Bluetooth Adapter**
The QiYi implementation is particularly important because csTimer currently understands both:
QY-Timer
and:
QY-Adapter
For proprietary software, do **not** copy csTimer’s QiYi implementation.
Instead, independently implement the protocol.
Things that may need to be understood include:
Bluetooth service UUID
Bluetooth characteristic UUIDs
manufacturer data
device identification
packet structure
message length
command IDs
sequence numbers
acknowledgements
timer state packets
solve time packets
inspection time
CRC/checksum
encryption/decryption
connection handshake
These are protocol behaviours and technical facts.
The code implementing them should be original.
A QiYi-specific implementation could eventually look like:
export class QiyiTimerAdapter implements TimerDevice \{
private device: BluetoothDevice \| null = null;
async connect(): Promise\<void\> \{
*// Independent QiYi BLE implementation*
\}
async disconnect(): Promise\<void\> \{
if (this.device?.gatt?.connected) \{
this.device.gatt.disconnect();
\}
\}
isConnected(): boolean \{
return this.device?.gatt?.connected ?? false;
\}
onStateChange(
callback: (state: TimerState) =\> void
): void \{
*// Convert QiYi packets into standard TimerState values*
\}
onResult(
callback: (result: TimerResult) =\> void
): void \{
*// Convert QiYi result packets into TimerResult*
\}
\}
Do not copy the implementation of functions from csTimer into this class.
# **Bluetooth Testing**
Bluetooth support should be tested on real hardware because manufacturers can change firmware and protocols.
Important hardware to test includes:
GAN Halo Smart Timer
GAN Smart Timer
QiYi Smart Bluetooth Timer
QiYi Bluetooth Adapter + normal QiYi timer
GAN smart cubes
QiYi smart cubes
MoYu smart cubes
GiiKER
GoCube
Rubik's Connected
It is not necessary to personally own every model during initial development.
Existing libraries can provide initial support, while users with different hardware can test compatibility.
A Bluetooth debug system should record useful events without storing unnecessary personal identifiers.
Example:
interface BluetoothDebugEvent \{
timestamp: number;
type: string;
message: string;
\}
interface BluetoothDebugReport \{
browser: string;
os: string;
deviceModel?: string;
events: BluetoothDebugEvent\[\];
\}
Avoid exporting things such as MAC addresses unless absolutely necessary.
# **Recommended Licensing Approach**
csTimer
License: GPLv3
Use:
Technical reference
Avoid:
Directly copying source into proprietary software
cubing.js
License: MPL-2.0
Use:
Scrambles
Puzzle mathematics
Cube states
2D/3D rendering
Smart cube support
gan-web-bluetooth
License: MIT
Use:
GAN Bluetooth cubes/timers where appropriate
Missing Bluetooth protocols
Use:
Independent implementations
Before adding any new open-source library, always check its current license.
Do not assume code is safe to copy simply because it is publicly available on GitHub.

