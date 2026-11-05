import { TIMER_MODES, type TimerMode } from "../../utils/timerModes";

/** Inline choices in the timing surface, without a separate navigation row. */
export function TimerModeControl({
  value,
  onChange,
  disabled,
}: {
  value: TimerMode;
  onChange: (mode: TimerMode) => void;
  disabled: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Timer mode"
      className="absolute right-6 top-1 flex h-7 items-center gap-2 md:right-10"
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
          className={`h-7 px-1 text-[11.5px] transition-colors hover:text-ink focus-visible:rounded-sm focus-visible:outline focus-visible:outline-1 focus-visible:outline-accent disabled:opacity-40 ${value === mode.value ? "text-ink-2 underline decoration-line-strong underline-offset-4" : "text-ink-3"}`}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}
