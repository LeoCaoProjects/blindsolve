import { ScrambleRegion } from "../../solve/ScrambleRegion";
import { useGlobalNavigation } from "../../layout/GlobalNavigation";
import React, { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { CaseSensitiveIcon, RefreshCwIcon } from "lucide-react";
import { useAppData } from "../../../contexts/AppDataContext";
import { clamp, useElementSize } from "../../../hooks/useElementSize";
import { useHistoryCleanup } from "../../../hooks/useHistoryCleanup";
import { useTimerSession } from "../../../hooks/useTimerSession";
import { ConceptProps } from "../../../types/solve";
import { formatTime } from "../../../utils/time";
import { IconButton } from "../../common/IconButton";
import { ShortcutSheet } from "../../common/ShortcutSheet";
import { Cube3D } from "../../cube/Cube3D";
import { ScrambleText } from "../../solve/ScrambleText";
import { TIMER_MODES } from "../../../utils/timerModes";
import { TimerReadout } from "../../solve/TimerReadout";
import { TimerModeControl } from "../../timer/TimerModeControl";
import { TimerMemoFooter } from "../../timer/TimerMemoFooter";
import { TimerPhaseCue } from "../../timer/TimerPhaseCue";
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
  multiphase: _multiphase,
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
      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)_minmax(128px,25dvh)] md:grid-cols-[minmax(0,1fr)_clamp(280px,28vw,392px)] md:grid-rows-1">
        <main className="flex min-h-0 min-w-0 flex-col">
          <section
            aria-label="Scramble"
            className={`timer-workspace-inset relative flex shrink-0 items-start gap-3 border-b border-line pb-8 pt-5 transition-opacity duration-300 ease-out md:pb-9 md:pt-6 ${
              s.running ? "opacity-25" : ""
            }`}
          >
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
                </>
              )}
            </ScrambleRegion>
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
              className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] focus-visible:outline focus-visible:outline-1 focus-visible:outline-accent text-ink-3 transition-colors duration-150 ease-out hover:bg-hover hover:text-ink-2 disabled:cursor-wait disabled:opacity-40"
            >
              <RefreshCwIcon size={14} strokeWidth={1.75} />
            </button>
            {s.scrambleError && s.scramble && (
              <span
                role="alert"
                className="absolute bottom-2 left-6 text-[11px] text-danger md:left-24"
              >
                New scramble failed
              </span>
            )}
          </section>

          <div
            className="timer-workspace-inset relative flex min-h-0 flex-1 cursor-default touch-none select-none flex-col justify-center overflow-hidden"
            {...s.timer.pointerHandlers}
          >
            <div className="[container-type:inline-size]" data-timer-clock>
              <TimerReadout
                phase={phase}
                value={s.timer.display}
                showLiveTimer={showLiveTimer}
                penalty={s.lastPenalty}
                className={`-ml-[0.06em] font-timer text-[clamp(48px,min(18cqw,19vh),176px)] font-extralight leading-[0.9] tracking-[-0.06em] ${phase === "exec" ? "timer-execution-cue" : ""}`}
              />

              <TimerPhaseCue phase={phase} />
            </div>
          </div>

          <TimerMemoFooter
            latest={latest}
            mode={s.timerMode}
            memoOrder={prefs.memoOrder}
            className={recede}
          />
        </main>

        <aside
          className={`flex min-h-0 flex-col border-t border-line bg-surface transition-opacity duration-300 ease-out md:border-l md:border-t-0 ${recede}`}
        >
          <div className="flex h-8 shrink-0 flex-col border-b border-line md:h-[clamp(170px,36vh,330px)]">
            <div
              role="group"
              aria-label="Timer utilities"
              className="flex h-8 shrink-0 items-center justify-end px-3"
            >
              <TimerModeControl
                value={s.timerMode}
                onChange={s.setTimerMode}
                disabled={
                  s.running ||
                  s.overlayOpen ||
                  phase === "armed" ||
                  phase === "ready"
                }
              />
            </div>
            <div
              ref={cubeRef}
              className="relative hidden min-h-0 flex-1 items-center justify-center md:flex"
            >
              <Cube3D
                state={s.cubeState}
                size={cubeSize}
                showLetters={letters}
              />
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
