import React from "react";
import { VirtualHistory } from "../common/VirtualHistory";
import { SessionStats, Solve } from "../../types/solve";
import { formatTime } from "../../utils/time";
import { RowDelete } from "../common/HistoryHeader";
import { SolveTime } from "../solve/SolveTime";

import { SessionReadout } from "../practice/SessionReadout";
import { WORKSPACE_HISTORY_ROW } from "./historyStyles";

interface WorkspaceHistoryProps {
  solves: Solve[];
  stats: SessionStats;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

/** Dense two-column time grid under a three-cell readout. Rows can be removed one at a time. */
export function WorkspaceHistory({
  solves,
  stats,
  onSelect,
  onDelete,
}: WorkspaceHistoryProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SessionReadout
        cells={[
          ["best", stats.best],
          ["mo3", stats.mo3],
          ["success", stats.success],
        ]}
      />
      <VirtualHistory
        label="Solves"
        items={solves}
        columns={2}
        rowHeight={36}
        empty="No solves yet"
        renderItem={(s, i) => (
          <>
            <button
              type="button"
              onClick={() => onSelect(s.id)}
              className={`${WORKSPACE_HISTORY_ROW} grid-cols-[30px_1fr]`}
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
