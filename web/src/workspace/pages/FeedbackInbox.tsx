import { AdminTabs } from "../../features/admin/AdminTabs";
import { useStore } from "../../app/Store";
import React, { useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { SearchIcon } from "lucide-react";
import { Link, Navigate } from "react-router-dom";
import { DecisionMenu } from "../components/training/review/DecisionMenu";
import { SecondaryButton } from "../components/common/PrimaryButton";
import { Segmented } from "../components/common/Segmented";
import { ShortcutSheet } from "../components/common/ShortcutSheet";
import { FeedbackDetail } from "../components/feedback/FeedbackDetail";
import { FeedbackList } from "../components/feedback/FeedbackList";
import { AppBar } from "../components/layout/AppBar";
import { useAppData } from "../contexts/AppDataContext";
import { useShortcutSheet } from "../hooks/useShortcutSheet";
import {
  FeedbackCategory,
  FeedbackStatus,
  STATUS_LABEL,
  STATUS_ORDER,
} from "../types/feedback";

type CategoryFilter = "all" | FeedbackCategory;
type StatusFilter = "active" | "all" | FeedbackStatus;

const CATEGORY_NOUN: Record<CategoryFilter, string> = {
  all: "feedback",
  bug: "bugs",
  feature: "feature requests",
  general: "general feedback",
};

/**
 * Admin feedback reuses the original inbox and actions. The redirect is presentation only:
 * the server refuses
 * non-admins access to feedback data.
 */
export function FeedbackInbox() {
  const { ready } = useStore();
  const { account, feedback, feedbackStatus, retryFeedback } = useAppData();
  const sheet = useShortcutSheet();
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("active");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return feedback.filter((f) => {
      if (category !== "all" && f.category !== category) return false;
      if (
        status === "active"
          ? f.status === "archived"
          : status !== "all" && f.status !== status
      )
        return false;
      if (!q) return true;
      return [
        f.message,
        f.contact,
        f.user?.name,
        f.user?.detail,
        f.source,
      ].some((v) => v?.toLowerCase().includes(q));
    });
  }, [feedback, category, status, query]);

  if (!ready || feedbackStatus === "loading")
    return (
      <main className="p-6 text-[13px] text-ink-2" role="status">
        Loading feedback...
      </main>
    );
  if (feedbackStatus === "error")
    return (
      <main className="space-y-4 p-6 text-[13px]">
        <p role="alert">Feedback could not be loaded.</p>
        <SecondaryButton onClick={retryFeedback}>
          Retry feedback
        </SecondaryButton>
        <Link className="ml-4 text-ink-2" to="/settings">
          Back to Settings
        </Link>
      </main>
    );
  if (account.role !== "admin") return <Navigate to="/settings" replace />;

  const newCount = feedback.filter((f) => f.status === "new").length;
  const open = feedback.find((f) => f.id === openId);
  const emptyLabel = query.trim()
    ? "Nothing matches that search."
    : `No ${status === "active" || status === "all" ? "" : `${STATUS_LABEL[status].toLowerCase()} `}${CATEGORY_NOUN[category]}.`;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-bg font-sans text-ink">
      <AppBar onShortcuts={sheet.openSheet} />
      <AdminTabs />

      <main
        aria-label="Feedback"
        className="scroll-quiet min-h-0 flex-1 overflow-y-auto px-5 pb-8 pt-6 md:px-10"
      >
        <div className="mx-auto w-full max-w-[880px]">
          <header>
            <div className="flex items-baseline gap-3">
              <h2 className="text-[14px] font-medium">Feedback</h2>
              <span className="text-[12px] text-ink-2">
                {newCount > 0 ? `${newCount} new` : "Nothing new"}
              </span>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
              <Segmented
                className="[&_button]:text-ink-2 [&_button[aria-checked=true]]:text-ink"
                label="Type"
                size="sm"
                value={category}
                onChange={setCategory}
                options={[
                  { value: "all", label: "All" },
                  { value: "bug", label: "Bugs" },
                  { value: "feature", label: "Features" },
                  { value: "general", label: "General" },
                ]}
              />
              <div className="flex flex-wrap items-center gap-3 [&_button]:text-ink-2">
                <DecisionMenu
                  popoverClassName="theme-workspace"
                  label="Status"
                  value={status}
                  safe="active"
                  onChange={setStatus}
                  options={[
                    {
                      value: "active",
                      short: "Not archived",
                      label: "Not archived",
                    },
                    ...STATUS_ORDER.map((s) => ({
                      value: s,
                      short: STATUS_LABEL[s],
                      label: STATUS_LABEL[s],
                    })),
                    { value: "all", short: "Everything", label: "Everything" },
                  ]}
                />
                <label className="relative inline-flex items-center">
                  <SearchIcon
                    size={14}
                    className="pointer-events-none absolute left-2.5 text-ink-2"
                    aria-hidden
                  />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search"
                    aria-label="Search feedback"
                    className="h-8 w-[160px] rounded-[4px] border border-line bg-surface pl-8 pr-2 text-[13px] text-ink placeholder:text-ink-2 focus:border-line-strong"
                  />
                </label>
              </div>
            </div>
          </header>
          <div className="mt-4">
            {feedback.length === 0 ? (
              <p className="py-8 text-[13px] text-ink-2">No feedback yet.</p>
            ) : shown.length === 0 ? (
              <p className="py-8 text-[13px] text-ink-2">{emptyLabel}</p>
            ) : (
              <FeedbackList items={shown} onOpen={setOpenId} />
            )}
          </div>
        </div>
      </main>

      <AnimatePresence>
        {open && (
          <FeedbackDetail
            key={open.id}
            item={open}
            onClose={() => setOpenId(null)}
          />
        )}
      </AnimatePresence>
      <ShortcutSheet
        open={sheet.open}
        onClose={sheet.closeSheet}
        page="timer"
      />
    </div>
  );
}
