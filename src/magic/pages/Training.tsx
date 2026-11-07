import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { ShortcutSheet } from "../components/common/ShortcutSheet";
import { AppBar } from "../components/layout/AppBar";
import { ExecutionWorkspace } from "../components/training/ExecutionWorkspace";
import { Fade } from "../components/training/Fade";
import {
  GuidedSolveWorkspace,
  GuidedSolveExecution,
} from "../components/training/GuidedSolveWorkspace";
import { MemoRecallWorkspace } from "../components/training/MemoRecallWorkspace";
import { GuidedSolveReview } from "../components/training/review/GuidedSolveReview";
import { ExecutionSprintAttemptDetails } from "../components/training/review/ExecReview";
import { RecallReview } from "../components/training/review/RecallReview";
import { TraceReview } from "../components/training/review/TraceReview";
import { TraceSprintWorkspace } from "../components/training/TraceSprintWorkspace";
import { TrainingDock } from "../components/training/TrainingDock";
import { TrainingHelp } from "../components/training/TrainingHelp";
import {
  TrainingIdle,
  TRAINING_STAGE,
} from "../components/training/TrainingIdle";
import { modeInfo } from "../data/trainingModes";
import { recordTraining } from "../utils/feedbackContext";
import { useElementSize } from "../hooks/useElementSize";
import { useHistoryCleanup } from "../hooks/useHistoryCleanup";
import { useShortcutSheet } from "../hooks/useShortcutSheet";
import { useSessionWorkspace } from "../contexts/SessionWorkspaceContext";
import { isTypingTarget } from "../utils/keyboard";
import { formatTime } from "../utils/time";
import { useScreenInit } from "../useScreenInit.js";

/**
 * One practice instrument, four drills.
 * Layout contract: header (drill · settings) / stage (flexible, scrolls inside) / dock (fixed, inset).
 * During active drills the side column steps away so the
 * cube and answer get the room. Reviews open in a right-hand sheet over the frozen stage.
 */
export function Training() {
  const init = useScreenInit();
  const sheet = useShortcutSheet();
  const { training: t } = useSessionWorkspace();
  // Drill and pieces only, for bug reports. Never answers or mnemonics.
  useEffect(() => {
    recordTraining(
      modeInfo(t.mode).label,
      t.filter === "both" ? "Both" : t.filter === "edges" ? "Edges" : "Corners",
    );
  }, [t.mode, t.filter]);
  const [stageRef, stage] = useElementSize<HTMLDivElement>({
    width: 900,
    height: 560,
  });
  const stableStage = useRef(stage);
  if (t.phase !== "review") stableStage.current = stage;
  const [helpOpen, setHelpOpen] = useState(!!init.help);

  const busy = t.running;
  const holding = t.hold.phase !== "idle";
  const executionSetup =
    (t.mode === "exec" || t.mode === "guided" || t.mode === "trace") &&
    t.phase === "idle";
  const latest = t.history[0];
  const completedExecution =
    t.mode === "exec" && t.phase === "review"
      ? t.history.find((attempt) => attempt.id === t.reviewAttemptId)
      : undefined;

  const cleanup = useHistoryCleanup({
    count: t.history.length,
    noun: "attempt",
    scope: modeInfo(t.mode).label,
    latestLabel: latest
      ? (t.mode === "exec" || t.mode === "trace") && !latest.correct
        ? "DNF"
        : formatTime(latest.ms)
      : undefined,
    removeLatest: t.removeLatestAttempt,
    clearAll: t.clearAttempts,
    keysEnabled: t.phase === "idle" && !holding && !helpOpen,
  });

  // N swaps an execution-oriented scramble before starting, as on the Timer.
  useEffect(() => {
    if (!executionSetup) return;
    const onKey = (e: KeyboardEvent) => {
      if (
        (e.key !== "n" && e.key !== "N") ||
        isTypingTarget(e.target) ||
        e.metaKey ||
        e.ctrlKey ||
        e.repeat ||
        !t.scrambleReady
      )
        return;
      if (document.querySelector('[role="dialog"], [role="alertdialog"]'))
        return;
      t.newScramble();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [executionSetup, t]);

  const stopHandlers =
    t.mode === "exec" && t.phase === "active"
      ? {
          onPointerDown: (e: React.PointerEvent) => {
            if ((e.target as HTMLElement).closest("button, a, input")) return;
            t.submit();
          },
        }
      : {};

  return (
    <div
      data-training-challenge-id={t.challengeId}
      className="relative flex h-full w-full flex-col overflow-hidden bg-bg font-sans text-ink"
    >
      <AppBar
        className={
          busy ? "opacity-[0.25]" : t.hold.phase === "ready" ? "opacity-40" : ""
        }
        onShortcuts={sheet.openSheet}
      />

      <div className="flex min-h-0 flex-1 flex-col">
        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div
            className={`${TRAINING_STAGE} ${
              t.phase === "idle" ? "cursor-default touch-none select-none" : ""
            }`}
            {...(t.phase === "idle" ? t.hold.pointerHandlers : stopHandlers)}
          >
            <div
              ref={t.phase === "idle" ? undefined : stageRef}
              className="flex min-h-0 flex-1 flex-col justify-center"
            >
              <>
                {t.phase === "idle" ? (
                  <Fade
                    key="idle"
                    className="scroll-quiet max-h-full overflow-y-auto"
                  >
                    <TrainingIdle t={t} onHelp={() => setHelpOpen(true)} />
                  </Fade>
                ) : (
                  <Fade key={`run-${t.mode}`} className="h-full min-h-0">
                    {t.mode === "recall" && <MemoRecallWorkspace t={t} />}
                    {t.mode === "exec" && <ExecutionWorkspace t={t} />}
                    {t.mode === "trace" && (
                      <TraceSprintWorkspace t={t} stage={stableStage.current} />
                    )}
                    {t.mode === "guided" && t.phase === "memo" && (
                      <GuidedSolveWorkspace t={t} />
                    )}
                  </Fade>
                )}
              </>
            </div>
          </div>

          <TrainingDock t={t} />
        </main>
      </div>

      {t.mode === "guided" && t.phase !== "idle" && t.phase !== "memo" && (
        <GuidedSolveExecution t={t} />
      )}
      <AnimatePresence>
        {completedExecution && (
          <ExecutionSprintAttemptDetails
            key={completedExecution.id}
            attempt={completedExecution}
            session={t}
          />
        )}
        {t.phase === "review" && t.mode === "recall" && (
          <RecallReview key="recall" t={t} />
        )}
        {t.phase === "review" && t.mode === "trace" && (
          <TraceReview key="trace" t={t} />
        )}
        {(t.phase === "report" || t.phase === "review") &&
          t.mode === "guided" && <GuidedSolveReview key="guided" t={t} />}
      </AnimatePresence>
      <TrainingHelp
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        mode={t.mode}
      />
      <ShortcutSheet
        open={sheet.open}
        onClose={sheet.closeSheet}
        page="training"
        trainingMode={t.mode}
      />
      {cleanup.dialog}
    </div>
  );
}
