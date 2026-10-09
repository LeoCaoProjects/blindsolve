import React, { useRef } from "react";
import { AnimatePresence } from "framer-motion";
import { clamp } from "../../hooks/useElementSize";
import { TrainingSession } from "../../hooks/useTrainingSession";
import { Cube3D } from "../cube/Cube3D";
import { RecallInput } from "../memo/RecallInput";
import { SequenceView } from "../memo/SequenceView";
import { Fade } from "./Fade";

const LABEL = { corners: "Corners", edges: "Edges" } as const;

/**
 * Study the memo traced from the cube, then recall it.
 * The cube lives in the side column on wide screens and inline otherwise — always the same state.
 */
export function MemoRecallWorkspace({
  t,
  stage,
}: {
  t: TrainingSession;
  stage: { width: number; height: number };
}) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const multi = t.groups.length > 1;
  const recalling = t.phase === "recall";
  const inlineCube = clamp(
    Math.min(stage.width * 0.28, stage.height * 0.55),
    120,
    240,
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-6 md:flex-row md:items-center md:gap-10">
      <div className="scroll-quiet min-h-0 min-w-0 flex-1 overflow-y-auto py-2 md:max-h-full md:pl-14">
        <AnimatePresence mode="wait" initial={false}>
          {!recalling ? (
            <Fade
              key={`study-${t.challenge.seed}`}
              className="grid gap-[clamp(20px,5vh,40px)]"
            >
              {t.groups.map((g) => (
                <section key={g.piece}>
                  {multi && (
                    <h2 className="mb-3 text-[12px] text-ink-3">
                      {LABEL[g.piece]}
                    </h2>
                  )}
                  <SequenceView tokens={g.tokens} size="xl" />
                </section>
              ))}
            </Fade>
          ) : (
            <Fade
              key="recall"
              className="grid max-w-[880px] gap-[clamp(20px,5vh,40px)]"
            >
              {t.groups.map((g, gi) => (
                <section key={g.piece}>
                  {multi && (
                    <h2 className="mb-3 text-[12px] text-ink-3">
                      {LABEL[g.piece]}
                    </h2>
                  )}
                  <RecallInput
                    ref={(el) => {
                      inputRefs.current[gi] = el;
                    }}
                    autoFocus={gi === 0}
                    label={`Recall ${LABEL[g.piece].toLowerCase()}`}
                    tokens={t.vocabulary}
                    value={t.inputs[gi] ?? ""}
                    onChange={(v) => t.setInput(gi, v)}
                    onEnter={() =>
                      gi < t.groups.length - 1
                        ? inputRefs.current[gi + 1]?.focus()
                        : t.submit()
                    }
                  />
                </section>
              ))}
            </Fade>
          )}
        </AnimatePresence>
      </div>
      <div
        className={`order-first flex shrink-0 justify-center transition-opacity duration-200 ease-out md:order-none xl:hidden ${recalling ? "opacity-[0.08]" : ""}`}
      >
        <Cube3D
          state={t.challenge.state}
          size={inlineCube}
          label="The cube this memo was traced from"
        />
      </div>
    </div>
  );
}
