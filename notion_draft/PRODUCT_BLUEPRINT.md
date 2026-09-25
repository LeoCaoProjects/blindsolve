## Product promise
A cuber should be able to film a 3×3 solve with one camera and learn where time went. CubeIQ returns a replayable account of the solve: verified moves where possible, plausible moves where the evidence is weaker, unresolved intervals where the camera cannot tell. It explains cross, F2L, OLL, PLL, pauses, and longer-term patterns without pretending that a search algorithm observed a turn.

## Solve flow
1. Generate a random-state 3×3 scramble, show its diagram, and store the state reached by applying the displayed sequence to solved. The intended state is a starting constraint, not proof that the physical scramble was done correctly.
2. Record video through the solve. A keyboard/touch timer works without hardware. A connected timer may provide the official time; its start and stop events are aligned with video timestamps.
3. Verify the start and solved finish when the evidence allows. A stopped timer alone does not prove the cube is solved.
4. Analyze the saved recording. Show the video with a move timeline, stage boundaries, and visible confidence. Let the cuber correct ambiguous intervals instead of forcing a complete sequence.
5. Save the solve, video reference, observations, inferred events, metrics, warnings, and analysis version so it can be replayed or reanalyzed later.

The desired final experience has no smart-cube requirement and no manual move entry. Automatic setup is also a goal, but the first version may need lighting guidance, passive color learning, or an assisted correction step. These should be measured against real footage before being removed.

## What a result shows
- Total time and timing source. Stage time and average stage TPS; execution TPS can be shown separately when active turning intervals are reliable.
- Move count and a replay timeline. Each move has evidence and uncertainty for identity and time; a missing interval stays visibly unresolved.
- Cross completion, four F2L insertions, OLL, and PLL when the solve follows CFOP closely enough. Pair order, pair breaks/restores, skips, AUF, and cube rotations are handled.
- Pauses and between-pair delays. A long F2L transition is a lookahead *clue*, not direct evidence of what the cuber was thinking. Recognition and hesitation labels remain hypotheses.
- OLL/PLL cases and the algorithm that appears to have been used, only when the move sequence supports that claim. “Better algorithm” needs a stated measure: fewer face turns, faster execution for that cuber, or another defined goal.
- Trends across reliable solves: stage averages, common delays, recognition patterns, F2L slot differences, TPS, and analysis quality. Recommendations should identify a repeatable pattern and suggest a concrete drill.

CFOP is the first analysis model. The app should not label every solve as CFOP or assume a white cross. The solver's cross color and cube orientation need to be known or inferred. Other methods can still have a timer and replay, but their stage analytics need their own model.

## Modes and scope
**Camera-only:** ordinary cube, video, inferred moves. This is the main product and research target.

**Camera plus timer:** same analysis, with a supported device providing time and inspection/penalty events where available.

**Smart cube:** exact device move events pass through the same analytics engine. This makes a useful optional mode and a way to check camera results. Device support is model- and firmware-specific.

The first build does not need an enormous OLL/PLL algorithm library, comparisons to elite-solvers' unpublished data, or universal Bluetooth support. A small verified case database and reliable metrics are more useful than a long list of untested claims.

## Trust rules
- Distinguish the intended scrambled state from a verified physical start state.
- Distinguish a camera observation from a complete mathematical cube state.
- Distinguish the user's turn from a shortest or two-phase solver path.
- Distinguish move identity confidence from timing confidence.
- Do not assign exact timestamps inside an occluded gap without timing evidence.
- Hide or qualify a metric if its inputs are uncertain. Save enough raw evidence to re-run analysis later.

