import { useEffect } from "react";
import { Penalty } from "../types/solve";
import { isTypingTarget, allowsReviewEnter } from "../utils/keyboard";

import { DEFAULT_PENALTIES, penaltyForKey } from "../utils/penaltyKeys";
export function useDetailsKeys(
  onClose: () => void,
  onPenalty: (p: Penalty) => void,
  results: Penalty[] = DEFAULT_PENALTIES,
) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.defaultPrevented ||
        e.isComposing ||
        e.repeat ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey
      )
        return;
      if (document.querySelector('[role="alertdialog"]')) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey) return;
      if (
        e.key === "Enter" &&
        !e.shiftKey &&
        allowsReviewEnter(e.target)
      ) {
        e.preventDefault();
        onClose();
        return;
      }
      const penalty = penaltyForKey(e.key, results);
      if (penalty) onPenalty(penalty);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onPenalty, results]);
}
