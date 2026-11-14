import { useAppData } from "../../contexts/AppDataContext";
import type { TimerPhase } from "../../hooks/useTimer";
import { TimerReadout } from "../solve/TimerReadout";

/** The compact active Training readout; timing state and persistence stay in the session. */
export function CompactTrainingTimer({
  value,
  phase,
  label,
}: {
  value: number;
  phase: TimerPhase;
  label?: string;
}) {
  const { prefs } = useAppData();
  return (
    <TimerReadout
      phase={phase}
      value={value}
      showLiveTimer={prefs.showLiveTimer}
      ariaLabel={label}
      tones={{
        memo: "text-ink-2",
        running: "text-ink-2",
        stopped: "text-ink-3",
      }}
      className="font-timer text-[clamp(34px,6.5vh,60px)] font-extralight leading-none tracking-[-0.04em]"
    />
  );
}
