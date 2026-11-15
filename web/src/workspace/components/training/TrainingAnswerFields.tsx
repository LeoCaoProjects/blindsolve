import React, { useRef } from "react";
import { TrainingSession } from "../../hooks/useTrainingSession";
import { PrimaryButton } from "../common/PrimaryButton";
import { RecallInput } from "../memo/RecallInput";
const LABEL = { corners: "Corners", edges: "Edges" } as const;

/** Shared timed answer entry, including Enter progression and the attached Submit action. */
export function TrainingAnswerFields({
  t,
  active,
  labelPrefix,
}: {
  t: TrainingSession;
  active: boolean;
  labelPrefix: string;
}) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  return (
    <div
      className="grid w-full min-w-0 max-w-[880px] gap-5"
      style={{ padding: "max(0.375rem, 4px)" }}
    >
      <div className="grid min-w-0 gap-[clamp(20px,5vh,40px)]">
        {t.groups.map((group, index) => (
          <RecallInput
            key={group.piece}
            ref={(el) => {
              inputRefs.current[index] = el;
            }}
            autoFocus={index === 0}
            className="min-w-0"
            label={`${labelPrefix} ${LABEL[group.piece].toLowerCase()}`}
            tokens={t.vocabulary}
            value={t.inputs[index] ?? ""}
            onChange={(value) => t.setInput(index, value)}
            onEnter={() =>
              index < t.groups.length - 1
                ? inputRefs.current[index + 1]?.focus()
                : t.submit()
            }
          />
        ))}
      </div>
      {active && (
        <div className="flex">
          <PrimaryButton onClick={t.submit} hint="">
            Submit
          </PrimaryButton>
        </div>
      )}
    </div>
  );
}
