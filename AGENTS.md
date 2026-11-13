# BlindSolve working conventions

These rules apply to BlindSolve work. The CubeIQ notes below apply only to separate CubeIQ work.

- Develop in `C:/Users/leoca/OneDrive/Documents/ChatGPT/CubeIQ/.codex-worktree`. Reuse this permanent worktree; do not create a branch/worktree for each prompt.
- Keep one short feature branch without a `codex/` prefix (e.g. `timer-ui` or `training`). Keep the current `codex/timer-ui` name until this feature finishes. Keep that branch through all iterations of that feature. For a genuinely different feature, start from freshly fetched `origin/main`, never old `dev` or an old feature branch. Announce the old/new branch names, reuse the same worktree, and confirm whether the localhost command changes.
- Default to local iteration with a working `npm run dev`. Do not push, open a PR, merge or deploy, or ask to publish after each prompt. Wait until the user explicitly says to ship/deploy the accumulated feature.
- When an iteration is clearly approved, make a small local checkpoint if useful, without branching. Commit and PR titles should be natural, short, normally 2-6 words (e.g. `refine timer footer`); put details in the PR body.
- During iteration, run checks proportional to the change: relevant unit/browser tests, typecheck as needed, quick responsive checks. Reserve the full unit/browser/build/CI pipeline for shipping; run broader checks immediately when logic/data risk warrants it.
- On explicit shipping approval: update the existing feature branch against current main without losing work; run the full test/build suite; push that branch; open ONE PR with a short title; merge after CI passes; deploy and verify production. Delete the merged remote/local feature branch, update the local base to production/main, and leave the permanent worktree ready for the next feature.
- Remove finished temporary worktrees and obsolete merged branches. Never delete useful uncommitted/unmerged work. Verify squash merges using the merged PR head and merge commit, not ancestry alone. Do not rewrite main history.

Normal localhost command (unchanged between iterations):
```powershell
cd "C:\Users\leoca\OneDrive\Documents\ChatGPT\CubeIQ\.codex-worktree"
npm run dev
```

# Experimental camera-analysis backend

Keep observed evidence, mathematical states, candidate moves, orientation and timing separate. Preserve raw evidence and label uncertain metrics. Keep historical planning documents in the private release archive.
