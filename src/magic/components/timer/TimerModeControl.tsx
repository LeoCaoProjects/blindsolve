import { ChevronDownIcon } from "lucide-react";
import { TIMER_MODES, type TimerMode } from "../../utils/timerModes";

/** Native dropdown keeps the utility compact and keyboard/touch accessible. */
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
    <div className="relative h-7 w-[82px] shrink-0">
      <select
        aria-label="Timer mode"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.value as TimerMode)}
        className="h-7 w-full cursor-pointer appearance-none rounded-sm border border-transparent bg-transparent pl-2 pr-5 text-[11px] text-ink-2 transition-colors hover:border-line-strong hover:bg-hover focus-visible:outline focus-visible:outline-1 focus-visible:outline-accent disabled:cursor-default disabled:opacity-40"
      >
        {TIMER_MODES.map((mode) => (
          <option
            key={mode.value}
            value={mode.value}
            className="bg-surface text-ink"
          >
            {mode.label}
          </option>
        ))}
      </select>
      <ChevronDownIcon
        aria-hidden
        size={11}
        className="pointer-events-none absolute right-1.5 top-2 text-ink-3"
      />
    </div>
  );
}
