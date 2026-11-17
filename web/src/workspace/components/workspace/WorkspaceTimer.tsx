import { useGlobalNavigation } from "../layout/GlobalNavigation";
import React from "react";
import { timingClass, timingVisual } from "../../utils/timingInteraction";
import { AnimatePresence } from "framer-motion";
import { useAppData } from "../../contexts/AppDataContext";
import { useHistoryCleanup } from "../../hooks/useHistoryCleanup";
import type { TimerSession } from "../../hooks/useTimerSession";
import { formatTime } from "../../utils/time";
import { ShortcutSheet } from "../common/ShortcutSheet";
import { TIMER_MODES } from "../../utils/timerModes";
import { TimerReadout } from "../solve/TimerReadout";
import { TimerMemoFooter } from "../timer/TimerMemoFooter";
import { TimerPhaseCue } from "../timer/TimerPhaseCue";
import { WorkspaceReconstruction } from "./WorkspaceReconstruction";
import { WorkspaceSolveDetails } from "./WorkspaceSolveDetails";

/**
 * Workspace Timer.
 * An asymmetric instrument panel: the working surface at left (scramble, time, last memo),
 * a reference column at right (cube, session readout, times). Hairlines, no cards.
 * Sizes follow the viewport (clamp on vw/vh) so zoom and short windows keep everything reachable.
 */
export function WorkspaceTimer({
  showLiveTimer,
  session,
}: {
  showLiveTimer: boolean;
  session: TimerSession;
}) {
  const s = session;
  const { prefs } = useAppData();
  const modeName = TIMER_MODES.find(
    (mode) => mode.value === s.timerMode,
  )?.label ?? "3BLD";
  const { phase } = s.timer;
  const visual = timingVisual(phase, s.running);
  const recede = timingClass(visual);
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
    <div data-timing-visual={visual} className="theme-workspace flex h-full w-full flex-col overflow-hidden bg-bg font-sans text-ink">
      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
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
