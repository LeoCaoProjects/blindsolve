# Lettering and logical mnemonic identity

Audit before implementation, 9 November 2026. Local `settings-ui` only; no remote project queried or changed.

**Status:** validation UI is implemented. The data-model code remains an isolated proposal: automatic approval review rejected repository/sync/tombstone integration. The current app still uses physical-key word storage. See `logical-pair-integration-review.md` for the additive approval proposal.

| Layer | Existing identity / behavior | Required correction |
| --- | --- | --- |
| Physical sticker | Stable domain ID, e.g. `U:UBL`; piece type, buffer and orbit mechanics | Keep for cube mechanics and historical target evidence |
| User lettering | `scheme.stickers[id].label`; independent Edge/Corner uniqueness | Normalize uppercase/whitespace consistently; never rename words |
| Camera | `defaultCubeView`, renderer basis | Presentation only; no word identity changes |
| Pair UI | `firstToken|secondToken`; delimiter excluded from valid labels | Keep collision-safe token boundaries; restrict visible pairs to one currently usable piece scope |
| Old word record | `LetterPair`, UUID payload ID, physical sticker IDs, saved first/second tokens, effective word, optional vocabulary Default/override timestamps | Read using saved logical tokens, never current sticker labels |
| Old repository key | JSON array of two physical sticker IDs | Collision: `writePairEntries` locates today's stickers then reuses that physical key and UUID for a different pair |
| New word record | — | One sparse record per versioned JSON tuple `(firstLabel, secondLabel, scope)`; scopes Default/Edge/Corner independent; no physical ID in new identity |
| Sync | `kind=pair`, map key as `record_id`, UUID remains payload metadata | Existing RPC accepts object payloads and <=200-character record IDs; no SQL/table change needed |
| Deletion | Envelope tombstone `pair:<record_id>`; pairs can be intentionally recreated with newer edits | Logical scope tombstones must also suppress stale matching legacy physical rows; delete legacy aliases when converting an edited pair |
| Backup/import | JSON version 1–3 workspace records, strict parser currently rekeys all pairs physically | Preserve legacy record keys; validate logical keys against payload; accept both representations; never infer lost labels |
| Timer | `toTimerDb` currently concatenates tokens, reconstruction strings use `pair[0]`, `slice(1)` | Carry explicit boundaries for custom tokens, use collision-safe lookup; retain standard AB display/compatibility |
| Training | Main lookup already uses `pairKey(a,b)` and token arrays; formatted Timer memo joins tokens | Preserve atomic tokens in formatted memo, review and answer parsing |
| Flashcards | Main route uses logical pair keys, per-piece active token sets; old unused page uses physical records | Main active route must use corrected logical vocabulary; old physical page is not routed by `src/App.tsx` |
| Saved solves | Raw physical targets plus first/second token snapshots, optional execution tokens and used words | Format snapshot tokens atomically; never rewrite historical used words from current lettering |
| Pair navigation | Union token Cartesian product; greedy shortcut tokenizer | Default pairs = union of per-scope valid combinations; disallow ambiguous shortcuts when any multi-character active token exists |
| Suggestions | Pair words and token boundaries supplied by editor/ordinary entry | Audit string assumptions; ambiguous multi-token display must not be used as storage identity |

The active application is `src/magic/App.tsx`. `src/pages/*` are legacy, unrouted screens; their physical domain helpers must not be mistaken for the current persistence interface.

Legacy records preserve firstToken/secondToken. These are sufficient to read their logical identity without consulting current lettering. A record with missing/invalid stored labels must remain preserved and unavailable for automatic reassignment. Already-overwritten words cannot be reconstructed from the surviving row; a backup would be needed. Legacy effective-only rows cannot reveal whether a word was originally intended as Default or an override; retain the established interpretation and report that limitation.

The initial conversion plan was superseded by a safer additive proposal: write only explicitly edited scopes into a separate logical namespace, retain all original physical records unchanged, and mask legacy reads with explicit logical scope values or deletion metadata. No eager conversion or deletion of legacy aliases is proposed. Reading or changing lettering will create no mnemonic records. Signed-out local storage and signed-in batch RPCs will use identical identities. Older clients can continue producing physical rows, but cannot replace new logical records; upgraded readers prefer explicit canonical scope values and logical deletion evidence.

The deployed `apply_bld_sync_changes` SQL checked into this branch validates ownership, payload size and record ID length. It does not require pair IDs to contain physical stickers. Scope-level records fit that contract; verification uses isolated RPC fixtures, not production. Existing owner isolation, bounded retries and revision conflict handling remain unchanged.
