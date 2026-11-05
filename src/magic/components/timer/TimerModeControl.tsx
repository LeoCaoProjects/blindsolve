import { TIMER_MODES, type TimerMode } from "../../utils/timerModes";
import { useId } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { EASE_OUT } from "../../utils/keyboard";

/** Training's sliding-choice treatment, scaled down into the scramble header. */
export function TimerModeControl({
  value,
  onChange,
  disabled,
}: {
  value: TimerMode;
  onChange: (mode: TimerMode) => void;
  disabled: boolean;
}) {
  const id = useId();
  const reduced = useReducedMotion();
  return (
    <div
      role="radiogroup"
      aria-label="Timer mode"
      className="absolute bottom-1 right-6 grid h-6 w-[138px] grid-cols-3 rounded bg-hover p-0.5 md:right-10"
      onPointerDown={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (
          disabled ||
          (event.key !== "ArrowLeft" && event.key !== "ArrowRight")
        )
          return;
        event.preventDefault();
        event.stopPropagation();
        const next =
          (TIMER_MODES.findIndex((mode) => mode.value === value) +
            (event.key === "ArrowRight" ? 1 : -1) +
            TIMER_MODES.length) %
          TIMER_MODES.length;
        onChange(TIMER_MODES[next].value);
        const buttons =
          event.currentTarget.querySelectorAll<HTMLButtonElement>("button");
        buttons[next]?.focus();
      }}
    >
      {TIMER_MODES.map((mode) => (
        <button
          key={mode.value}
          type="button"
          role="radio"
          aria-checked={value === mode.value}
          tabIndex={value === mode.value ? 0 : -1}
          disabled={disabled}
          onClick={() => onChange(mode.value)}
          className={`relative h-5 min-w-0 whitespace-nowrap rounded-sm px-1 text-[10px] transition-colors hover:text-ink focus-visible:outline focus-visible:outline-1 focus-visible:outline-accent disabled:opacity-40 ${value === mode.value ? "text-ink-2" : "text-ink-3"}`}
        >
          {value === mode.value && (
            <motion.span
              aria-hidden
              data-selection-indicator
              layoutId={`timer-mode-${id}`}
              initial={false}
              transition={{ duration: reduced ? 0 : 0.16, ease: EASE_OUT }}
              className="absolute inset-0 rounded-sm border border-line-strong bg-selected"
            />
          )}
          <span className="relative">{mode.label}</span>
        </button>
      ))}
    </div>
  );
}
