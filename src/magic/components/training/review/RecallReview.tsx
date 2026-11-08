import React, { useState } from "react";
import { SuggestPopover } from "../../common/SuggestWords";
import { useAppData } from "../../../contexts/AppDataContext";
import { TrainingSession } from "../../../hooks/useTrainingSession";
import { pairKey } from "../../../utils/pairs";
import { formatTime } from "../../../utils/time";
import { fullPairs, targetAccuracyForResults } from "../../../utils/training";
import { PairTokens } from "../../pairs/PairTokens";
import { PairDiff } from "./PairDiff";
import { ReviewHeader, ReviewPanel } from "./ReviewPanel";
import { SolveDetailsActions } from "../../solve/SolveDetailsShell";
import { SolveSummary } from "../../solve/SolveSummary";

const LABEL = { corners: "Corners", edges: "Edges" } as const;

export function correctTargets(t: TrainingSession) {
  return t.results.reduce(
    (n, g) => n + g.actual.length - Math.min(g.wrong, g.actual.length),
    0,
  );
}

interface WordItem {
  key: string;
  a: string;
  b: string;
  piece: "corners" | "edges";
  word?: string;
  missed: boolean;
}

/**
 * Memo Recall: summary, aligned comparison, then only the words worth a look.
 * Missing words can be typed in place; nothing is written until Save.
 */
export function RecallReview({ t }: { t: TrainingSession }) {
  const { setDefaultWord } = useAppData();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const { correct: ok, total } = targetAccuracyForResults(t.results);
  const completed = t.history.find(
    (attempt) => attempt.id === t.reviewAttemptId,
  );

  const items: WordItem[] = t.results.flatMap((g) =>
    fullPairs(g.actual).map(([a, b], i) => {
      const typed = g.typed.slice(i * 2, i * 2 + 2);
      return {
        key: `${g.piece}-${i}`,
        a,
        b,
        piece: g.piece,
        word: t.wordFor(a, b, g.piece),
        missed: typed[0] !== a || typed[1] !== b,
      };
    }),
  );
  const notable = items.filter((w) => !w.word || w.missed);
  const shown = notable;
  const hasWordEdits = items.some(
    (item) =>
      drafts[item.key] !== undefined &&
      drafts[item.key].trim() !== (item.word ?? ""),
  );

  const saveAndClose = () => {
    Object.entries(drafts).forEach(([key, value]) => {
      const item = items.find((w) => w.key === key);
      const word = value.trim();
      if (!item || !word || word === item.word) return;
      setDefaultWord(pairKey(item.a, item.b), word);
    });
    t.next();
  };

  return (
    <ReviewPanel
      label="Memo Recall review"
      onNext={t.next}
      onClose={t.next}
      footer={
        <SolveDetailsActions
          onClose={saveAndClose}
          closeLabel="Save"
          closeHint=""
          actionClassName="min-w-[84px] justify-center"
          onDiscard={hasWordEdits ? t.next : undefined}
          onDelete={() => {
            if (completed) t.removeAttempt(completed.id);
            t.next();
          }}
          deleteLabel="Delete attempt"
        />
      }
      header={
        <ReviewHeader>
          <SolveSummary
            date={completed?.createdAt}
            time={completed?.ms ?? t.elapsed.memo}
            penalty={(completed?.correct ?? t.allCorrect) ? "ok" : "dnf"}
            onPenalty={() => {}}
            metadata={
              <dl
                aria-label="Recall statistics"
                className="mt-[clamp(10px,2vh,20px)] flex flex-wrap gap-6"
              >
                {[
                  ["targets", `${ok}/${total}`],
                  ["memo", formatTime(t.elapsed.memo)],
                  ["recall", formatTime(t.elapsed.recall)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-[11px] text-ink-3">{label}</dt>
                    <dd className="mt-1 font-mono text-[14px] text-ink-2 tnum">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            }
            resultControl={<></>}
          />
        </ReviewHeader>
      }
    >
      <div className="grid gap-7">
        {t.results.map((g) => (
          <PairDiff
            key={g.piece}
            result={g}
            label={LABEL[g.piece]}
            keepComparison
            quietErrors
          />
        ))}
      </div>

      <section className="mt-9 border-t border-line pt-6">
        {shown.length > 0 && <p className="text-[12px] text-ink-3">Word edits save to Default; optional overrides stay unchanged.</p>}
        {shown.length > 0 && (
          <ul className="mt-3 grid grid-cols-1 items-start gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((w) => (
              <li
                key={w.key}
                className="grid min-h-[44px] grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-x-3 border-b border-line py-1.5"
              >
                <PairTokens
                  first={w.a}
                  second={w.b}
                  className="font-mono text-[14px] tracking-[0.1em] text-ink"
                />
                <input
                  aria-label={`Word for ${w.a}${w.b}`}
                  value={drafts[w.key] ?? w.word ?? ""}
                  placeholder="Enter word"
                  onChange={(e) =>
                    setDrafts((d) => ({ ...d, [w.key]: e.target.value }))
                  }
                  className="h-8 w-full min-w-0 rounded-[4px] border border-line-strong bg-surface px-2 text-[13.5px] text-ink caret-accent outline-none placeholder:text-ink-3 focus:rounded-[4px] focus:border-ink-3"
                />
                <SuggestPopover
                  first={w.a}
                  second={w.b}
                  iconOnly
                  current={drafts[w.key] ?? w.word}
                  onPick={(word) => {
                    setDrafts((d) => ({ ...d, [w.key]: word }));
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </ReviewPanel>
  );
}
