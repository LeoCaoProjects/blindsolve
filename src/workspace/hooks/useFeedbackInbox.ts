import { useEffect, useRef, useState } from "react";
import { feedbackAdmin, listFeedback } from "../../lib/feedback";
import type { Feedback } from "../types/feedback";

/** UI state only. Never carry an inbox or permission result across owners. */
export function useFeedbackInbox(owner: string | undefined) {
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<{
    owner?: string;
    allowed: boolean;
    items: Feedback[];
    status: "loading" | "ready" | "error";
  }>({ allowed: false, items: [], status: "loading" });
  const epoch = useRef(0);
  const currentOwner = useRef(owner);
  if (currentOwner.current !== owner) {
    currentOwner.current = owner;
    epoch.current++;
  }
  useEffect(() => {
    const ticket = ++epoch.current;
    setState({
      owner,
      allowed: false,
      items: [],
      status: owner ? "loading" : "ready",
    });
    if (!owner) return;
    void (async () => {
      let allowed = false;
      try {
        allowed = await feedbackAdmin(owner);
        if (ticket !== epoch.current) return;
        const items = allowed ? await listFeedback() : [];
        if (ticket === epoch.current)
          setState({ owner, allowed, items, status: "ready" });
      } catch {
        if (ticket === epoch.current)
          setState({ owner, allowed, items: [], status: "error" });
      }
    })();
    return () => {
      epoch.current++;
    };
  }, [owner, revision]);
  const visible =
    state.owner === owner
      ? state
      : { allowed: false, items: [], status: "loading" as const };
  return {
    isAdmin: visible.allowed,
    feedback: visible.items,
    feedbackStatus: visible.status,
    retryFeedback: () => setRevision((value) => value + 1),
    // A completion from an abandoned account may not change this account's UI.
    capture: () => {
      const ticket = epoch.current;
      return (change: (items: Feedback[]) => Feedback[]) => {
        if (ticket === epoch.current)
          setState((value) => ({ ...value, items: change(value.items) }));
      };
    },
  };
}
