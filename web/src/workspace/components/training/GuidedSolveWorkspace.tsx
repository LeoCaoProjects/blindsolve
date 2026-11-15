import React from "react";
import { TrainingSession } from "../../hooks/useTrainingSession";
import { ExecutionWorkspace } from "./ExecutionWorkspace";
import { TrainingIdle, TRAINING_STAGE } from "./TrainingIdle";
import { TrainingDock } from "./TrainingDock";
import { WorkspaceScrambleHeader } from "../workspace/WorkspaceScrambleHeader";

export function GuidedSolveWorkspace({ t }: { t: TrainingSession }) {
  return (
    <ExecutionWorkspace
      t={t}
      elapsed={t.elapsed.memo}
      active
      timerLabel="Memorisation"
    />
  );
}

/** Reuse the complete idle layout as the execution anchor. The invisible scramble,
 * description and dock retain their normal responsive geometry; only the readout
 * and phase cue are visible. No measurements or remembered screen coordinates. */
export function GuidedSolveExecution({ t }: { t: TrainingSession }) {
  return (
    <div
      data-guided-execution-anchor
      className="pointer-events-none invisible absolute inset-0 flex min-h-0 flex-col"
    >
      <WorkspaceScrambleHeader
        scramble={t.scramble}
        pending={false}
        error={false}
        disabled
        onNewScramble={() => {}}
      />
      <div className="flex min-h-0 flex-1 flex-col">
        <div className={TRAINING_STAGE}>
          <div className="flex min-h-0 flex-1 flex-col justify-center">
            <div className="scroll-quiet max-h-full overflow-y-auto">
              <TrainingIdle t={t} execution onHelp={() => {}} />
            </div>
          </div>
        </div>
        <TrainingDock t={t} />
      </div>
    </div>
  );
}
