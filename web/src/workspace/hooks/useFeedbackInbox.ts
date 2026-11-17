import { useEffect, useRef, useState } from "react";
import { feedbackAdmin, listFeedback } from "../../lib/feedback";
import type { Feedback } from "../types/feedback";
import { supabase } from "../../lib/supabase";

type Authorization = "unknown" | "authorized" | "unauthorized";
type InboxState = {
  owner?: string;
  authorization: Authorization;
  items: Feedback[];
  status: "loading" | "ready" | "error";
};
const denied = (error: unknown) => {
  const value = error as { code?: string; status?: number } | null;
  return (
    ["42501", "PGRST301", "PGRST302", "PGRST303"].includes(value?.code ?? "") ||
    value?.status === 401 ||
    value?.status === 403
  );
};

/** Authorization belongs to one owner. Refreshing is not a negative permission result. */
export function useFeedbackInbox(owner: string | undefined) {
  const [state, setState] = useState<InboxState>({
    authorization: "unknown",
    items: [],
    status: "loading",
  });
  const epoch = useRef(0);
  const currentOwner = useRef(owner);
  const retry = useRef<() => void>(() => {});
  if (currentOwner.current !== owner) {
    currentOwner.current = owner;
    epoch.current++;
  }
  useEffect(() => {
    let alive = true,
      pending = false,
      invalidated = false;
    let scheduled: ReturnType<typeof setTimeout> | undefined;
    const clearAccess = () => {
      invalidated = true;
      epoch.current++;
      setState({
        owner,
        authorization: "unauthorized",
        items: [],
        status: "ready",
      });
    };
    const refresh = async () => {
      if (!owner || pending || invalidated || !alive) return;
      pending = true;
      const ticket = epoch.current;
      const valid = () => alive && ticket === epoch.current;
      setState((previous) =>
        previous.owner === owner
          ? {
              ...previous,
              status:
                previous.authorization === "authorized" ? "ready" : "loading",
            }
          : { owner, authorization: "unknown", items: [], status: "loading" },
      );
      try {
        const allowed = await feedbackAdmin(owner);
        if (!valid()) return;
        if (!allowed) {
          setState({
            owner,
            authorization: "unauthorized",
            items: [],
            status: "ready",
          });
          return;
        }
        setState((previous) => ({
          owner,
          authorization: "authorized",
          items: previous.owner === owner ? previous.items : [],
          status:
            previous.owner === owner && previous.status === "ready"
              ? "ready"
              : "loading",
        }));
        const items = await listFeedback();
        if (valid())
          setState({
            owner,
            authorization: "authorized",
            items,
            status: "ready",
          });
      } catch (error) {
        if (!valid()) return;
        if (denied(error))
          setState({
            owner,
            authorization: "unauthorized",
            items: [],
            status: "ready",
          });
        else setState((previous) => ({ ...previous, status: "error" }));
      } finally {
        pending = false;
      }
    };
    retry.current = () => {
      void refresh();
    };
    if (!owner)
      setState({
        owner,
        authorization: "unauthorized",
        items: [],
        status: "ready",
      });
    else void refresh();
    const focus = () => {
      void refresh();
    };
    const visibility = () => {
      if (document.visibilityState === "visible") focus();
    };
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", visibility);
    const subscription = supabase?.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") return; // owner initialization already checks permission
      if (event === "SIGNED_OUT" || session?.user.id !== owner) {
        clearAccess();
        return;
      }
      // Leave Supabase's auth callback/lock before issuing another request.
      // Coalesce the token, visibility and focus notifications of one refresh.
      if (pending || scheduled !== undefined) return;
      scheduled = setTimeout(() => {
        scheduled = undefined;
        void refresh();
      }, 0);
    });
    return () => {
      alive = false;
      clearTimeout(scheduled);
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", visibility);
      subscription?.data.subscription.unsubscribe();
      retry.current = () => {};
    };
  }, [owner]);
  const visible =
    state.owner === owner
      ? state
      : {
          authorization: "unknown" as const,
          items: [],
          status: "loading" as const,
        };
  return {
    isAdmin: visible.authorization === "authorized",
    authorization: visible.authorization,
    feedback: visible.items,
    feedbackStatus: visible.status,
    retryFeedback: () => retry.current(),
    capture: () => {
      const ticket = epoch.current;
      return (change: (items: Feedback[]) => Feedback[]) => {
        if (ticket === epoch.current)
          setState((value) =>
            value.authorization === "authorized" &&
            value.owner === currentOwner.current
              ? { ...value, items: change(value.items) }
              : value,
          );
      };
    },
  };
}
