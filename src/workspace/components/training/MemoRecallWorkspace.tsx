import React from "react";
import { TrainingSession } from "../../hooks/useTrainingSession";
import { TrainingAnswerFields } from "./TrainingAnswerFields";
import { ExecutionWorkspace } from "./ExecutionWorkspace";
import { TrainingTimedStage } from "./TrainingTimedStage";

/** Study uses the shared compact clock/targets. Recall keeps the existing inputs
 * and Enter progression, with its clock in the central stage instead of a header. */
export function MemoRecallWorkspace({ t }: { t: TrainingSession }) {
  if (t.phase === "active")
    return (
      <ExecutionWorkspace
        t={t}
        elapsed={t.elapsed.memo}
        active
        timerLabel="Memorisation"
      />
    );
  return (
    <TrainingTimedStage
      value={t.elapsed.recall}
      phase={t.phase === "recall" ? "running" : "stopped"}
      label="Recall"
      cue={<p className="mt-3 text-[13px] text-ink-3">Recalling</p>}
    >
      <TrainingAnswerFields
        t={t}
        active={t.phase === "recall"}
        labelPrefix="Recall"
      />
    </TrainingTimedStage>
  );
}
