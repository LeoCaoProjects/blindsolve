import { useSessionWorkspace } from "../../contexts/SessionWorkspaceContext";
import { splitKey } from "../../utils/pairs";
import { VirtualHistory } from "../common/VirtualHistory";
import { RowDelete } from "../common/HistoryHeader";
import { PairTokens } from "../pairs/PairTokens";
import { SessionReadout } from "./SessionReadout";
import { WORKSPACE_HISTORY_ROW } from "../workspace/historyStyles";

export function FlashcardHistory() {
  const { flashcards: f } = useSessionWorkspace();
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SessionReadout
        cells={[
          ["cards", String(f.stats.seen)],
          ["remembered", String(f.stats.remembered)],
          ["forgot", String(f.stats.forgot)],
        ]}
      />
      <VirtualHistory
        label="Recent cards"
        items={f.log}
        rowHeight={36}
        empty="No recent cards"
        renderItem={(entry) => {
          const [a, b] = splitKey(entry.key);
          return (
            <>
              <div
                data-flashcard-row
                title={entry.piece === "edges" ? "Edge" : "Corner"}
                className={`${WORKSPACE_HISTORY_ROW} cursor-default grid-cols-[34px_minmax(0,1fr)_auto] gap-2 pr-10`}
              >
                <PairTokens
                  first={a}
                  second={b}
                  className="font-mono text-[14.5px] text-ink-2"
                />
                <span className="truncate text-[12px] text-ink-3">
                  {f.wordsForLog(entry)[0]}
                </span>
                <span className="font-mono text-[11px] text-ink-3">
                  {entry.result === "forgot" ? "Forgot" : "Remembered"}
                </span>
              </div>
              <RowDelete
                label={`Remove ${a}${b} from history`}
                onClick={() => f.removeLog(entry.id)}
              />
            </>
          );
        }}
      />
    </div>
  );
}
