# CubeIQ working instructions

Read [PROJECT_BRIEF.md](PROJECT_BRIEF.md) and the [current Notion project](https://app.notion.com/p/37a518ed0c75806d8963c81ea908893b) before proposing or implementing CubeIQ work. Notion has an overview and four focused child pages. [CLAUDE_ORIGINAL.md](CLAUDE_ORIGINAL.md) preserves the user's prior plan, and [CUBEIQ_NOTION_BEFORE.md](notion_draft/CUBEIQ_NOTION_BEFORE.md) preserves the former Notion description. Edit Notion when the user asks; otherwise use it as project context.

The defining goal is reconstructing a human 3×3 solve from one camera and giving trustworthy CFOP analytics. Smart cubes and timers are optional input sources and useful validation tools. Keep partial video observations, mathematical cube states, candidate moves, orientation, and timing separate. Do not present a shortest search path or a solver solution as the observed human sequence. Label uncertain metrics and preserve raw evidence.

Follow the build order and proof points in the brief. Test cube-state invariants and real labeled video before claiming camera accuracy. Check current library APIs, licenses, and exact hardware compatibility when adding dependencies; do not copy csTimer GPL source into proprietary CubeIQ code. Explain material departures from the brief to the user.
