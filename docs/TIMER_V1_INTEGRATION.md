# Timer Workspace integration

The Timer page follows the approved Magic Patterns **Concept C / Workspace** concept exported from [Magic Patterns](https://www.magicpatterns.com/c/2erxj485g1qftjm8fmsw1q). The prototype is the visual reference only. Its seeded solves, fixed memo samples, scramble helper, cube math, and reconstruction hook are not used by the application.

## Connected production systems

- `cubing.js` continues to generate legal `333bf` scrambles and provide the authoritative cube state. The Workspace CSS cube reproduces the supplied projection while mapping each scrambled facelet back to its physical sticker identity.
- The existing typed BLD trace engine remains responsible for deterministic targets, flips, twists, parity-shaped target counts, and interactive cycle breaks.
- The account-isolated workspace repository remains the persistence boundary. Timer preferences, +2 results, reconstruction choices, and memo snapshots are stored inside the versioned workspace JSON and therefore use the existing atomic Supabase RPC and RLS policy.
- Per-solve memo snapshots store physical sticker identities, the tokens used at solve time, and the mnemonic actually reviewed by the user. Current letter-pair edits cannot rewrite that history.

## Timer states

- Holding Space (or the timer surface) enters the armed state; after 280 ms it becomes ready, and release starts the clock, matching the Workspace prototype.
- Standard timing: idle → armed → ready → running → reconstruction.
- Multiphase timing: idle → armed → ready → memo → execution → reconstruction.
- Escape saves without further mnemonic questions only after the real trace is complete. It never skips unresolved cycle-break choices.
- Solve details and other overlays take keyboard priority over the Timer.

## Fidelity boundary

The Workspace layout, typography, dark theme, instrument geometry, right-hand cube/history workspace, overlays, transitions, shortcuts, and hold/release interaction follow the supplied Concept C source. The layout adapts at narrow widths so the timer and touch controls remain usable. Visual comparisons cover 1440×900, 1024×768, and 390×844.

The production cube now uses the prototype's exact CSS 3D geometry, sizing, projection, palette, drag rotation, and reset interaction. Sticker labels are drawn directly on the scrambled cube and come from the user's active lettering scheme; they move with their physical stickers instead of being regenerated as fixed Speffz face labels. During reconstruction the same cube dims irrelevant stickers and exposes valid cycle-break candidates as direct hit targets, with a textual option list retained as an accessible fallback.

The reconstruction and solve-details experiences use the Workspace side drawer. Memo targets are grouped into pairs, unresolved future pairs use dot placeholders, the current pair is highlighted during mnemonic review, and cycle-break markers are attached to the relevant pair. “Skip to save” remains available after tracing is complete even when one or more mnemonic fields are blank.

No Supabase DDL migration is required for this integration because current accounts persist the complete workspace in the existing `bld_workspaces.data jsonb` column. Backup format version 3 adds the new optional fields while versions 1 and 2 remain importable.
