# CubeIQ V2 audit

Baseline: nine frontend tests pass and production build succeeds. Inspected Timer, matrix, pair dialog, Flashcards empty state, Memo study state, Settings at 1440×900, 1024×768 and 390×844 in the browser. Existing Python camera/CFOP code and original project brief remain outside this 3BLD overhaul.

## Preserve

Dedicated cubing.js 333bf scrambles; library renderer and algorithm parsing; separate BLD and pair domains; tuple pair keys; hidden suggestions; uniform flashcard sampling; raw target/execution convention distinction; owner-only RLS; JSON portability.

## Findings

- Visual: near-black/acid accent, floating timer rectangle, excessive radius/shadow, oversized headings, marketing-style eyebrows, redundant coverage donut, tiny matrix labels, identical settings cards. Timer overlaps the cube on desktop. Baseline mobile navigation and grid consume too much useful space.
- Architecture: all pages/forms in one App.tsx; no routes; interval redraws all timer children; unconditional heavy imports; missing effect cleanup and request races.
- Interaction: no onboarding, focus trap/restoration, grid arrows, flashcard edit, shortcut help, result reconciliation, solve details/deletion. Prompts replace proper forms. Memo combines corners and edges into one pairing boundary and recovers identity through duplicate label strings.
- Reliability: one storage key across accounts; cloud load replaces local pairs/history; no scheme write/read mapping; aliases updated non-atomically; failure still says Synced; import trusts arbitrary JSON and replaces data; no retry; unsafe localStorage exceptions; no error boundary.
- Domain concerns requiring independent verification: selected cycle-break entry is omitted; a flipped piece receives only one target. Default corner map and cubing orbit indices need comparison with library facelet data and established Speffz. Wide-turn 333bf suffixes move centers, which must be normalized before center-relative tracing.
- Tests: nine green tests do not establish correct memo. Missing independently published fixture, orientation cases, auth isolation and UI workflows.

## Chosen direction

Evaluated a dense stopwatch console, a notebook layout, and a restrained training instrument. Choose the instrument: direct timer surface, compact top navigation, consistent paired-token separators, dense matrix with selection cursor, grouped settings rows. Notebook styling risks decorative rules; a console risks excess density during recall.

## References

- https://vercel.com/design/guidelines — focus, keyboard operation, resilient forms and feedback.
- https://developer.apple.com/design/human-interface-guidelines/layout and /typography — requested references; extraction is JS-only, so no claims of full text review.
- https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html — AA minimum 24px, aim for 44px for primary touch controls.
- https://github.com/LeoStehlik/no-slop-ui — read SKILL.md, banned-patterns.md and review-checklist.md; apply as design review, with user product requirements taking precedence.
- https://aiuxplayground.com/prompts/unslop-my-ui/ — remove default compositions and filler, evaluate each screen's task.
- https://www.cubedesk.io/ — practice integration and session context.
- https://cstimer.net/ — immediate timer and dense solve context; no source copied.
- https://alpha.twizzle.net/explore/ — algorithm/cube relationship; library rendering retained.
- https://jperm.net/bld — independently published trace fixture and cycle closure rules.
