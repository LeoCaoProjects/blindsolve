import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useStore } from "../../app/Store";
import { useAppData } from "../../workspace/contexts/AppDataContext";
import { AppBar } from "../../workspace/components/layout/AppBar";
import { ShortcutSheet } from "../../workspace/components/common/ShortcutSheet";
import { SecondaryButton } from "../../workspace/components/common/PrimaryButton";
import { useShortcutSheet } from "../../workspace/hooks/useShortcutSheet";
import { RefreshCwIcon } from "lucide-react";
import { OptionGroup } from "../../workspace/components/common/OptionGroup";
import { IconButton } from "../../workspace/components/common/IconButton";
import { TrainingActivity } from "./TrainingActivity";
import { ActivityChart } from "./ActivityChart";
import { MetricHelp } from "./MetricHelp";
import { AdminTabs } from "./AdminTabs";
import { loadOverview, type AdminRange, type AdminReport } from "./api";

const number = (value: number) => value.toLocaleString();

export function AdminOverview() {
  const { account, feedbackStatus, retryFeedback } = useAppData();
  const { user, recoveredId, ready } = useStore();
  const sheet = useShortcutSheet();
  const [range, setRange] = useState<AdminRange>("7d");
  const [revision, refresh] = useState(0);
  const [state, setState] = useState<{
    owner?: string;
    range?: AdminRange;
    data?: AdminReport;
    error?: boolean;
    refreshing?: boolean;
  }>({});
  const permitted = !!user && !recoveredId && account.role === "admin";
  useEffect(() => {
    const request = new AbortController();
    setState((previous) =>
      permitted && previous.owner === user?.id
        ? { ...previous, refreshing: true, error: false }
        : { owner: user?.id, refreshing: true },
    );
    if (permitted)
      void loadOverview(range, request.signal)
        .then((data) => {
          if (!request.signal.aborted)
            setState({ owner: user?.id, range, data });
        })
        .catch(() => {
          if (!request.signal.aborted)
            setState((previous) => ({
              ...previous,
              refreshing: false,
              error: true,
            }));
        });
    return () => request.abort();
  }, [permitted, user?.id, range, revision]);
  // Never render a cached response belonging to an old account or permission state.
  if (!ready)
    return (
      <main className="p-5 text-ink" role="status">
        Checking Admin access…
      </main>
    );
  if (!user || recoveredId || (!permitted && feedbackStatus === "ready"))
    return <Navigate to="/settings" replace />;
  if (!permitted)
    return (
      <main className="p-5 text-ink">
        <p role="status">
          {feedbackStatus === "error"
            ? "Admin access could not be checked."
            : "Checking Admin access…"}
        </p>
        {feedbackStatus === "error" && (
          <SecondaryButton onClick={retryFeedback}>Retry</SecondaryButton>
        )}
      </main>
    );
  const visible = state.owner === user.id ? state : {};
  const data = visible.data;
  const displayedRange = visible.range ?? range;
  return (
    <div className="flex h-full min-w-0 flex-col bg-bg font-sans text-ink">
      <AppBar onShortcuts={sheet.openSheet} />
      <AdminTabs />
      <main
        aria-label="Overview"
        className="scroll-quiet min-h-0 flex-1 overflow-y-auto px-5 pb-28 pt-6 md:px-10"
      >
        <div className="mx-auto w-full max-w-[880px]">
          {data && (
            <section aria-label="Current totals" className="mb-6">
              <h2 className="mb-3 text-[12px] text-ink-2">Current</h2>
              <dl className="grid max-w-[440px] grid-cols-2 gap-6">
                <Metric label="Accounts" value={data.registeredAccounts} />
                <div>
                  <dt className="flex min-h-5 items-center">
                    <Link
                      to="/admin/feedback"
                      className="text-[12px] text-ink-2 hover:text-ink underline-offset-4 hover:underline"
                    >
                      Open feedback
                    </Link>
                  </dt>
                  <dd className="mt-1 text-[28px] tabular-nums leading-tight">
                    {number(data.feedback.open)}
                  </dd>
                  <dd className="mt-1 text-[11px] text-ink-2">
                    {data.feedback.new
                      ? `${number(data.feedback.new)} new`
                      : "Current"}
                  </dd>
                </div>
              </dl>
            </section>
          )}

          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
            <div className="flex items-center gap-2">
              <h2 className="text-[14px] font-medium">Usage</h2>
              <MetricHelp label="About usage">
                Usage reflects signed-in/cloud activity. Guest activity is not
                tracked.
              </MetricHelp>
            </div>
            <div className="flex items-center gap-2">
              <OptionGroup
                className="[&_button]:text-ink-2 [&_button[aria-checked=true]]:text-ink"
                label="Overview period"
                showLabel={false}
                value={range}
                onChange={setRange}
                options={[
                  { value: "24h", label: "24 hours" },
                  { value: "7d", label: "7 days" },
                  { value: "30d", label: "30 days" },
                  { value: "all", label: "All time" },
                ]}
              />
              <IconButton
                label="Refresh overview"
                onClick={() => refresh((n) => n + 1)}
              >
                <RefreshCwIcon
                  className={
                    visible.refreshing
                      ? "animate-spin motion-reduce:animate-none"
                      : ""
                  }
                />
              </IconButton>
            </div>
          </div>
          <span role="status" className="sr-only">
            {visible.refreshing && data ? "Updating usage…" : ""}
          </span>
          {visible.error && data && (
            <p role="alert" className="mt-3 text-[12px] text-ink-2">
              Refresh failed. Showing the previous period.{" "}
              <button
                className="underline"
                onClick={() => refresh((n) => n + 1)}
              >
                Retry
              </button>
            </p>
          )}
          {visible.error && !data ? (
            <div className="py-12 text-[13px]">
              <p role="alert">Overview could not be loaded.</p>
              <SecondaryButton
                className="mt-3"
                onClick={() => refresh((n) => n + 1)}
              >
                Try again
              </SecondaryButton>
            </div>
          ) : !data ? (
            <p role="status" className="py-12 text-[13px] text-ink-2">
              Loading overview…
            </p>
          ) : (
            <>
              <dl
                aria-label="Usage in selected period"
                className="grid grid-cols-2 gap-x-6 gap-y-4 py-5 sm:grid-cols-4"
              >
                <Metric label="New accounts" value={data.newAccounts} />
                <Metric label="Active accounts" value={data.activeUsers} help />
                <Metric label="Solves" value={data.solves} />
                <Metric label="Training attempts" value={data.training} />
              </dl>
              {(data.undatedSolves > 0 || data.undatedTraining > 0) && (
                <p className="mb-5 text-[12px] text-ink-2">
                  Not shown: {number(data.undatedSolves)} solves and{" "}
                  {number(data.undatedTraining)} attempts without valid dates.
                </p>
              )}
              <ActivityChart
                days={data.trend}
                range={displayedRange}
                since={data.since}
                updatedAt={data.updatedAt}
              />
              <TrainingActivity modes={data.modes} range={displayedRange} />
            </>
          )}
        </div>
      </main>
      <ShortcutSheet
        open={sheet.open}
        onClose={sheet.closeSheet}
        page="settings"
      />
    </div>
  );
}
function Metric({
  label,
  value,
  help = false,
}: {
  label: string;
  value: number;
  help?: boolean;
}) {
  return (
    <div>
      <dt className="flex min-h-5 items-center gap-1 text-[12px] text-ink-2">
        {label}
        {help && <MetricHelp />}
      </dt>
      <dd className="mt-1 text-[28px] leading-tight tabular-nums">
        {number(value)}
      </dd>
    </div>
  );
}
