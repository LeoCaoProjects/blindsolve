import React from "react";
import { timingClass, type TimingVisual } from "../../utils/timingInteraction";
import { RefreshCwIcon } from "lucide-react";
import { ScrambleRegion } from "../solve/ScrambleRegion";
import { ScrambleText } from "../solve/ScrambleText";

/** Timer is the visual source of truth, including every asynchronous state. */
export function WorkspaceScrambleHeader({
  scramble,
  pending,
  error,
  disabled,
  visual = "idle",
  onNewScramble,
  challengeId,
}: {
  scramble: string;
  pending: boolean;
  error: boolean;
  disabled: boolean;
  visual?: TimingVisual;
  onNewScramble: () => void;
  challengeId?: string;
}) {
  return (
    <section
      aria-label="Scramble"
      data-challenge-id={challengeId}
      className={`timer-workspace-inset relative flex shrink-0 items-start gap-3 border-b border-line pb-8 pt-5 vp-md:pb-9 vp-md:pt-6 ${
        timingClass(visual)
      }`}
    >
      <ScrambleRegion>
        {pending ? (
          <p
            role="status"
            className="min-w-0 flex-1 font-mono text-[clamp(15px,1.45vw,20px)] leading-[1.75] text-ink-3"
          >
            Preparing scramble…
          </p>
        ) : error && !scramble ? (
          <p
            role="alert"
            className="min-w-0 flex-1 font-mono text-[clamp(15px,1.45vw,20px)] leading-[1.75] text-danger"
          >
            Scramble unavailable. Try again.
          </p>
        ) : (
          <>
            <ScrambleText
              scramble={scramble}
              className="min-w-0 flex-1 text-[clamp(15px,1.45vw,20px)] leading-[1.75] text-ink"
            />
          </>
        )}
      </ScrambleRegion>
      <button
        type="button"
        onClick={onNewScramble}
        disabled={disabled}
        aria-busy={pending}
        aria-label="New scramble"
        title="New scramble"
        className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] focus-visible:outline focus-visible:outline-1 focus-visible:outline-accent text-ink-3 transition-colors duration-150 ease-out hover:bg-hover hover:text-ink-2 disabled:cursor-wait disabled:opacity-40"
      >
        <RefreshCwIcon size={14} strokeWidth={1.75} />
      </button>
      {error && scramble && (
        <span
          role="alert"
          className="absolute bottom-2 left-6 text-[11px] text-danger vp-md:left-24"
        >
          New scramble failed
        </span>
      )}
    </section>
  );
}
