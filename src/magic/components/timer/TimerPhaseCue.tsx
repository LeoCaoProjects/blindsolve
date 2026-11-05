import { motion, useReducedMotion } from "framer-motion";
import type { TimerPhase } from "../../hooks/useTimer";

/** Presentation only: the timer's Space handler remains synchronous and unchanged. */
export function TimerPhaseCue({ phase }: { phase: TimerPhase }) {
  const reduced = useReducedMotion();
  const label =
    phase === "memo"
      ? "Memorising"
      : phase === "exec"
        ? "Executing"
        : phase === "running"
          ? "Solving"
          : "";
  return (
    <div className="relative mt-4 h-5" aria-live="polite" aria-atomic="true">
      <motion.p
        key={phase}
        initial={reduced ? false : { opacity: 0.35, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduced ? 0 : 0.16, ease: "easeOut" }}
        className={`absolute left-0 top-0 text-[13px] ${phase === "exec" ? "text-accent" : "text-ink-3"}`}
      >
        {label}
      </motion.p>
    </div>
  );
}
