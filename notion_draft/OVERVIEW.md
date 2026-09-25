**CubeIQ analyzes a speedcube solve from one camera.** It starts with a generated scramble, records the solve, and uses the video to work out what happened between the scrambled state and the finish. The result should show the move timeline, CFOP stages, pauses, OLL and PLL cases, and the parts of the solve that deserve practice.

The hard part is recovering the **actual human moves**. A solver can find moves that connect two cube states, but those may not be the moves the cuber made. Hands hide stickers; a fixed camera sees only part of the cube; fast turns blur together. CubeIQ must keep what it saw separate from what it inferred, and leave a gap unresolved when the video cannot support a clear answer.

## What the cuber does
1. Get a fair 3×3 scramble and apply it to the cube.
2. Put the cube in view and start a keyboard, touch, or supported timer.
3. Solve while the camera records. Analysis runs after the solve.
4. Replay the solve with move and stage markers. Check any uncertain segments.
5. Review specific patterns across reliable solves, such as long F2L transitions or slow OLL recognition.

**One camera and an ordinary cube are the goal.** A smart cube is optional. It can provide exact moves for users who own one and ground truth while the camera system is being developed. Supported Bluetooth timers can supply timing. Neither changes the camera-first purpose of the project.

## Where the project is now
**Planning. Development has not started.** The first job is to prove the cube-state and analytics engine against known move sequences. The next is a labeled video benchmark: deliberate moves first, then real solves with rotations, occlusion, different lighting, and increasing speed. Camera accuracy and confidence rules will come from those recordings, not guessed percentages.

## Build path
**Cube math → analytics on known moves → labeled videos → camera observations → move reconstruction → end-to-end solves → trends → optional hardware.**

The system should report a partial analysis when the evidence is partial. A polished dashboard cannot compensate for a move list that only looks certain.

## Tracked tasks
The 16 tasks are linked to this project in the Tasks database. Each names an objective, checks for completion, and a dependency. Start with <mention-page url="https://app.notion.com/p/3dd518ed0c758156b4aaccdc5c6efa42"/>; the remaining tasks follow the build path above. All are **To do** while the project is still in Planning.

## What is in this project
The pages below hold the product behavior, technical design, hardware rules, proof points, and unresolved decisions. The original Claude plan is preserved in the Codex workspace as `CLAUDE_ORIGINAL.md`; the revised working brief is `PROJECT_BRIEF.md`.
