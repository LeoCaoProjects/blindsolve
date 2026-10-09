import React, { useState } from "react";
import { CheckIcon, PlusIcon, XIcon } from "lucide-react";
import { useAppData } from "../../../contexts/AppDataContext";
import { TrainingSession } from "../../../hooks/useTrainingSession";
import { PairScope } from "../../../types/app";
import { Piece } from "../../../types/solve";
import { pairKey } from "../../../utils/pairs";
import { formatTime } from "../../../utils/time";
import {
  FullRow,
  isFullCorrect,
  trailingTarget,
} from "../../../utils/training";
import { PairTokens } from "../../pairs/PairTokens";
import { DecisionMenu } from "./DecisionMenu";
import { ReviewHeader, ReviewPanel } from "./ReviewPanel";
import { ReviewSummary } from "./ReviewSummary";

type Decision = "keep" | "replace" | "alternate" | "save";

const PIECE_LABEL: Record<string, string> = {
  corners: "Corners",
  edges: "Edges",
};
const ROW =
  "grid grid-cols-[18px_44px_minmax(0,1fr)_auto] items-start gap-x-3 border-b border-line py-2 pl-2.5";
/** Wrong / Missing / Extra: a thin red rule on the left, nothing louder. */
const ERROR_ROW = "shadow-[inset_2px_0_0_var(--danger)]";

/**
 * Full Memo review reads like the memo you just built: Corners then Edges, in real trace order,
 * each position showing what you typed there. Correctness first; updating your list is a
 * secondary, staged per-row choice with safe defaults, committed once in the footer.
 */
export function FullMemoReview({ t }: { t: TrainingSession }) {
  const { pairs, prefs, savePair } = useAppData();
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [chosen, setChosen] = useState<Record<string, string>>({});

  const rows = t.fullRows;
  const expected = rows.filter((r) => r.status !== "extra");
  const correct = expected.filter((r) => isFullCorrect(r.status)).length;
  const wrong = rows.filter((r) => r.status === "wrong").length;
  const missing = rows.filter(
    (r) => r.status === "missing" || r.status === "blank",
  ).length;
  const extra = rows.filter((r) => r.status === "extra").length;
  const fresh = rows.filter((r) => r.status === "new").length;
  const mistakes = wrong + missing + extra;
  const staged = Object.entries(decisions).filter(([, d]) => d !== "keep");

  const decide = (id: string, d: Decision) =>
    setDecisions((p) => ({ ...p, [id]: d }));

  const targetScope = (key: string, piece: Piece): PairScope => {
    const entry = pairs[key];
    if (entry?.[piece]?.length) return piece;
    return prefs.sharing === "separate" ? piece : "shared";
  };
  const write = (row: FullRow, words: string[]) => {
    const key = pairKey(row.a, row.b);
    const entry = pairs[key] ?? { shared: [] };
    const scope = targetScope(key, row.piece);
    savePair(
      key,
      scope === "shared"
        ? { ...entry, shared: words }
        : { ...entry, [scope]: words },
    );
  };
  const saveAndContinue = () => {
    staged.forEach(([id, d]) => {
      const row = rows.find((r) => r.id === id);
      if (!row) return;
      if (d === "save") write(row, [chosen[id] ?? row.typed]);
      if (d === "replace")
        write(row, [
          row.typed,
          ...row.stored.filter(
            (w) => w.toLowerCase() !== row.typed.toLowerCase(),
          ),
        ]);
      if (d === "alternate") write(row, [...row.stored, row.typed]);
    });
    t.next();
  };
  const cancel = () => {
    setDecisions({});
    setChosen({});
  };

  const breakdown = [
    wrong && `${wrong} wrong`,
    missing && `${missing} missing`,
    extra && `${extra} extra`,
  ]
    .filter(Boolean)
    .join(" · ");
  const groups = t.groups;

  return (
    <ReviewPanel
      label="Full Memo review"
      onNext={t.next}
      pending={{
        count: staged.length,
        onSave: saveAndContinue,
        onCancel: cancel,
        saveLabel: "Save changes & continue",
        cancelLabel: "Cancel changes",
        noun: ["change", "changes"],
      }}
      header={
        <ReviewHeader>
          <ReviewSummary
            time={formatTime(t.elapsed.total)}
            status={mistakes ? "incorrect" : "correct"}
            statusLabel={
              mistakes
                ? `${correct} / ${expected.length} correct`
                : fresh
                  ? "No mistakes"
                  : "All correct"
            }
            stats={[
              ["correct", `${correct} / ${expected.length}`],
              [
                "per pair",
                formatTime(t.elapsed.total / Math.max(1, t.pairCount)),
              ],
            ]}
          />
        </ReviewHeader>
      }
    >
      <p className="text-[13px] text-ink-2">
        {breakdown || "Every pair matches your list"}
        {fresh > 0 && (
          <span className="text-ink-3">
            {" · "}
            {fresh} new {fresh === 1 ? "mnemonic" : "mnemonics"}
          </span>
        )}
      </p>

      {groups.map((g) => {
        const groupRows = rows.filter((r) => r.piece === g.piece);
        const single = trailingTarget(g.tokens);
        return (
          <section
            key={g.piece}
            className="mt-7"
            aria-labelledby={`fm-${g.piece}`}
          >
            <h3
              id={`fm-${g.piece}`}
              className="flex items-baseline justify-between border-b border-line pb-2 text-[12px] text-ink-2"
            >
              {PIECE_LABEL[g.piece] ?? g.piece}
              <span className="font-mono text-[11px] text-ink-3 tnum">
                {groupRows.filter((r) => isFullCorrect(r.status)).length} /{" "}
                {groupRows.filter((r) => r.status !== "extra").length}
              </span>
            </h3>
            {groupRows.length === 0 && !single ? (
              <p className="py-3 text-[13px] text-ink-3">
                Solved, nothing to memo
              </p>
            ) : (
              <ol>
                {groupRows.map((row, ri) => {
                  const firstExtra =
                    row.status === "extra" &&
                    groupRows[ri - 1]?.status !== "extra";
                  return (
                    <React.Fragment key={row.id}>
                      {firstExtra && single && <TrailingRow token={single} />}
                      <MemoRow
                        row={row}
                        decision={decisions[row.id] ?? "keep"}
                        chosen={chosen[row.id]}
                        onDecide={(d) => decide(row.id, d)}
                        onChoose={(w) => {
                          setChosen((c) => ({ ...c, [row.id]: w }));
                          decide(row.id, "save");
                        }}
                      />
                    </React.Fragment>
                  );
                })}
                {single && !groupRows.some((r) => r.status === "extra") && (
                  <TrailingRow token={single} />
                )}
              </ol>
            )}
          </section>
        );
      })}
    </ReviewPanel>
  );
}

function MemoRow({
  row,
  decision,
  chosen,
  onDecide,
  onChoose,
}: {
  row: FullRow;
  decision: Decision;
  chosen?: string;
  onDecide: (d: Decision) => void;
  onChoose: (w: string) => void;
}) {
  const ok = isFullCorrect(row.status);
  const isMissing = row.status === "missing" || row.status === "blank";

  if (row.status === "extra") {
    return (
      <li className={`${ROW} ${ERROR_ROW}`}>
        <StatusMark status={row.status} />
        <span className="pt-px font-mono text-[12px] text-ink-3 tnum">
          #{row.index + 1}
        </span>
        <div className="min-w-0">
          <p className="flex min-w-0 items-baseline gap-2 text-[14px]">
            <span className="truncate text-danger">{row.typed}</span>
            <Tag error>Extra</Tag>
          </p>
          <p className="mt-0.5 text-[12px] text-ink-3">
            No letter pair at this position
          </p>
        </div>
        <span />
      </li>
    );
  }

  const word = row.status === "new" ? (chosen ?? row.typed) : row.typed;

  const isError = row.status === "wrong" || isMissing;

  return (
    <li className={`${ROW} ${isError ? ERROR_ROW : ""}`}>
      <StatusMark status={row.status} />
      <PairTokens
        first={row.a}
        second={row.b}
        className={`pt-px font-mono text-[14px] tracking-[0.1em] ${ok ? "text-ink-3" : "text-ink"}`}
      />

      <div className="min-w-0">
        <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-[14px]">
          {isMissing ? (
            <span className="text-ink-3">No answer</span>
          ) : (
            <span
              className={`min-w-0 truncate ${ok ? "text-ink-3" : row.status === "wrong" ? "text-danger" : "text-ink"}`}
            >
              {word}
            </span>
          )}
          {row.status === "alternate" && (
            <span className="text-[11px] text-ink-3">alternate</span>
          )}
          {row.status === "wrong" && <Tag error>Wrong</Tag>}
          {row.status === "new" && <Tag>New</Tag>}
          {isMissing && <Tag error>Missing</Tag>}
          {row.status === "new" && chosen && chosen !== row.typed && (
            <span className="truncate text-[11.5px] text-ink-3">
              you typed {row.typed}
            </span>
          )}
        </p>
        {(row.status === "wrong" ||
          (row.status === "missing" && row.stored.length > 0)) && (
          <p className="mt-0.5 truncate text-[12.5px] text-ink-2">
            <span className="text-ink-3">expected </span>
            {row.stored[0]}
            {row.stored.length > 1 && (
              <span className="text-ink-3">
                {" "}
                or {row.stored.slice(1).join(", ")}
              </span>
            )}
          </p>
        )}
      </div>
      {row.status === "wrong" ? (
        <DecisionMenu<Decision>
          label={`Your list for ${row.a}${row.b}`}
          value={decision}
          safe="keep"
          onChange={onDecide}
          options={[
            {
              value: "keep",
              short: "Keep saved",
              label: `Keep ${row.stored[0]}`,
            },
            {
              value: "replace",
              short: "Use mine",
              label: `Use ${row.typed} instead`,
            },
            {
              value: "alternate",
              short: "Add as alt",
              label: `Add ${row.typed} as alternate`,
            },
          ]}
        />
      ) : row.status === "new" ? (
        <DecisionMenu<Decision>
          label={`Save a word for ${row.a}${row.b}`}
          value={decision}
          safe="keep"
          onChange={onDecide}
          options={[
            { value: "keep", short: "Don’t save", label: "Don’t save" },
            { value: "save", short: "Save", label: `Save ${word}` },
          ]}
          suggest={{
            first: row.a,
            second: row.b,
            current: word,
            onPick: onChoose,
          }}
        />
      ) : (
        <span />
      )}
    </li>
  );
}

function StatusMark({ status }: { status: FullRow["status"] }) {
  const cls = "mt-[3px] shrink-0";
  if (status === "main" || status === "alternate")
    return (
      <CheckIcon
        size={13}
        strokeWidth={2}
        className={`${cls} text-ink-3`}
        aria-label="Correct"
      />
    );
  if (status === "new")
    return (
      <PlusIcon
        size={13}
        strokeWidth={2}
        className={`${cls} text-ink-2`}
        aria-label="New"
      />
    );
  const label =
    status === "extra" ? "Extra" : status === "wrong" ? "Wrong" : "Missing";
  return (
    <XIcon
      size={13}
      strokeWidth={2.25}
      className={`${cls} text-danger`}
      aria-label={label}
    />
  );
}

function Tag({
  children,
  error,
}: {
  children: React.ReactNode;
  error?: boolean;
}) {
  return (
    <span
      className={`shrink-0 text-[11.5px] ${error ? "font-medium text-danger" : "text-ink-2"}`}
    >
      {children}
    </span>
  );
}

function TrailingRow({ token }: { token: string }) {
  return (
    <li className={ROW}>
      <span />
      <span className="pt-px font-mono text-[14px] tracking-[0.1em] text-ink-3">
        {token}
      </span>
      <span className="text-[12.5px] text-ink-3">Single target, no word</span>
      <span />
    </li>
  );
}
