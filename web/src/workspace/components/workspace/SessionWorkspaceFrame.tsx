import React, { useRef, useState } from "react";
import { useWorkspaceLocation } from "../../navigation/workspaces";
import { CaseSensitiveIcon } from "lucide-react";
import { useSessionWorkspace } from "../../contexts/SessionWorkspaceContext";
import { clamp, useElementSize } from "../../hooks/useElementSize";
import { SOLVED_STATE } from "../../utils/bld";
import { SubNavFrame } from "../layout/SubNavigation";
import { Cube3D } from "../cube/Cube3D";
import { CubeUtilityButton } from "../cube/CubeUtilityButton";
import { TimerModeControl } from "../timer/TimerModeControl";
import { WorkspaceHistory } from "./WorkspaceHistory";
import { TrainingHistory } from "../training/TrainingHistory";
import { TrainingRegion } from "../training/TrainingRegion";
import { TrainingHeader } from "../training/TrainingHeader";
import { WorkspaceScrambleHeader } from "./WorkspaceScrambleHeader";
import { PairCube } from "../practice/PairCube";
import { FlashcardHistory } from "../practice/FlashcardHistory";

/** A single mounted reference surface. Only the left workspace participates in
 * the existing contextual-nav slide; the cube never travels with that slide. */
export function SessionWorkspaceFrame({
  children,
}: {
  children: React.ReactNode;
}) {
  const { pathname } = useWorkspaceLocation();
  const flashcards = pathname === "/flashcards";
  const shared = pathname === "/" || pathname === "/training" || flashcards;
  const training = pathname === "/training";
  const { timer: s, training: t, flashcards: f } = useSessionWorkspace();
  const { phase } = s.timer;
  const [letters, setLetters] = useState(false);
  const [cubeRef, cubeBox] = useElementSize<HTMLDivElement>({
    width: 392,
    height: 330,
  });
  const cubeSize = clamp(
    Math.min(cubeBox.width - 56, cubeBox.height - 36),
    120,
    272,
  );
  const timerDisabled =
    s.running || s.overlayOpen || phase === "armed" || phase === "ready";
  const holdReady = training && t.hold.phase === "ready";
  const recede =
    training || flashcards
      ? ""
      : s.running
        ? "opacity-[0.1]"
        : phase === "ready"
          ? "opacity-40"
          : "";
  const scrambleMode =
    t.mode === "exec" || t.mode === "guided" || t.mode === "trace";
  const cubeVisible = !training || (t.mode !== "trace" && t.mode !== "recognition");
  // Retain the last real scramble while its region collapses; a non-scramble
  // drill must not replace it with an empty/pending header during the exit.
  const lastScramble = useRef({
    scramble: t.scramble,
    pending: !t.scrambleReady && !t.scrambleError,
    error: Boolean(t.scrambleError),
  });
  if (training && scrambleMode)
    lastScramble.current = {
      scramble: t.scramble,
      pending: !t.scrambleReady && !t.scrambleError,
      error: Boolean(t.scrambleError),
    };
  const header = (
    <WorkspaceScrambleHeader
      scramble={training ? lastScramble.current.scramble : s.scramble}
      pending={training ? lastScramble.current.pending : s.scramblePending}
      error={training ? lastScramble.current.error : s.scrambleError}
      disabled={
        training
          ? !t.scrambleReady && !t.scrambleError
          : timerDisabled || s.scramblePending
      }
      dimmed={training ? t.hold.phase !== "idle" : s.running}
      onNewScramble={training ? t.newScramble : s.newScramble}
      challengeId={training ? t.challengeId : undefined}
    />
  );
  const state = !training
    ? s.cubeState
    : t.mode === "recall" && t.phase === "idle"
      ? SOLVED_STATE
      : t.challenge.state;
  const cubeLabel = !training
    ? "Scrambled cube"
    : t.mode === "recall"
      ? t.phase === "idle"
        ? "Solved cube. The challenge appears when you start"
        : "The cube this memo was traced from"
      : "Your cube after this scramble";

  return (
    <SubNavFrame
      subnavClassName={holdReady ? "opacity-40" : ""}
      layoutClassName={
        shared
          ? `timer-layout grid h-full min-h-0 grid-cols-1 ${training || flashcards ? "training-workspace grid-rows-1" : "grid-rows-[minmax(0,1fr)_minmax(128px,25dvh)]"} vp-md:grid-rows-1`
          : undefined
      }
      header={
        shared && !flashcards ? (
          training ? (
            <TrainingRegion
              name="scramble"
              expanded={scrambleMode && t.phase === "idle"}
              mode={t.mode}
            >
              {header}
            </TrainingRegion>
          ) : (
            header
          )
        ) : null
      }
      reference={
        shared ? (
          <aside
            data-workspace-reference
            className={`timer-reference-column min-h-0 flex-col border-t border-line bg-surface transition-opacity duration-300 ease-out vp-md:border-l vp-md:border-t-0 ${training || flashcards ? "hidden vp-md:flex" : "flex"} ${training ? (t.running ? "opacity-[0.1]" : holdReady ? "opacity-40" : "") : recede}`}
          >
            <TrainingRegion
              name="cube"
              expanded={cubeVisible}
              mode={training ? t.mode : null}
            >
              <div
                ref={cubeRef}
                data-timer-cube-viewport
                className="timer-cube-viewport relative h-8 shrink-0 border-b border-line"
              >
                {!flashcards && (
                  <div
                    role="group"
                    aria-label={
                      training ? "Training utilities" : "Timer utilities"
                    }
                    className="pointer-events-none absolute inset-0 z-10"
                  >
                    {!training && (
                      <div className="pointer-events-auto absolute right-3 top-0.5 vp-md:top-1">
                        <TimerModeControl
                          value={s.timerMode}
                          onChange={s.setTimerMode}
                          disabled={timerDisabled}
                        />
                      </div>
                    )}
                    <CubeUtilityButton
                      label="Sticker letters"
                      pressed={letters}
                      onClick={() => setLetters((v) => !v)}
                      disabled={
                        !cubeVisible || (training && t.phase === "recall")
                      }
                      className={`cube-utility-letters pointer-events-auto absolute hidden vp-md:inline-flex `}
                    >
                      <CaseSensitiveIcon />
                    </CubeUtilityButton>
                  </div>
                )}
                <div
                  className={`absolute inset-0 hidden items-center justify-center vp-md:flex  ${training && scrambleMode && !t.scrambleReady ? "opacity-25" : ""}`}
                >
                  {flashcards
                    ? f.cardTokens && (
                        <PairCube
                          key="flashcards"
                          tokens={f.cardTokens}
                          type={f.cardType}
                          size={cubeSize}
                          animateOrientation
                        />
                      )
                    : !(training && (t.mode === "trace" || t.mode === "recognition")) && (
                        <Cube3D
                          state={state}
                          size={cubeSize}
                          showLetters={letters}
                          label={cubeLabel}
                        />
                      )}
                </div>
              </div>
            </TrainingRegion>
            {flashcards ? (
              <FlashcardHistory />
            ) : training ? (
              <div
                data-training-history
                className={`flex min-h-0 flex-1 flex-col transition-opacity duration-300 ease-out ${recede}`}
              >
                <TrainingHistory t={t} />
              </div>
            ) : (
              <WorkspaceHistory
                solves={s.solves}
                stats={s.stats}
                onSelect={s.selectSolve}
                onDelete={s.deleteSolve}
              />
            )}
          </aside>
        ) : null
      }
    >
      <div className="flex h-full min-h-0 flex-col">
        {training && <TrainingHeader t={t} />}
        <div className="min-h-0 flex-1">{children}</div>
      </div>
    </SubNavFrame>
  );
}
