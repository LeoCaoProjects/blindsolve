import { scrambleToState } from "../../domain/bld/cubing";
import type { CubeOrbitState } from "../../domain/bld/types";
import { compareTraceGroups } from "../utils/traceValidation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppData } from "../contexts/AppDataContext";
import { TrainMode } from "../data/trainingModes";
import {
  Challenge,
  TrainFilter,
  challengeFromScramble,
  makeChallenge,
} from "../utils/bld";
import { isTypingTarget, ownsTrainingSpace } from "../utils/keyboard";
import { pairKey, resolveWords } from "../utils/pairs";
import { tokensOf } from "../utils/scheme";
import {
  TrainGroup,
  accuracyForResults,
  compareGroups,
  fullPairs,
} from "../utils/training";
import { useHoldStart } from "./useHoldStart";
import { useStore } from "../../app/Store";
import { useExecScramble } from "./useExecScramble";
import { FIRST_EXEC_SEED } from "../utils/randomStateScramble";
import {
  challengeTargetsForMode,
  orderedChallengeGroups,
} from "../utils/challengeTargets";
import { guidedTiming } from "../utils/guidedSolve";

export type { TrainMode };
/** idle → (hold Space) → active → [recall] → review → idle */
export type TrainPhase =
  "idle" | "active" | "recall" | "memo" | "execution" | "report" | "review";
export type ExecDisplay = "letters" | "words";
export type ExecResult = "solved" | "dnf";

export interface Attempt {
  id: string;
  createdAt?: string;
  mode: TrainMode;
  ms: number;
  targets: number;
  correct: boolean;
  accuracy?: number;
  pairs?: number;
  memoMs?: number;
  executionMs?: number;
}

export interface TrainInit {
  mode?: TrainMode;
  filter?: TrainFilter;
  phase?: TrainPhase;
  seed?: number;
  answers?: "correct" | "typo";
  display?: ExecDisplay;
  report?: ExecResult;
  seen?: boolean;
  help?: boolean;
}

interface Times {
  start: number;
  split: number | null;
  end: number | null;
}

const SEEDED_MS: Record<TrainMode, { total: number; split?: number }> = {
  recall: { total: 25730, split: 18420 },
  trace: { total: 21860 },
  exec: { total: 48210 },
  guided: { total: 61270, split: 25120 },
};
const MODE_SEED_OFFSET: Record<TrainMode, number> = {
  exec: 0,
  guided: 101,
  recall: 202,
  trace: 303,
};

export function useTrainingSession(
  init: TrainInit,
  active = true,
  sharedFilter?: TrainFilter,
  onSharedFilterChange?: (filter: TrainFilter) => void,
) {
  const store = useStore();
  const { setup, pairs, prefs } = useAppData();
  const vocabulary = useMemo(() => tokensOf(setup.scheme), [setup.scheme]);
  const [mode, setModeState] = useState<TrainMode>(init.mode ?? "exec");
  const [localFilter, setFilterState] = useState<TrainFilter>(
    init.filter ?? "both",
  );
  const filter = sharedFilter ?? localFilter;
  const [phase, setPhase] = useState<TrainPhase>(init.phase ?? "idle");
  const initialSeed =
    init.seed ?? FIRST_EXEC_SEED + MODE_SEED_OFFSET[init.mode ?? "exec"];
  const [seed, setSeed] = useState(initialSeed);
  // Local/account/cloud data arrives after mount; history must follow the store.
  const history = useMemo<Attempt[]>(
    () =>
      store.data.attempts
        .filter(
          (attempt) =>
            attempt.kind === "memo" &&
            attempt.trainingMode === mode &&
            attempt.durationMs !== undefined,
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((attempt) => ({
          id: attempt.id,
          createdAt: attempt.createdAt,
          mode: attempt.trainingMode as TrainMode,
          ms: attempt.durationMs!,
          targets: attempt.targets ?? 0,
          correct: attempt.correct,
          accuracy: attempt.accuracy,
          pairs: attempt.pairs,
          memoMs: attempt.memoMs,
          executionMs: attempt.executionMs,
        })),
    [store.data.attempts, mode],
  );
  const [now, setNow] = useState(() => performance.now());
  const [display, setDisplay] = useState<ExecDisplay>(
    init.display ?? "letters",
  );
  const [report, setReport] = useState<ExecResult>(init.report ?? "solved");
  // React state updates are asynchronous. Keep the lifecycle guard synchronous so two
  // Enter/click events in the same frame cannot persist the same challenge twice.
  const phaseRef = useRef<TrainPhase>(init.phase ?? "idle");
  const submittedChallengeRef = useRef<string | null>(
    init.phase === "review"
      ? `${init.mode ?? "recall"}:${init.filter ?? "both"}:${initialSeed}`
      : null,
  );
  const previousFilterRef = useRef(filter);
  const submittedAttemptIdRef = useRef<string | null>(null);

  // Scramble-based drills trace the exact state produced by the shown scramble.
  const [failedScrambleKey, setFailedScrambleKey] = useState<string | null>(
    null,
  );
  const preparedScramble = useExecScramble(
    filter,
    seed,
    mode === "exec" || mode === "guided" || mode === "trace",
    setFailedScrambleKey,
  );
  const scramble = preparedScramble ?? "";
  const traceKey = `${filter}:${seed}:${scramble}`;
  const [traceState, setTraceState] = useState<{
    key: string;
    state: CubeOrbitState;
  } | null>(null);
  useEffect(() => {
    if (mode !== "trace" || !preparedScramble) return;
    let live = true;
    // Match the fixed face frame of the displayed Training scramble/cubes.
    scrambleToState(preparedScramble)
      .then((state) => {
        if (live) setTraceState({ key: traceKey, state });
      })
      .catch(() => {
        if (live) setFailedScrambleKey(`${filter}:${seed}`);
      });
    return () => {
      live = false;
    };
  }, [mode, preparedScramble, traceKey, filter, seed]);
  const traceReady = traceState?.key === traceKey;
  const scrambleReady =
    (mode !== "exec" && mode !== "guided" && mode !== "trace") ||
    (preparedScramble !== null && (mode !== "trace" || traceReady));
  const challenge: Challenge = useMemo(
    () =>
      (mode === "exec" || mode === "guided" || mode === "trace") &&
      preparedScramble
        ? challengeFromScramble(scramble, filter, seed, {
            ...setup,
            m2SecondTargetSwap: prefs.m2SecondTargetSwap,
          })
        : makeChallenge(filter, seed, {
            ...setup,
            m2SecondTargetSwap: prefs.m2SecondTargetSwap,
          }),
    [
      mode,
      preparedScramble,
      scramble,
      filter,
      seed,
      setup,
      prefs.m2SecondTargetSwap,
    ],
  );
  const groups: TrainGroup[] = useMemo(() => {
    return orderedChallengeGroups(challenge, mode, filter, prefs.memoOrder);
  }, [challenge, filter, mode, prefs.memoOrder]);

  const storedFor = useCallback(
    (a: string, b: string, piece: "corners" | "edges") =>
      resolveWords(pairs[pairKey(a, b)], piece).words,
    [pairs],
  );
  const wordFor = useCallback(
    (a: string, b: string, piece: "corners" | "edges") =>
      storedFor(a, b, piece)[0],
    [storedFor],
  );

  const [times, setTimes] = useState<Times>(() => seededTimes(init));
  const [inputs, setInputs] = useState<string[]>(() =>
    seededInputs(init, groups),
  );
  useEffect(() => {
    if (previousFilterRef.current === filter) return;
    previousFilterRef.current = filter;
    submittedChallengeRef.current = null;
    phaseRef.current = "idle";
    setPhase("idle");
    setInputs([]);
    setReport("solved");
    setTimes(seededTimes({ mode }));
  }, [filter, mode]);
  const running =
    phase === "active" ||
    phase === "recall" ||
    phase === "memo" ||
    phase === "execution";
  const results = useMemo(
    () =>
      mode === "trace" && traceReady
        ? compareTraceGroups(
            traceState!.state,
            store.data.scheme,
            groups,
            inputs,
            vocabulary,
          )
        : compareGroups(groups, inputs, vocabulary),
    [
      mode,
      traceReady,
      traceState,
      store.data.scheme,
      groups,
      inputs,
      vocabulary,
    ],
  );
  const targets =
    mode === "trace"
      ? results.reduce((n, g) => n + g.actual.length, 0)
      : groups.reduce((n, g) => n + g.tokens.length, 0);
  const pairCount = groups.reduce((n, g) => n + fullPairs(g.tokens).length, 0);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(performance.now()), 50);
    return () => window.clearInterval(id);
  }, [running]);

  const start = useCallback(() => {
    // Scramble-based modes keep their seed so targets and scramble stay identical.
    if (mode !== "exec" && mode !== "guided" && mode !== "trace")
      setSeed((s) => s + 1);
    setInputs(groups.map(() => ""));
    setReport("solved");
    const t = performance.now();
    setTimes({ start: t, split: null, end: null });
    setNow(t);
    submittedChallengeRef.current = null;
    submittedAttemptIdRef.current = null;
    const first: TrainPhase = mode === "guided" ? "memo" : "active";
    phaseRef.current = first;
    setPhase(first);
  }, [groups, mode]);

  const hold = useHoldStart({
    enabled: active && phase === "idle" && scrambleReady,
    onStart: start,
  });

  const toRecall = useCallback(() => {
    if (phaseRef.current !== "active") return;
    setTimes((t) => ({ ...t, split: performance.now() }));
    setInputs(groups.map(() => ""));
    phaseRef.current = "recall";
    setPhase("recall");
  }, [groups]);

  const startExecution = useCallback(() => {
    if (phaseRef.current !== "memo") return;
    const split = performance.now();
    setTimes((t) => ({ ...t, split }));
    setNow(split);
    phaseRef.current = "execution";
    setPhase("execution");
  }, []);

  const stopGuided = useCallback(() => {
    if (phaseRef.current !== "execution") return;
    const end = performance.now();
    setTimes((t) => ({ ...t, end }));
    setNow(end);
    phaseRef.current = "report";
    setPhase("report");
  }, []);

  const submit = useCallback(() => {
    const expectedPhase = mode === "recall" ? "recall" : "active";
    const challengeId = `${mode}:${filter}:${seed}`;
    if (
      phaseRef.current !== expectedPhase ||
      submittedChallengeRef.current === challengeId
    )
      return;
    submittedChallengeRef.current = challengeId;
    phaseRef.current = "review";
    const end = performance.now();
    setTimes((t) => ({ ...t, end }));
    setPhase("review");
    if (document.activeElement instanceof HTMLElement)
      document.activeElement.blur();
    const r = results;
    const ms =
      mode === "recall"
        ? (times.split ?? end) - times.start
        : end - times.start;
    const attempt: Attempt = {
      id: crypto.randomUUID(),
      mode,
      ms,
      targets,
      correct: mode === "exec" ? true : r.every((g) => g.correct),
      pairs: mode === "exec" ? pairCount : undefined,
    };
    submittedAttemptIdRef.current = attempt.id;
    store.update((data) => ({
      ...data,
      attempts: [
        {
          id: attempt.id,
          kind: "memo",
          correct: attempt.correct,
          ...(mode === "exec"
            ? {}
            : {
                accuracy: accuracyForResults(r),
              }),
          trainingMode: mode,
          durationMs: Math.round(ms),
          targets,
          ...(attempt.pairs !== undefined ? { pairs: attempt.pairs } : {}),
          createdAt: new Date().toISOString(),
        },
        ...data.attempts,
      ],
    }));
  }, [
    results,
    groups,
    inputs,
    vocabulary,
    mode,
    filter,
    seed,
    times,
    targets,
    pairCount,
    storedFor,
    store,
  ]);

  const removeAttempt = useCallback(
    (id: string) => {
      store.update((data) => ({
        ...data,
        attempts: data.attempts.filter((attempt) => attempt.id !== id),
      }));
    },
    [store],
  );
  const removeLatestAttempt = useCallback(() => {
    const latest = history.find((attempt) => attempt.mode === mode);
    if (!latest) return;
    removeAttempt(latest.id);
  }, [history, mode, removeAttempt]);
  const clearAttempts = useCallback(() => {
    store.update((data) => ({
      ...data,
      attempts: data.attempts.filter(
        (attempt) => attempt.trainingMode !== mode,
      ),
    }));
  }, [mode, store]);

  /** Execution-oriented setup: swap the scramble before starting, like the Timer's N. */
  const newScramble = useCallback(() => {
    if (phaseRef.current !== "idle") return;
    setSeed((s) => s + 1);
    setTimes(seededTimes({ mode }));
    setReport("solved");
  }, [mode]);

  /** Execution Sprint is self-reported; the latest attempt follows the Solved/DNF choice. */
  const setExecResult = useCallback(
    (r: ExecResult) => {
      if (phaseRef.current !== "review") return;
      setReport(r);
      const attemptId = submittedAttemptIdRef.current;
      // Seeded review previews have no saved attempt to edit.
      if (!attemptId) return;
      store.update((data) => {
        const index = data.attempts.findIndex(
          (attempt) =>
            attempt.id === attemptId && attempt.trainingMode === "exec",
        );
        if (index < 0) return data;
        const attempts = [...data.attempts];
        attempts[index] = {
          ...attempts[index],
          correct: r === "solved",
        };
        return { ...data, attempts };
      });
    },
    [store],
  );

  /** Persist Guided Solve exactly once, after the physical result is self-reported. */
  const finishGuided = useCallback(
    (result: ExecResult) => {
      const challengeId = `guided:${filter}:${seed}`;
      if (
        phaseRef.current !== "report" ||
        submittedChallengeRef.current === challengeId
      )
        return;
      submittedChallengeRef.current = challengeId;
      const end = times.end ?? performance.now();
      const split = times.split ?? end;
      const { memoMs, executionMs, totalMs } = guidedTiming(
        times.start,
        split,
        end,
      );
      const correct = result === "solved";
      const attemptId = Date.now();
      setReport(result);
      const shown = challengeTargetsForMode(challenge, "guided");
      store.update((data) => ({
        ...data,
        attempts: [
          {
            id: crypto.randomUUID(),
            kind: "memo",
            correct,
            trainingMode: "guided",
            durationMs: Math.round(totalMs),
            memoMs: Math.round(memoMs),
            executionMs: Math.round(executionMs),
            targets,
            pairs: pairCount,
            scope: filter,
            scramble,
            rawTargets: {
              corners: [...challenge.rawTargets.corners.physicalStickerIds],
              edges: [...challenge.rawTargets.edges.physicalStickerIds],
            },
            executionTargets: {
              corners: [
                ...challenge.executionTargets.corners.physicalStickerIds,
              ],
              edges: [...challenge.executionTargets.edges.physicalStickerIds],
            },
            tokenSnapshot: {
              corners: [...shown.corners.tokens],
              edges: [...shown.edges.tokens],
            },
            memoOrder: prefs.memoOrder,
            createdAt: new Date(attemptId).toISOString(),
          },
          ...data.attempts,
        ],
      }));
      phaseRef.current = "review";
      setPhase("review");
    },
    [
      challenge,
      filter,
      pairCount,
      prefs.memoOrder,
      scramble,
      seed,
      store,
      targets,
      times,
    ],
  );

  const next = useCallback(() => {
    if (mode === "exec" || mode === "guided" || mode === "trace")
      setSeed((s) => s + 1);
    phaseRef.current = "idle";
    setPhase("idle");
  }, [mode]);

  const setMode = (m: TrainMode) => {
    setModeState(m);
    submittedChallengeRef.current = null;
    phaseRef.current = "idle";
    setPhase("idle");
  };
  const setFilter = (f: TrainFilter) => {
    if (phaseRef.current !== "idle" || f === filter) return;
    if (onSharedFilterChange) onSharedFilterChange(f);
    else setFilterState(f);
    submittedChallengeRef.current = null;
    phaseRef.current = "idle";
    setPhase("idle");
  };

  // State-aware keys for the non-typing moments. Never fires from text fields.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.isComposing || e.metaKey || e.ctrlKey || e.altKey || e.repeat || e.defaultPrevented) return;
      const dialog = document.querySelector(
        '[role="dialog"], [role="alertdialog"]',
      );
      if (e.key === "Escape" && phase === "recall" && !dialog) {
        e.preventDefault();
        submit();
        return;
      }
      if (
        isTypingTarget(e.target) ||
        e.metaKey ||
        e.ctrlKey ||
        e.defaultPrevented ||
        dialog
      )
        return;
      if (
        (e.code === "Space" && !ownsTrainingSpace(e.target)) ||
        (e.target instanceof HTMLButtonElement && e.key === "Enter")
      )
        return;
      if (phase === "report" && mode === "guided") {
        if (e.key === "s" || e.key === "S") finishGuided("solved");
        if (e.key === "d" || e.key === "D") finishGuided("dnf");
        return;
      }
      if (
        phase === "active" &&
        mode === "recall" &&
        (e.key === "Enter" || e.code === "Space")
      ) {
        e.preventDefault();
        if (!e.repeat) toRecall();
      } else if (phase === "active" && mode === "exec" && e.code === "Space") {
        e.preventDefault();
        if (!e.repeat) submit();
      } else if (phase === "memo" && mode === "guided" && e.code === "Space") {
        e.preventDefault();
        if (!e.repeat) startExecution();
      } else if (
        phase === "execution" &&
        mode === "guided" &&
        e.code === "Space"
      ) {
        e.preventDefault();
        if (!e.repeat) stopGuided();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    active,
    phase,
    mode,
    toRecall,
    submit,
    startExecution,
    stopGuided,
    finishGuided,
  ]);

  const clock = running ? now : (times.end ?? now);
  const elapsed = {
    total: clock - times.start,
    memo: (times.split ?? clock) - times.start,
    recall: times.split !== null ? clock - times.split : 0,
    execution: times.split !== null ? clock - times.split : 0,
  };

  return {
    mode,
    setMode,
    filter,
    setFilter,
    phase,
    running,
    hold,
    challenge,
    challengeId: `${filter}:${seed}`,
    scramble,
    scrambleReady,
    scrambleError: failedScrambleKey === `${filter}:${seed}` && !scrambleReady,
    groups,
    vocabulary,
    targets,
    pairCount,
    wordFor,
    storedFor,
    removeAttempt,
    removeLatestAttempt,
    clearAttempts,
    newScramble,
    inputs,
    setInput: (i: number, v: string) =>
      setInputs((prev) => {
        const nextInputs = groups.map((_, j) => prev[j] ?? "");
        nextInputs[i] = v;
        return nextInputs;
      }),
    toRecall,
    submit,
    next,
    results,
    allCorrect: results.every((g) => g.correct),
    elapsed,
    history,
    reviewAttemptId: submittedAttemptIdRef.current,
    display,
    setDisplay,
    report,
    setExecResult,
    startExecution,
    stopGuided,
    finishGuided,
  };
}

export type TrainingSession = ReturnType<typeof useTrainingSession>;

function seededTimes(init: TrainInit): Times {
  const t = performance.now();
  const mode = init.mode ?? "exec";
  if (!init.phase || init.phase === "idle")
    return { start: t, split: null, end: t };
  if (
    init.phase === "active" ||
    init.phase === "memo" ||
    init.phase === "execution"
  )
    return {
      start: t - (mode === "exec" ? 17600 : mode === "guided" ? 24000 : 6400),
      split: init.phase === "execution" ? t - 8300 : null,
      end: null,
    };
  if (init.phase === "recall")
    return { start: t - 21800, split: t - 3400, end: null };
  const ms = SEEDED_MS[mode];
  const start = t - ms.total;
  return {
    start,
    split: ms.split !== undefined ? start + ms.split : null,
    end: t,
  };
}

function seededInputs(init: TrainInit, groups: TrainGroup[]): string[] {
  if (!init.answers) return groups.map(() => "");
  return groups.map((g, gi) => {
    const tokens = [...g.tokens];
    if (init.answers === "typo") {
      if (gi === 0 && tokens.length >= 4)
        [tokens[2], tokens[3]] = [tokens[3], tokens[2]];
      if (gi === groups.length - 1 && tokens.length > 2) tokens.pop();
    }
    return tokens.join(tokens.some((token) => token.length > 1) ? " " : "");
  });
}
