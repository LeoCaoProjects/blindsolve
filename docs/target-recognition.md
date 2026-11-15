# Target Recognition

Recognition drills follow raw physical target locations in the configured memo order, buffer and scope. Synthetic cycle-break entries are skipped. M2 execution substitutions never change recognition answers.

Hold Space or use touch to start. Single-character labels submit immediately; multi-character labels use Enter. Backspace edits the current token, then the preceding answer. The inspected source and partner colours remain visible; expected labels stay hidden until review. Reduced motion disables the pulse and sliding effects.

Changing route, mode or setup cancels incomplete attempts. Only completed summary records persist: identity, date, duration, targets, correctness and accuracy. Expected and entered tokens are session-only. History rows support deletion but do not reopen reviews. Existing legacy payloads remain readable.

Implementation: `web/src/workspace/utils/recognition.ts`, `hooks/useTrainingSession.ts` and `components/training/RecognitionWorkspace.tsx`. Unit tests cover physical stickers and custom views; `e2e/target-recognition.spec.ts` covers desktop and mobile input.
