# Letter-pair suggestion provenance

The bundled dataset covers the complete A-Z pair space and is intentionally hidden until the user presses **Show suggestions**.

## Sources consulted

- [SpeedSolving community resources](https://www.speedsolving.com/pages/resources/) — established vocabulary and links to public BLD resources. No list was copied wholesale.
- [SpeedSolving blindsolving discussions](https://www.speedsolving.com/threads/blindsolving-discussion-and-help.27353/) — informed the preference for concrete people, objects, actions, characters, and phonetic substitutions. Forum posts were not republished.
- [Stefan Pochmann’s blindsolving pages](https://www.stefan-pochmann.info/spocc/blindsolving/) — historical method context; not used as a word-list source.

## Original contribution and usage

Suggestions in `src/workspace/data/mnemonicSuggestions.ts` were written and curated for this project from common words, public names, brands, and characters. A deterministic set of pronounceable, image-oriented fallbacks completes sparse A-Z entries so every pair has at least five distinct choices. The resource does not reproduce a private spreadsheet or a copyrighted community list. Users’ Default words and optional Edge/Corner words are separate private data in Supabase.
