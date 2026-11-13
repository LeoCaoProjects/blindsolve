import React, { useRef } from "react";
import { TrainingSession } from "../../hooks/useTrainingSession";
import { RecallInput } from "../memo/RecallInput";
import { SplitStage } from "./SplitStage";
import { CompactTrainingTimer } from "./CompactTrainingTimer";
import { PrimaryButton } from "../common/PrimaryButton";

const LABEL = { corners: "Corners", edges: "Edges" } as const;

/** Read the cube, type the targets. Recognition and tracing speed, not memory. */
export function TraceSprintWorkspace({
  t,
  stage,
}: {
  t: TrainingSession;
  stage: { width: number; height: number };
}) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const locked = t.phase !== "active";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1">
        <SplitStage
          state={t.challenge.state}
          stage={stage}
          cubeHeading={
            <CompactTrainingTimer
              value={t.elapsed.total}
              phase={locked ? "stopped" : "running"}
              label="Trace"
            />
          }
        >
          <div
            className={`grid gap-5 ${t.groups.length > 1 && stage.width < 900 ? "sm:grid-cols-2 sm:gap-x-6" : ""}`}
          >
            {t.groups.map((g, gi) => (
              <RecallInput
                key={g.piece}
                ref={(el) => {
                  inputRefs.current[gi] = el;
                }}
                compact
                caption={LABEL[g.piece]}
                autoFocus={gi === 0 && !locked}
                label={`${LABEL[g.piece]} targets`}
                tokens={t.vocabulary}
                value={t.inputs[gi] ?? ""}
                onChange={(v) => !locked && t.setInput(gi, v)}
                onEnter={() =>
                  gi < t.groups.length - 1
                    ? inputRefs.current[gi + 1]?.focus()
                    : t.submit()
                }
              />
            ))}
          </div>
          {!locked && (
            <div className="mt-5 flex">
              <PrimaryButton onClick={t.submit} hint="">
                Submit
              </PrimaryButton>
            </div>
          )}
        </SplitStage>
      </div>
    </div>
  );
}
