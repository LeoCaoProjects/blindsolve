import { ScrambleRegion } from "../../solve/ScrambleRegion";
import { useGlobalNavigation } from "../../layout/GlobalNavigation";
import React, { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { CaseSensitiveIcon, RefreshCwIcon } from "lucide-react";
import { useAppData } from "../../../contexts/AppDataContext";
import { clamp, useElementSize } from "../../../hooks/useElementSize";
import { useHistoryCleanup } from "../../../hooks/useHistoryCleanup";
import { useTimerSession } from "../../../hooks/useTimerSession";
import { TimerPhase } from "../../../hooks/useTimer";
import { ConceptProps } from "../../../types/solve";
import { formatTime } from "../../../utils/time";
import { IconButton } from "../../common/IconButton";
import { ShortcutSheet } from "../../common/ShortcutSheet";
import { Cube3D } from "../../cube/Cube3D";
import { MemoTrace } from "../../solve/MemoTrace";
import { ScrambleText } from "../../solve/ScrambleText";
import { Segmented } from "../../common/Segmented";
import { TIMER_MODES } from "../../../utils/timerModes";
import { SolveBreakdown } from "../../solve/SolveSummary";
import { SolveTime } from "../../solve/SolveTime";
import { TimerReadout } from "../../solve/TimerReadout";
import { WorkspaceHistory } from "./WorkspaceHistory";
import { WorkspaceReconstruction } from "./WorkspaceReconstruction";
import { WorkspaceSolveDetails } from "./WorkspaceSolveDetails";
import { useScreenInit } from "../../../useScreenInit.js";

/**
 * Workspace Timer.
 * An asymmetric instrument panel: the working surface at left (scramble, time, last memo),
 * a reference column at right (cube, session readout, times). Hairlines, no cards.
 * Sizes follow the viewport (clamp on vw/vh) so zoom and short windows keep everything reachable.
 */
export function WorkspaceTimer({
  multiphase,
  showLiveTimer,
  stage: _stage,
  session,
}: ConceptProps & {
  showLiveTimer: boolean;
  session: ReturnType<typeof useTimerSession>;
}) {
  const init = useScreenInit() as {
    sessions?: "open" | "confirm";
    letters?: boolean;
  };
  const s = session;
  const { prefs } = useAppData();
  const modeName = TIMER_MODES.find(
    (mode) => mode.value === s.timerMode,
  )!.label;
  const [letters, setLetters] = useState(!!init.letters);
  const [cubeRef, cubeBox] = useElementSize<HTMLDivElement>({
    width: 392,
    height: 330,
  });
  const cubeSize = clamp(
    Math.min(cubeBox.width - 56, cubeBox.height - 36),
    120,
    272,
  );
  const { phase } = s.timer;
  const recede = s.running
    ? "opacity-[0.1]"
    : phase === "ready"
      ? "opacity-40"
      : "";
  const latest = s.latest;
  useGlobalNavigation({ className: recede, onShortcuts: s.openShortcuts });
  const pieceOrder =
    prefs.memoOrder === "edges-first"
      ? (["edges", "corners"] as const)
      : (["corners", "edges"] as const);
  const latestMemo = latest
    ? pieceOrder
        .filter((piece) => s.timerMode === "3bld" || s.timerMode === piece)
        .map((piece) => ({ piece, memo: latest.memo[piece] }))
    : [];
  const cleanup = useHistoryCleanup({
    count: s.solves.length,
    noun: "solve",
    scope: modeName,
    latestLabel: latest
      ? `#${latest.index} · ${latest.penalty === "dnf" ? "DNF" : formatTime(latest.time)}`
      : undefined,
    removeLatest: s.deleteLatest,
    clearAll: s.clearSolves,
    keysEnabled:
      !s.running && !s.overlayOpen && phase !== "armed" && phase !== "ready",
  });

  return (
    <div className="theme-workspace flex h-full w-full flex-col overflow-hidden bg-bg font-sans text-ink">
      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)_minmax(0,32dvh)] md:grid-cols-[minmax(0,1fr)_clamp(280px,28vw,392px)] md:grid-rows-1">
        <main className="flex min-h-0 min-w-0 flex-col">
          <section
            aria-label="Scramble"
            className={`shrink-0 border-b border-line px-5 py-3 transition-opacity duration-300 ease-out md:px-10 ${
              s.running ? "opacity-25" : ""
            }`}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <Segmented
                label="Timer mode"
                size="sm"
                value={s.timerMode}
                onChange={s.setTimerMode}
                options={TIMER_MODES.map((mode) => ({
                  ...mode,
                  disabled:
                    s.running ||
                    s.overlayOpen ||
                    phase === "armed" ||
                    phase === "ready",
                }))}
              />
              <button
                type="button"
                onClick={s.newScramble}
                disabled={
                  s.running ||
                  s.scramblePending ||
                  s.overlayOpen ||
                  phase === "armed" ||
                  phase === "ready"
                }
                aria-busy={s.scramblePending}
                aria-label="New scramble"
                title="New scramble"
                className="mt-0.5 inline-flex h-8 shrink-0 items-center gap-2 rounded-[4px] px-2 text-ink-3 transition-colors duration-150 ease-out hover:bg-hover hover:text-ink-2 disabled:cursor-wait disabled:opacity-40"
              >
                <RefreshCwIcon size={14} strokeWidth={1.75} />
                <span className="text-[12px]">New scramble</span>
              </button>
            </div>
            <ScrambleRegion>
              {s.scramblePending ? (
                <p
                  role="status"
                  className="min-w-0 flex-1 font-mono text-[clamp(15px,1.45vw,20px)] leading-[1.75] text-ink-3"
                >
                  Preparing scramble…
                </p>
              ) : s.scrambleError && !s.scramble ? (
                <p
                  role="alert"
                  className="min-w-0 flex-1 font-mono text-[clamp(15px,1.45vw,20px)] leading-[1.75] text-danger"
                >
                  Scramble unavailable. Try again.
                </p>
              ) : (
                <>
                  <ScrambleText
                    scramble={s.scramble}
                    className="min-w-0 flex-1 text-[clamp(15px,1.45vw,20px)] leading-[1.75] text-ink"
                  />
                  {s.scrambleError && (
                    <span
                      className="shrink-0 self-center text-[12px] text-danger"
                      role="alert"
                    >
                      New scramble failed
                    </span>
                  )}
                </>
              )}
            </ScrambleRegion>
          </section>

          <div
            className="flex min-h-0 flex-1 cursor-default touch-none select-none flex-col justify-center overflow-hidden px-5 md:px-10"
            {...s.timer.pointerHandlers}
          >
            <div>
              <TimerReadout
                phase={phase}
                value={s.timer.display}
                showLiveTimer={showLiveTimer}
                penalty={s.lastPenalty}
                className="-ml-[0.06em] font-timer text-[clamp(56px,min(12.5vw,19vh),176px)] font-extralight leading-[0.9] tracking-[-0.06em]"
              />

              <WorkspacePhase
                phase={phase}
                split={s.timer.split}
                elapsed={s.timer.elapsed}
                multiphase={multiphase}
                showLiveTimer={showLiveTimer}
              />
            </div>
          </div>

          {latest && (
            <section
              aria-label="Last solve memo"
              style={{
                gridTemplateColumns:
                  s.timerMode === "3bld"
                    ? "auto minmax(0,1fr) minmax(0,1.2fr)"
                    : "auto minmax(0,1fr)",
              }}
              className={`hidden shrink-0 items-start gap-x-[clamp(16px,2.5vw,40px)] border-t border-line px-10 py-[clamp(12px,2.5vh,24px)] transition-opacity duration-300 ease-out md:grid ${recede} short:hidden`}
            >
              <button
                type="button"
                onClick={() => s.selectSolve(latest.id)}
                className="group flex items-baseline gap-4 text-left"
              >
                <span className="text-[12px] text-ink-3">Last memo</span>
                <SolveTime
                  time={latest.time}
                  penalty={latest.penalty}
                  showRaw={false}
                  className="font-mono text-[15px] text-ink-2 transition-colors duration-150 group-hover:text-ink"
                />
              </button>
              {latestMemo.map(({ piece, memo }) => (
                <MemoTrace
                  key={piece}
                  size="sm"
                  pairs={memo.map((p) => p.pair)}
                  words={memo.map((p) => p.word)}
                  breakAt={
                    (piece === "edges"
                      ? latest.memo.edgeBreakAt
                      : latest.memo.cornerBreakAt) ?? null
                  }
                />
              ))}
            </section>
          )}
        </main>

        <aside
          className={`flex min-h-0 flex-col border-t border-line bg-surface transition-opacity duration-300 ease-out md:border-l md:border-t-0 ${recede}`}
        >
          <div
            ref={cubeRef}
            className="relative hidden h-[clamp(170px,36vh,330px)] shrink-0 items-center justify-center border-b border-line md:flex"
          >
            <Cube3D state={s.cubeState} size={cubeSize} showLetters={letters} />
            <IconButton
              size="sm"
              label="Sticker letters"
              pressed={letters}
              onClick={() => setLetters((v) => !v)}
              className="absolute bottom-3 right-3"
            >
              <CaseSensitiveIcon />
            </IconButton>
          </div>
          <WorkspaceHistory
            solves={s.solves}
            stats={s.stats}
            onSelect={s.selectSolve}
            onDelete={s.deleteSolve}
          />
        </aside>
      </div>

      <AnimatePresence>
        {s.reconOpen && s.draft && (
          <WorkspaceReconstruction
            key="recon"
            draft={s.draft}
            db={s.db}
            onSave={s.saveSolve}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {s.selected && (
          <WorkspaceSolveDetails
            key="details"
            solve={s.selected}
            db={s.db}
            onClose={s.closeDetails}
            onPenalty={s.setPenalty}
            onDelete={s.deleteSolve}
          />
        )}
      </AnimatePresence>
      <ShortcutSheet open={s.shortcutsOpen} onClose={s.closeShortcuts} />
      {cleanup.dialog}
    </div>
  );
}

function WorkspacePhase({
  phase,
  split,
  elapsed,
  multiphase,
}: {
  phase: TimerPhase;
  split: number | null;
  elapsed: number;
  multiphase: boolean;
  showLiveTimer: boolean;
}) {
  if (phase === "stopped" && multiphase && split !== null)
    return (
      <SolveBreakdown memo={split} total={elapsed} className="mt-6 max-w-xs" />
    );
  const label =
    phase === "memo"
      ? "Memorising"
      : phase === "exec"
        ? "Executing"
        : phase === "running"
          ? "Solving"
          : "";
  return <p className="mt-5 min-h-5 text-[13px] text-ink-3">{label}</p>;
}
