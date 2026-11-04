import React, { useRef, useState } from "react";
import { ChevronDownIcon } from "lucide-react";
import { trainingModes } from "../../data/trainingModes";
import { TrainingSession } from "../../hooks/useTrainingSession";
import { formatTime } from "../../utils/time";
import { OptionGroup } from "../common/OptionGroup";

// Presentation from the retained Magic Patterns ModeList and Training page.
// Help content continues to use the existing production components.
const lines = {
  exec: "Execute physically from given memo",
  guided: "Full solve with tracing done for you",
  recall: "Memorise targets, then type them back",
  trace: "Read a scrambled cube into targets",
};
export function TrainingHeader({ t }: { t: TrainingSession }) {
  const busy = t.running || t.phase === "report" || t.phase === "review";
  const [expanded, setExpanded] = useState(false);
  const pieceRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <section className="scroll-quiet max-h-[42dvh] shrink-0 overflow-y-auto border-b border-line px-5 py-3 md:px-10">
      <h1 className="mb-2 px-3 text-[12px] font-medium text-ink-3">Training</h1>
      <button
        type="button"
        aria-expanded={expanded}
        aria-label="Choose Training mode"
        disabled={busy}
        onClick={() => setExpanded((value) => !value)}
        className="hidden w-full items-center justify-between rounded-md px-3 py-2 text-left text-[14px] font-medium hover:bg-hover disabled:opacity-40 [@media(max-height:640px)]:flex"
      >
        {trainingModes.find((m) => m.id === t.mode)?.label}
        <ChevronDownIcon size={16} aria-hidden />
      </button>
      <nav aria-label="Drill">
        <div
          role="radiogroup"
          aria-label="Drill"
          aria-disabled={busy || undefined}
          className={`grid grid-cols-2 gap-0.5 lg:grid-cols-4 ${expanded ? "" : "[@media(max-height:640px)]:hidden"}`}
        >
          {trainingModes.map((m, i) => {
            const on = m.id === t.mode;
            return (
              <button
                key={m.id}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                type="button"
                role="radio"
                aria-label={m.label}
                aria-checked={on}
                tabIndex={on ? 0 : -1}
                disabled={busy}
                onClick={() => {
                  t.setMode(m.id);
                  setExpanded(false);
                }}
                onKeyDown={(e) => {
                  if (
                    ![
                      "ArrowRight",
                      "ArrowLeft",
                      "ArrowDown",
                      "ArrowUp",
                    ].includes(e.key) ||
                    busy
                  )
                    return;
                  e.preventDefault();
                  e.stopPropagation();
                  const next =
                    (i +
                      (e.key === "ArrowRight" || e.key === "ArrowDown"
                        ? 1
                        : -1) +
                      trainingModes.length) %
                    trainingModes.length;
                  t.setMode(trainingModes[next].id);
                  refs.current[next]?.focus();
                }}
                className={`min-w-0 rounded-md px-3 py-2.5 text-left transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-35 ${on ? "bg-raised" : "hover:bg-hover"}`}
              >
                <span
                  className={`block text-[14px] font-medium ${on ? "text-ink" : "text-ink-2"}`}
                >
                  {m.label}
                </span>
                <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-3">
                  {lines[m.id]}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 px-3">
        {busy ? (
          <Clock t={t} />
        ) : (
          <>
            <div className="flex items-center gap-3">
              <span className="text-[12px] font-medium text-ink-3">Pieces</span>
              <div
                role="radiogroup"
                aria-label="Pieces"
                className="inline-flex rounded-md border border-line bg-surface p-0.5"
                onKeyDown={(e) => {
                  if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
                  e.preventDefault();
                  e.stopPropagation();
                  const scopes = ["both", "edges", "corners"] as const;
                  const next =
                    (scopes.indexOf(t.filter) +
                      (e.key === "ArrowRight" ? 1 : -1) +
                      scopes.length) %
                    scopes.length;
                  t.setFilter(scopes[next]);
                  pieceRefs.current[next]?.focus();
                }}
              >
                {(["both", "edges", "corners"] as const).map((value, i) => (
                  <button
                    key={value}
                    ref={(el) => {
                      pieceRefs.current[i] = el;
                    }}
                    tabIndex={t.filter === value ? 0 : -1}
                    type="button"
                    role="radio"
                    aria-checked={t.filter === value}
                    onClick={() => t.setFilter(value)}
                    className={`h-7 whitespace-nowrap rounded px-2.5 text-[12px] font-medium transition-colors duration-150 ${t.filter === value ? "bg-ink text-bg" : "text-ink-2 hover:text-ink"}`}
                  >
                    {value === "both"
                      ? "Both"
                      : value === "edges"
                        ? "Edges"
                        : "Corners"}
                  </button>
                ))}
              </div>
            </div>
            {t.mode === "exec" && (
              <OptionGroup
                label="Show"
                value={t.display}
                onChange={t.setDisplay}
                options={[
                  { value: "letters", label: "Letters" },
                  { value: "words", label: "Words" },
                ]}
              />
            )}
          </>
        )}
      </div>
    </section>
  );
}

function Clock({ t }: {t: TrainingSession;}) {
  if (t.mode === 'exec') return null;
  if (t.mode === 'guided') {
    const cells: [string, number, boolean][] = [
    ['memo', t.elapsed.memo, t.phase === 'memo'],
    ...(t.phase === 'execution' || t.phase === 'report' || t.phase === 'review' ?
    [['execution', t.elapsed.execution, t.phase === 'execution']] as [string, number, boolean][] : [])];
    return (
      <p className="flex gap-5 font-mono text-[12px] text-ink-3 tnum" role="timer">
        {cells.map(([label, ms, live]) =>
        <span key={label} className={live ? 'text-ink-2' : ''}>
            {label} <span className="ml-1">{formatTime(ms)}</span>
          </span>
        )}
      </p>);
  }
  const cells: [string, number, boolean][] =
  t.mode === 'recall' ?
  [
  ['memo', t.elapsed.memo, t.phase === 'active'],
  ...(t.phase !== 'active' ? [['recall', t.elapsed.recall, t.phase === 'recall']] as [string, number, boolean][] : [])] :

  [[t.mode === 'trace' ? 'trace' : 'memo', t.elapsed.total, t.phase === 'active']];
  return (
    <p className="flex gap-5 font-mono text-[12px] text-ink-3 tnum" role="timer">
      {cells.map(([label, ms, live]) =>
      <span key={label} className={live ? 'text-ink-2' : ''}>
          {label} <span className="ml-1">{formatTime(ms)}</span>
        </span>
      )}
    </p>);

}
