import React, { useCallback, useEffect, useState } from "react";
import { ConfirmDialog } from "../components/common/ConfirmDialog";
import { isTypingTarget } from "../utils/keyboard";

interface Options {
  /** Number of saved items in this list */
  count: number;
  /** e.g. "solve", "attempt", "card" */
  noun: string;
  /** Where they live, e.g. "Practice", "Trace Sprint" */
  scope: string;
  /** Label for the newest item, e.g. "#24 · 1:12.40" */
  latestLabel?: string;
  removeLatest: () => void;
  clearAll: () => void;
  /** Keyboard only when the page is at rest (not timing, no overlay) */
  keysEnabled: boolean;
}

/**
 * Shared cleanup for saved history: remove the latest item, or clear the whole list.
 * Both ask first. ⌫ removes the latest, ⇧⌫ clears — only when nothing is being typed or timed.
 */
export function useHistoryCleanup({
  count,
  noun,
  scope,
  latestLabel,
  removeLatest,
  clearAll,
  keysEnabled,
}: Options) {
  const [ask, setAsk] = useState<"latest" | "all" | null>(null);
  const plural = `${noun}s`;

  const askLatest = useCallback(() => count > 0 && setAsk("latest"), [count]);
  const askClear = useCallback(() => count > 0 && setAsk("all"), [count]);

  useEffect(() => {
    if (!keysEnabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Backspace" && e.key !== "Delete") return;
      if (
        isTypingTarget(e.target) ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        e.repeat
      )
        return;
      if (document.querySelector('[role="dialog"], [role="alertdialog"]'))
        return;
      e.preventDefault();
      if (e.shiftKey) askClear();
      else askLatest();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [keysEnabled, askClear, askLatest]);

  const dialog = (
    <ConfirmDialog
      open={ask !== null}
      initialFocus="confirm"
      quietRestoreFocus
      title={
        ask === "all"
          ? `Clear all ${count} ${count === 1 ? noun : plural}?`
          : `Delete the latest ${noun}?`
      }
      body={
        ask === "all" ? (
          <>
            This removes every {noun} in {scope}. It can’t be undone.
          </>
        ) : (
          <>
            {latestLabel ? (
              <span className="font-mono text-ink">{latestLabel}</span>
            ) : (
              `The newest ${noun}`
            )}{" "}
            will be removed from {scope}.
          </>
        )
      }
      confirm={{
        label: ask === "all" ? "Clear all" : "Delete",
        onClick: () => {
          if (ask === "all") clearAll();
          else removeLatest();
          setAsk(null);
        },
      }}
      onCancel={() => setAsk(null)}
    />
  );

  return { askLatest, askClear, dialog };
}
