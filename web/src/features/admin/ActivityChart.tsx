import { useRef, useState } from "react";
import { Segmented } from "../../workspace/components/common/Segmented";
import type { AdminRange, AdminReport } from "./api";

type Series = "accounts" | "solves" | "training";
const labels = { accounts: "Accounts", solves: "Solves", training: "Training" };
const DAY = 86400000;
const iso = (time: number) => new Date(time).toISOString().slice(0, 10);
const date = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
type Point = AdminReport["trend"][number] & { end: string };

/** Range selection never changes a daily value. Use the selected metric's history,
 * not older account/other-metric dates, to choose resolution. Omit dates before
 * its first available activity; fill every internal/trailing UTC day with zero.
 * <=60 days: daily; <=365: Monday-aligned weeks; otherwise calendar months,
 * grouped into at most 36 buckets. Boundary buckets are explicitly date-ranged.
 */
export function activityPoints(
  days: AdminReport["trend"],
  since?: string | null,
  updatedAt?: string,
  series?: Series,
): Point[] {
  const sorted = [...days]
    .filter((day) => !series || day[series] > 0)
    .sort((a, b) => a.day.localeCompare(b.day));
  if (!sorted.length) return [];
  const first = [sorted[0].day, since?.slice(0, 10) ?? sorted[0].day]
    .sort()
    .at(-1)!;
  const last = (updatedAt ?? sorted.at(-1)!.day).slice(0, 10);
  const start = Date.parse(first),
    end = Date.parse(last);
  const span = Math.floor((end - start) / DAY) + 1;
  const months = (day: string) =>
    Number(day.slice(0, 4)) * 12 + Number(day.slice(5, 7)) - 1;
  const points: Point[] = [];
  const add = (begin: number, finish: number) =>
    points.push({
      day: iso(Math.max(start, begin)),
      end: iso(Math.min(end, finish)),
      accounts: 0,
      solves: 0,
      training: 0,
    });
  if (span > 365) {
    const monthStep = Math.max(
      1,
      Math.ceil((months(last) - months(first) + 1) / 35),
    );
    for (
      let m = Math.floor(months(first) / monthStep) * monthStep;
      m <= months(last);
      m += monthStep
    ) {
      const next = m + monthStep;
      add(
        Date.UTC(Math.floor(m / 12), m % 12, 1),
        Date.UTC(Math.floor(next / 12), next % 12, 1) - DAY,
      );
    }
  } else {
    const step = span > 60 ? 7 : 1;
    const aligned =
      step === 7
        ? start - ((new Date(start).getUTCDay() + 6) % 7) * DAY
        : start;
    for (let t = aligned; t <= end; t += step * DAY)
      add(t, t + (step - 1) * DAY);
  }
  for (const day of days) {
    const point = points.find(
      (point) => day.day >= point.day && day.day <= point.end,
    );
    if (point)
      for (const metric of ["accounts", "solves", "training"] as const)
        point[metric] += day[metric];
  }
  return points;
}

export function ActivityChart({
  days,
  range = "7d",
  since,
  updatedAt,
}: {
  days: AdminReport["trend"];
  range?: AdminRange;
  since?: string | null;
  updatedAt?: string;
}) {
  const [series, setSeries] = useState<Series>("solves");
  const [selected, setSelected] = useState<number | null>(null);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const points =
    range === "24h" && days.length
      ? [
          {
            day: (since ?? days[0].day).slice(0, 10),
            end: (updatedAt ?? days.at(-1)!.day).slice(0, 10),
            accounts: days.reduce((n, d) => n + d.accounts, 0),
            solves: days.reduce((n, d) => n + d.solves, 0),
            training: days.reduce((n, d) => n + d.training, 0),
          },
        ]
      : activityPoints(days, since, updatedAt, series);
  const activeIndex = Math.min(
    selected ?? points.length - 1,
    points.length - 1,
  );
  const active = points[activeIndex];
  const maximum = Math.max(1, ...points.map((point) => point[series]));
  const magnitude = 10 ** Math.floor(Math.log10(maximum));
  const scaleMax = Math.ceil(maximum / magnitude) * magnitude;
  const ticks = [...new Set([0, Math.round(scaleMax / 2), scaleMax])];
  const grouped = points.some((point) => point.day !== point.end);
  const monthly = points.some(
    (point) => Date.parse(point.end) - Date.parse(point.day) >= 7 * DAY,
  );
  const hasActivity = points.some((point) => point[series] > 0);
  const x = (i: number) => 5 + (i / Math.max(1, points.length - 1)) * 90;
  const y = (value: number) => 90 - (value / scaleMax) * 80;
  const pointLabel = (point: Point) =>
    `${date(point.day)}${point.day !== point.end ? ` – ${date(point.end)}` : ""}`;
  const exact = (point: Point) =>
    `${pointLabel(point)}: ${point[series].toLocaleString()} ${labels[series].toLowerCase()}`;
  const labelStep =
    !grouped && points.length <= 8 ? 1 : Math.ceil((points.length - 1) / 4);
  return (
    <section
      className="border-t border-line pt-5"
      aria-labelledby="activity-heading"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <h2 id="activity-heading" className="text-[14px] font-medium">
          Activity
        </h2>
        <Segmented
          className="[&_button]:text-ink-2 [&_button[aria-checked=true]]:text-ink"
          label="Activity metric"
          size="sm"
          value={series}
          onChange={setSeries}
          options={Object.entries(labels).map(([value, label]) => ({
            value: value as Series,
            label,
          }))}
        />
      </div>
      <p className="mt-1 text-[11px] text-ink-2">
        {range === "24h"
          ? "Last 24 hours"
          : monthly
            ? "Monthly groups · UTC"
            : grouped
              ? "Weekly totals · UTC"
              : "Daily totals · UTC"}
      </p>
      {!days.length ? (
        <p className="py-8 text-[13px] text-ink-2">
          No activity in this period.
        </p>
      ) : points.length === 1 ? (
        <div className="mt-4 flex items-baseline justify-between gap-4 py-5">
          <span className="text-[12px] text-ink-2">
            {range === "24h" ? "Total" : pointLabel(points[0])}
          </span>
          <p className="text-[13px] text-ink-2">
            <span className="mr-2 text-[24px] tabular-nums text-ink">
              {points[0][series].toLocaleString()}
            </span>
            {labels[series].toLowerCase()}
          </p>
        </div>
      ) : !hasActivity ? (
        <p className="py-8 text-[13px] text-ink-2">
          No {labels[series].toLowerCase()} in this period.
        </p>
      ) : (
        <figure className="mt-3">
          <figcaption
            aria-live="polite"
            aria-atomic="true"
            className="min-h-6 text-[12px] tabular-nums text-ink-2"
          >
            {active && exact(active)}
          </figcaption>
          <div className="mt-3 flex gap-3">
            <div
              aria-label="Chart scale"
              className="relative h-[180px] min-w-8 text-right text-[11px] tabular-nums text-ink-2"
            >
              {ticks.map((tick) => (
                <span
                  key={tick}
                  className="absolute right-0 -translate-y-1/2"
                  style={{ top: `${y(tick)}%` }}
                >
                  {tick.toLocaleString()}
                </span>
              ))}
            </div>
            <div className="min-w-0 flex-1">
              <div
                className="relative h-[180px]"
                role="group"
                aria-label={`${labels[series]} values; use arrow keys to explore`}
              >
                <svg
                  viewBox="0 0 600 180"
                  preserveAspectRatio="none"
                  role="img"
                  aria-label={`${labels[series]} by ${monthly ? "month" : grouped ? "week" : "day"}; exact values on focus or in Daily values below`}
                  className="absolute inset-0 h-full w-full overflow-visible text-ink-2"
                >
                  {ticks.map((tick) => (
                    <line
                      key={tick}
                      x1="0"
                      x2="600"
                      y1={y(tick) * 1.8}
                      y2={y(tick) * 1.8}
                      stroke={tick === 0 ? "var(--line-strong)" : "var(--line)"}
                    />
                  ))}
                  <polyline
                    points={points
                      .map(
                        (point, i) => `${x(i) * 6},${y(point[series]) * 1.8}`,
                      )
                      .join(" ")}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    vectorEffect="non-scaling-stroke"
                    strokeLinejoin="round"
                  />
                </svg>
                {points.map((point, i) => (
                  <button
                    key={point.day}
                    ref={(node) => {
                      buttons.current[i] = node;
                    }}
                    type="button"
                    aria-label={exact(point)}
                    tabIndex={i === activeIndex ? 0 : -1}
                    className="absolute flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full"
                    style={{ left: `${x(i)}%`, top: `${y(point[series])}%` }}
                    onMouseEnter={() => setSelected(i)}
                    onFocus={() => setSelected(i)}
                    onClick={() => setSelected(i)}
                    onKeyDown={(event) => {
                      const next =
                        event.key === "ArrowRight"
                          ? Math.min(points.length - 1, i + 1)
                          : event.key === "ArrowLeft"
                            ? Math.max(0, i - 1)
                            : event.key === "Home"
                              ? 0
                              : event.key === "End"
                                ? points.length - 1
                                : null;
                      if (next !== null) {
                        event.preventDefault();
                        buttons.current[next]?.focus();
                      }
                    }}
                  >
                    <span
                      aria-hidden
                      className={`block rounded-full border border-bg ${i === activeIndex ? "h-2 w-2 bg-ink" : "h-1.5 w-1.5 bg-ink-2"}`}
                    />
                  </button>
                ))}
              </div>
              <div
                className="relative h-9 text-[11px] leading-tight text-ink-2"
                aria-label="Chart dates"
              >
                {points.map(
                  (point, i) =>
                    (i === points.length - 1 || i % labelStep === 0) && (
                      <span
                        key={point.day}
                        className="absolute whitespace-nowrap text-center"
                        style={{
                          left: `${x(i)}%`,
                          transform: "translateX(-50%)",
                        }}
                      >
                        {new Date(`${point.day}T00:00:00Z`).toLocaleDateString(
                          undefined,
                          monthly
                            ? {
                                month: "short",
                                year: "2-digit",
                                timeZone: "UTC",
                              }
                            : { day: "numeric", timeZone: "UTC" },
                        )}
                        {!monthly && (
                          <span className="block">
                            {new Date(
                              `${point.day}T00:00:00Z`,
                            ).toLocaleDateString(undefined, {
                              month: "short",
                              timeZone: "UTC",
                            })}
                          </span>
                        )}
                      </span>
                    ),
                )}
              </div>
            </div>
          </div>
        </figure>
      )}
      {days.length > 0 && (
        <details className="mt-3 text-[12px]">
          <summary className="w-fit cursor-pointer rounded py-1 text-ink-2 hover:text-ink">
            Daily values
          </summary>
          <div
            className="scroll-quiet mt-2 max-h-[220px] overflow-auto rounded border border-line"
            tabIndex={0}
            aria-label="Daily activity values"
          >
            <table className="w-full text-left tabular-nums">
              <caption className="sr-only">
                Daily activity, UTC dates. Accounts are new registrations.
              </caption>
              <thead>
                <tr>
                  {["Date (UTC)", "Accounts", "Solves", "Training"].map(
                    (label) => (
                      <th
                        key={label}
                        scope="col"
                        className="whitespace-nowrap px-3 py-2 font-normal text-ink-2"
                      >
                        {label}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {days.map((day) => (
                  <tr key={day.day} className="border-t border-line">
                    {[day.day, day.accounts, day.solves, day.training].map(
                      (value, i) => (
                        <td key={i} className="whitespace-nowrap px-3 py-2">
                          {typeof value === "number"
                            ? value.toLocaleString()
                            : value}
                        </td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  );
}
