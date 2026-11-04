import React from "react";
import { VirtualHistory } from "../../common/VirtualHistory";
import { SessionStats, Solve } from "../../../types/solve";
import { formatTime } from "../../../utils/time";
import { HistoryHeader, RowDelete } from "../../common/HistoryHeader";
import { SolveTime } from "../../solve/SolveTime";

interface WorkspaceHistoryProps {
  solves: Solve[];
  stats: SessionStats;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
}

/** Dense two-column time grid under a three-cell readout. Rows can be removed one at a time. */
export function WorkspaceHistory({
  solves,
  stats,
  onSelect,
  onDelete,
  onClear,
}: WorkspaceHistoryProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <dl className="grid shrink-0 grid-cols-3 border-b border-line">
        {[
          ["best", stats.best],
          ["mo3", stats.mo3],
          ["success", stats.success],
        ].map(([label, value], i) => (
          <div
            key={label}
            className={`px-5 py-3.5 ${i > 0 ? "border-l border-line" : ""}`}
          >
            <dt className="text-[11px] text-ink-3">{label}</dt>
            <dd
              className={`mt-1 font-mono text-[14px] tnum ${i === 0 ? "text-ink" : "text-ink-2"}`}
            >
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <HistoryHeader label="Solves" count={solves.length} onClear={onClear} />
      <VirtualHistory
        label="Solves"
        items={solves}
        columns={2}
        rowHeight={36}
        empty="No solves in this session"
        renderItem={(s, i) => (
          <>
            <button
              type="button"
              onClick={() => onSelect(s.id)}
              className="grid w-full grid-cols-[30px_1fr] items-baseline px-5 py-[7px] text-left transition-colors duration-150 ease-out hover:bg-hover"
            >
              <span
                className={`font-mono text-[10.5px] tnum ${i === 0 ? "text-accent" : "text-ink-3"}`}
              >
                {s.index}
              </span>
              <SolveTime
                time={s.time}
                penalty={s.penalty}
                showRaw={false}
                className={`font-mono text-[14.5px] ${i === 0 ? "text-ink" : "text-ink-2"}`}
              />
            </button>
            <RowDelete
              label={`Delete solve ${s.index}, ${s.penalty === "dnf" ? "DNF" : formatTime(s.time)}`}
              onClick={() => onDelete(s.id)}
            />
          </>
        )}
      />
    </div>
  );
}
