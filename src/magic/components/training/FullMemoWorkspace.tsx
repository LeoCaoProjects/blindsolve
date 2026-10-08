import React, { useRef } from "react";
import { TrainingSession } from "../../hooks/useTrainingSession";
import { SplitStage } from "./SplitStage";
import { WordChainInput } from "./WordChainInput";
import { M2ParityNotice } from "../memo/M2ParityNotice";

const LABEL = { corners: "Corners", edges: "Edges" } as const;

/** Trace the cube and write the memo as words. Pairs are only revealed at review. */
export function FullMemoWorkspace({
  t,
  stage,
}: {
  t: TrainingSession;
  stage: { width: number; height: number };
}) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const locked = t.phase !== "active";

  return (
    <SplitStage state={t.challenge.state} stage={stage}>
      <div className="grid gap-5">
        {t.groups.map((g, gi) => (
          <WordChainInput
            key={g.piece}
            ref={(el) => {
              inputRefs.current[gi] = el;
            }}
            caption={LABEL[g.piece]}
            autoFocus={gi === 0 && !locked}
            label={`${LABEL[g.piece]} memo`}
            words={t.words[gi] ?? []}
            onChange={(w) => !locked && t.setGroupWords(gi, w)}
            onAdvance={() =>
              gi < t.groups.length - 1
                ? inputRefs.current[gi + 1]?.focus()
                : t.submit()
            }
          />
        ))}
        {t.challenge.m2Parity && <M2ParityNotice />}
      </div>
    </SplitStage>
  );
}
