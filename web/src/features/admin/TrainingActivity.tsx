import { trainingModes } from "../../workspace/data/trainingModes";
import type { AdminRange, AdminReport } from "./api";
const periods = {
  "24h": "24 hours",
  "7d": "7 days",
  "30d": "30 days",
  all: "All time",
};
export function TrainingActivity({
  modes,
  range,
}: {
  modes: AdminReport["modes"];
  range: AdminRange;
}) {
  const rows = modes
    .filter((item) => item.attempts > 0)
    .sort((a, b) => b.attempts - a.attempts || a.mode.localeCompare(b.mode));
  return (
    <section className="mt-7" aria-labelledby="training-heading">
      <h2 id="training-heading" className="text-[14px] font-medium">
        Training activity
      </h2>
      <p className="mt-1 text-[12px] text-ink-2">
        Completed attempts · {periods[range]}
      </p>
      <ul className="mt-5 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-5">
        {rows.map((item) => (
          <li key={item.mode} className="flex min-w-0 flex-col gap-2">
            <span className="max-w-[16ch] text-[12px] leading-relaxed text-ink-2">
              {trainingModes.find((m) => m.id === item.mode)?.label ??
                "Legacy Training"}
            </span>
            <span className="font-mono text-[20px] leading-none tabular-nums text-ink">
              {item.attempts.toLocaleString()}
            </span>
          </li>
        ))}
      </ul>
      {!rows.length && (
        <p className="mt-3 text-[13px] text-ink-2">
          No Training attempts in this period.
        </p>
      )}
    </section>
  );
}
