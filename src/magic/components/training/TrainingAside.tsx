import React, { useMemo } from "react";
import { VirtualHistory } from "../common/VirtualHistory";
import { CheckIcon, XIcon } from "lucide-react";
import { clamp, useElementSize } from "../../hooks/useElementSize";
import { TrainingSession } from "../../hooks/useTrainingSession";
import { SOLVED_STATE } from "../../utils/bld";
import { formatTime } from "../../utils/time";
import { HistoryHeader, RowDelete } from "../common/HistoryHeader";
import { Cube3D } from "../cube/Cube3D";
import { SessionReadout } from "../practice/SessionReadout";

/**
 * Reference column on wide screens, as on the Timer: a cube where one helps (Memo Recall's
 * challenge, Execution Sprint's scramble to check against), the readout, and attempts.
 */
export function TrainingAside({
  t,
  onClear,
  recede = "",
  className = "",
}: {
  t: TrainingSession;
  onClear: () => void;
  /** Fades the readout and attempts while an attempt runs. The cube has its own state-driven look. */ recede?: string;
  className?: string;
}) {
  const [boxRef, box] = useElementSize<HTMLDivElement>({
    width: 340,
    height: 300,
  });
  const cubeSize = clamp(Math.min(box.width - 64, box.height - 40), 140, 260);
  const h = t.history;
  const n = h.length;
  const { mean, correct } = useMemo(
    () => ({
      mean: n ? h.reduce((sum, attempt) => sum + attempt.ms, 0) / n : 0,
      correct: h.filter((attempt) => attempt.correct).length,
    }),
    [h, n],
  );
  const cells: [string, string][] = [
    ["attempts", String(n)],
    [
      t.mode === "exec" || t.mode === "guided" ? "solved" : "correct",
      `${correct}/${n}`,
    ],
    [
      t.mode === "recall"
        ? "mean memo"
        : t.mode === "trace"
          ? "mean trace"
          : t.mode === "guided"
            ? "mean total"
            : "mean exec",
      n ? formatTime(mean) : "—",
    ],
  ];

  // The cube's look is derived from the phase every render, so no dim can outlive its state.
  //   idle   → a normal solved cube (the challenge stays hidden until you start)
  //   study  → the challenge cube, full strength
  //   recall → dimmed, so it can't help you remember
  //   review → the challenge cube, full strength again
  const cube =
    t.mode === "recall"
      ? t.phase === "idle"
        ? {
            state: SOLVED_STATE,
            dim: "",
            label: "Solved cube. The challenge appears when you start",
          }
        : {
            state: t.challenge.state,
            dim: t.phase === "recall" ? "opacity-[0.08]" : "",
            label: "The cube this memo was traced from",
          }
      : (t.mode === "exec" || t.mode === "guided") && t.phase === "idle"
        ? {
            state: t.challenge.state,
            dim: t.scrambleReady ? "" : "opacity-25",
            label: "Your cube after this scramble",
          }
        : null;

  return (
    <aside
      className={`hidden min-h-0 flex-col border-l border-line bg-surface xl:flex ${className}`}
    >
      {cube && (
        <div
          ref={boxRef}
          className={`flex h-[clamp(200px,36vh,330px)] shrink-0 items-center justify-center border-b border-line transition-opacity duration-200 ease-out ${cube.dim}`}
        >
          <Cube3D state={cube.state} size={cubeSize} label={cube.label} />
        </div>
      )}
      <div
        className={`flex min-h-0 flex-1 flex-col transition-opacity duration-300 ease-out ${recede}`}
      >
        <SessionReadout cells={cells} />
        <HistoryHeader label="Attempts" count={n} onClear={onClear} />
        <VirtualHistory
          label="Attempts"
          items={h}
          rowHeight={36}
          empty="No attempts yet"
          renderItem={(a, i) => (
            <>
              <div className="grid grid-cols-[30px_20px_1fr_auto] items-center py-[7px] pl-5 pr-10">
                <span
                  className={`font-mono text-[10.5px] tnum ${i === 0 ? "text-accent" : "text-ink-3"}`}
                >
                  {n - i}
                </span>
                {a.correct ? (
                  <CheckIcon
                    size={13}
                    className="text-ink-3"
                    aria-label={
                      t.mode === "exec" || t.mode === "guided"
                        ? "solved"
                        : "correct"
                    }
                  />
                ) : (
                  <XIcon
                    size={13}
                    className="text-accent"
                    aria-label={
                      t.mode === "exec" || t.mode === "guided"
                        ? "DNF"
                        : "incorrect"
                    }
                  />
                )}
                <span
                  className={`font-mono text-[14.5px] tnum ${i === 0 ? "text-ink" : "text-ink-2"}`}
                >
                  {(t.mode === "exec" || t.mode === "guided") && !a.correct
                    ? "DNF"
                    : formatTime(a.ms)}
                </span>
                <span className="font-mono text-[11px] text-ink-3 tnum">
                  {t.mode === "guided" || t.mode === "exec"
                    ? `${a.pairs ?? 0} pairs`
                    : a.targets}
                </span>
              </div>
              <RowDelete
                label={`Delete attempt ${n - i}`}
                onClick={() => t.removeAttempt(a.id)}
              />
            </>
          )}
        />
      </div>
    </aside>
  );
}
