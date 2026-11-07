import { useEffect } from "react";
import { Penalty } from "../types/solve";
import { isTypingTarget } from "../utils/keyboard";

const DEFAULT_RESULTS: Penalty[] = ["ok", "+2", "dnf"];
export function useDetailsKeys(
  onClose: () => void,
  onPenalty: (p: Penalty) => void,
  results: Penalty[] = DEFAULT_RESULTS,
) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey) return;
      const index = ["1", "2", "3"].indexOf(e.key);
      if (index >= 0 && results[index]) onPenalty(results[index]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onPenalty, results]);
}
