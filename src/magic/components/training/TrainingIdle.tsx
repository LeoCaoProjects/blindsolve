import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { SUB_NAV_EASE } from "../layout/SubNavigation";
import { TimerPhaseCue } from "../timer/TimerPhaseCue";
import { TimerReadout } from "../solve/TimerReadout";
import { useAppData } from "../../contexts/AppDataContext";
import { modeInfo } from "../../data/trainingModes";
import { HoldPhase } from "../../hooks/useHoldStart";
import { TrainingSession } from "../../hooks/useTrainingSession";

export const TRAINING_STAGE =
  "relative flex min-h-0 flex-1 flex-col px-5 py-[clamp(12px,3vh,28px)] md:px-10";

const TONE: Record<HoldPhase, string> = {
  idle: "text-ink",
  armed: "text-ink-3",
  ready: "text-accent",
};

/** The Timer's idle readout plus one sentence about the drill. Nothing about the next challenge shows until release. */
export function TrainingIdle({
  t,
  onHelp,
  execution = false,
}: {
  t: TrainingSession;
  onHelp: () => void;
  execution?: boolean;
}) {
  const { prefs } = useAppData();
  const reduced = useReducedMotion();
  const info = modeInfo(t.mode);
  const hold = t.hold.phase;
  return (
    <motion.div
      layout={execution || reduced ? false : "position"}
      transition={{
        layout: { type: "tween", duration: 0.18, ease: SUB_NAV_EASE },
      }}
      className="md:pl-14"
    >
      <TimerReadout
        phase={
          execution ? (t.phase === "execution" ? "exec" : "stopped") : hold
        }
        value={execution ? t.elapsed.total : 0}
        showLiveTimer={prefs.showLiveTimer}
        ariaLabel={
          execution
            ? "Execution"
            : hold === "ready"
              ? "Ready, release to start"
              : "Hold Space to start"
        }
        className={`tnum -ml-[0.06em] whitespace-nowrap font-timer text-[clamp(64px,min(12.5vw,18vh),176px)] font-extralight leading-[0.9] tracking-[-0.06em] transition-colors duration-150 ease-out ${execution ? `visible text-ink ${t.phase === "execution" ? "timer-execution-cue" : ""}` : TONE[hold]}`}
      />
      {execution && (
        <div className="visible absolute">
          <TimerPhaseCue phase={t.phase === "execution" ? "exec" : "stopped"} />
        </div>
      )}
      <p
        className={`mt-[clamp(14px,3vh,28px)] max-w-[560px] text-[14px] leading-relaxed text-ink-3 ${execution ? "invisible" : ""}`}
      >
        {info.line}{" "}
        <button
          type="button"
          onClick={onHelp}
          onPointerDown={(e) => e.stopPropagation()}
          className="whitespace-nowrap text-ink-2 underline decoration-line-strong underline-offset-4 transition-colors duration-150 ease-out hover:text-ink"
        >
          How it works
        </button>
      </p>
    </motion.div>
  );
}
