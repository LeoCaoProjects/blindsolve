import React from "react";
import { ImageIcon } from "lucide-react";
import { CATEGORY_LABEL, Feedback, STATUS_LABEL } from "../../types/feedback";

export function formatStamp(iso: string, withTime = false): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
  if (!withTime) return date;
  return `${date} ${d.getFullYear()}, ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}

/** Compact message-first inbox; sender and technical details remain in the detail dialog. */
export function FeedbackList({
  items,
  onOpen,
}: {
  items: Feedback[];
  onOpen: (id: string) => void;
}) {
  return (
    <ul aria-label="Feedback" className="divide-y divide-line">
      {items.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            onClick={() => onOpen(item.id)}
            className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-2 rounded-[4px] px-2 py-4 text-left transition-colors hover:bg-hover"
          >
            <span
              className={`flex min-w-0 items-start gap-2 text-[14px] leading-relaxed ${item.status === "new" ? "text-ink" : "text-ink-2"}`}
            >
              <span className="line-clamp-2">{item.message}</span>
              {item.screenshot && (
                <ImageIcon
                  size={14}
                  className="mt-1 shrink-0 text-ink-2"
                  aria-label="Has screenshot"
                />
              )}
            </span>
            <span
              className={`pt-0.5 text-[12px] ${item.status === "new" ? "text-ink" : "text-ink-2"}`}
            >
              {STATUS_LABEL[item.status]}
            </span>
            <span className="flex min-w-0 gap-3 text-[12px] text-ink-2">
              <span className="shrink-0">{CATEGORY_LABEL[item.category]}</span>
              <span className="truncate">{item.source}</span>
            </span>
            <time
              dateTime={item.createdAt}
              className="text-right text-[12px] text-ink-2"
            >
              {formatStamp(item.createdAt)}
            </time>
          </button>
        </li>
      ))}
    </ul>
  );
}
