import React, { useEffect, useRef, useState } from "react";
import { useAppData } from "../../contexts/AppDataContext";
import {
  CATEGORY_LABEL,
  Feedback,
  STATUS_LABEL,
  STATUS_ORDER,
} from "../../types/feedback";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { Sheet } from "../common/Sheet";
import { DecisionMenu } from "../training/review/DecisionMenu";
import { QuietButton, SecondaryButton } from "../common/PrimaryButton";
import { formatStamp } from "./FeedbackList";

/**
 * One submission: the message first, then who, where and when, then technical details.
 * Status changes apply at once (any status to any other). Archive is the normal way out;
 * permanent delete sits apart and asks first.
 */
export function FeedbackDetail({
  item,
  onClose,
}: {
  item: Feedback;
  onClose: () => void;
}) {
  const { updateFeedback, deleteFeedback } = useAppData();
  const [note, setNote] = useState(item.note ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  const run = async (action: () => Promise<void>, close = false) => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      await action();
      if (live.current && close) onClose();
    } catch {
      if (live.current)
        setError(
          "Feedback could not be updated. Your changes are still here; please retry.",
        );
    } finally {
      busy.current = false;
      if (live.current) setPending(false);
    }
  };
  const noteDirty = note.trim() !== (item.note ?? "").trim();

  return (
    <>
      <Sheet
        open
        title={`${CATEGORY_LABEL[item.category]} feedback`}
        footer={
          <div className="flex w-full flex-wrap items-center justify-between gap-2 [&_button]:text-ink-2">
            <QuietButton
              disabled={pending}
              onClick={() => setConfirmDelete(true)}
            >
              Delete permanently
            </QuietButton>
            {item.status === "archived" ? (
              <SecondaryButton
                disabled={pending}
                onClick={() => {
                  void run(() => updateFeedback(item.id, { status: "new" }));
                }}
              >
                Restore
              </SecondaryButton>
            ) : (
              <SecondaryButton
                disabled={pending}
                onClick={() => {
                  void run(
                    () => updateFeedback(item.id, { status: "archived" }),
                    true,
                  );
                }}
              >
                Archive
              </SecondaryButton>
            )}
          </div>
        }
        label={`${CATEGORY_LABEL[item.category]} feedback`}
        onClose={onClose}
        width={560}
      >
        {error && (
          <p role="alert" className="pb-3 text-sm">
            {error}
          </p>
        )}
        {pending && (
          <p role="status" className="pb-2 text-sm">
            Saving feedback...
          </p>
        )}
        <header className="flex flex-wrap items-center justify-between gap-3 pb-4 [&_button]:text-ink-2">
          <p className="flex flex-wrap items-baseline gap-x-3 pr-10 text-[12.5px] text-ink-2">
            <span
              className={item.category === "bug" ? "text-accent" : "text-ink-2"}
            >
              {CATEGORY_LABEL[item.category]}
            </span>
            <span>{formatStamp(item.createdAt, true)}</span>
          </p>
          <div className="shrink-0">
            <DecisionMenu
              disabled={pending}
              popoverClassName="theme-workspace"
              label="Status"
              value={item.status}
              safe="new"
              options={STATUS_ORDER.map((status) => ({
                value: status,
                short: STATUS_LABEL[status],
                label: STATUS_LABEL[status],
              }))}
              onChange={(status) => {
                void run(() => updateFeedback(item.id, { status }));
              }}
            />
          </div>
        </header>

        <div className="min-w-0">
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink">
            {item.message}
          </p>

          {item.screenshot && (
            <a
              href={item.screenshot.url}
              target="_blank"
              rel="noreferrer"
              className="mt-6 block overflow-hidden rounded-[4px] border border-line"
            >
              <img
                src={item.screenshot.url}
                alt={`Screenshot: ${item.screenshot.name}`}
                className="mx-auto h-auto max-h-[180px] w-auto max-w-full object-contain md:max-h-[240px]"
              />
              <span className="block border-t border-line px-3 py-1.5 font-mono text-[11.5px] text-ink-2">
                {item.screenshot.name}
              </span>
            </a>
          )}

          <details className="mt-5 text-[12px]">
            <summary className="w-fit cursor-pointer rounded py-1 text-ink-2 hover:text-ink">
              Details
            </summary>
            <dl className="mt-3 grid grid-cols-[96px_minmax(0,1fr)] gap-y-2  text-[13px]">
              <dt className="text-ink-2">ID</dt>
              <dd className="break-all text-ink-2">{item.id}</dd>
              <dt className="text-ink-2">From</dt>
              <dd className="min-w-0 text-ink">
                {item.user ? (
                  <>
                    {item.user.name}
                    <span
                      className={`ml-2 text-ink-2 ${item.user.provider === "wca" ? "font-mono text-[12px]" : ""}`}
                    >
                      {item.user.detail}
                    </span>
                    <span className="ml-2 text-ink-2">
                      {item.user.provider === "wca" ? "WCA" : "Google"}
                    </span>
                  </>
                ) : (
                  <span className="text-ink-2">Signed out</span>
                )}
              </dd>
              {item.contact && (
                <>
                  <dt className="text-ink-2">Reply to</dt>
                  <dd className="min-w-0 truncate">
                    <a
                      href={`mailto:${item.contact}`}
                      className="text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink-3"
                    >
                      {item.contact}
                    </a>
                  </dd>
                </>
              )}
              <dt className="text-ink-2">Page</dt>
              <dd className="text-ink">{item.source}</dd>
              <dt className="text-ink-2">Submitted</dt>
              <dd className="text-ink">{formatStamp(item.createdAt, true)}</dd>
            </dl>

            {item.context && (
              <section className="mt-6">
                <h3 className="text-[12px] text-ink-2">Technical details</h3>
                <dl className="mt-2 grid grid-cols-[96px_minmax(0,1fr)] gap-y-1 font-mono text-[12px]">
                  {item.context.training && (
                    <>
                      <dt className="text-ink-2">Training</dt>
                      <dd className="text-ink-2">{item.context.training}</dd>
                    </>
                  )}
                  <dt className="text-ink-2">Build</dt>
                  <dd className="text-ink-2">{item.context.build}</dd>
                  <dt className="text-ink-2">Browser</dt>
                  <dd className="text-ink-2">{item.context.browser}</dd>
                  <dt className="text-ink-2">System</dt>
                  <dd className="text-ink-2">
                    {item.context.os} · {item.context.device}
                  </dd>
                  <dt className="text-ink-2">Window</dt>
                  <dd className="text-ink-2">{item.context.viewport}</dd>
                </dl>
              </section>
            )}
          </details>

          <section className="mt-5">
            <label
              htmlFor={`note-${item.id}`}
              className="flex items-baseline justify-between text-[12px] text-ink-2"
            >
              Private note
            </label>
            <textarea
              id={`note-${item.id}`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Add a note"
              className="mt-2 w-full resize-y rounded-[4px] border border-line-strong bg-surface px-3 py-2 text-[13px] leading-relaxed text-ink caret-accent outline-none placeholder:text-ink-2 focus:border-ink-3"
            />

            {noteDirty && (
              <div className="mt-2 flex justify-end gap-2 [&_button]:text-ink-2">
                <QuietButton
                  disabled={pending}
                  onClick={() => setNote(item.note ?? "")}
                >
                  Cancel
                </QuietButton>
                <SecondaryButton
                  disabled={pending}
                  onClick={() => {
                    void run(() =>
                      updateFeedback(item.id, {
                        note: note.trim() || undefined,
                      }),
                    );
                  }}
                >
                  Save note
                </SecondaryButton>
              </div>
            )}
          </section>
        </div>
      </Sheet>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete feedback permanently?"
        body="This can’t be undone. Archive keeps it out of the inbox without deleting it."
        onCancel={() => setConfirmDelete(false)}
        confirm={{
          label: "Delete",
          tone: "danger",
          onClick: () => {
            setConfirmDelete(false);
            void run(() => deleteFeedback(item.id), true);
          },
        }}
      />
    </>
  );
}
