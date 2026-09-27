import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppData } from "../contexts/AppDataContext";
import { curatedSuggestions } from "../data/suggestions";
import { TrainMode } from "../data/trainingModes";
import {
  Challenge,
  TrainFilter,
  challengeFromScramble,
  makeChallenge,
} from "../utils/bld";
import { isTypingTarget } from "../utils/keyboard";
import { pairKey, resolveWords } from "../utils/pairs";
import { tokensOf } from "../utils/scheme";
import {
  TrainGroup,
  compareGroups,
  fullPairs,
  gradeFullMemo,
} from "../utils/training";
import { useHoldStart } from "./useHoldStart";
import { useStore } from "../../app/Store";
import { useExecScramble } from "./useExecScramble";
import { FIRST_EXEC_SEED } from "../utils/randomStateScramble";

export type { TrainMode };
/** idle → (hold Space) → active → [recall] → review → idle */
export type TrainPhase = "idle" | "active" | "recall" | "review";
export type ExecDisplay = "letters" | "words";
export type ExecResult = "solved" | "dnf";

export interface Attempt {
  id: number;
  mode: TrainMode;
  ms: number;
  targets: number;
  correct: boolean;
  pairs?: number;
}

export interface TrainInit {
  mode?: TrainMode;
  filter?: TrainFilter;
  phase?: TrainPhase;
  seed?: number;
  answers?: "correct" | "typo";
  words?: "mixed";
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
  full: { total: 61270 },
  exec: { total: 48210 },
};

const CHANGED_WORDS = ["roam", "tuba", "jacket", "lantern", "robin"];

export function useTrainingSession(init: TrainInit) {
  const store = useStore();
  const { setup, pairs, prefs } = useAppData();
  const vocabulary = useMemo(() => tokensOf(setup.scheme), [setup.scheme]);
  const [mode, setModeState] = useState<TrainMode>(init.mode ?? "recall");
  const [filter, setFilterState] = useState<TrainFilter>(init.filter ?? "both");
  const [phase, setPhase] = useState<TrainPhase>(init.phase ?? "idle");
  const [seed, setSeed] = useState(init.seed ?? FIRST_EXEC_SEED);
  const [history, setHistory] = useState<Attempt[]>(() =>
    store.data.attempts
      .filter(
        (attempt) => attempt.trainingMode && attempt.durationMs !== undefined,
      )
      .map((attempt) => ({
        id: Date.parse(attempt.createdAt),
        mode: attempt.trainingMode!,
        ms: attempt.durationMs!,
        targets: attempt.targets ?? 0,
        correct: attempt.correct,
        pairs: attempt.pairs,
      })),
  );
  const [now, setNow] = useState(() => performance.now());
  const [display, setDisplay] = useState<ExecDisplay>(
    init.display ?? "letters",
  );
  const [report, setReport] = useState<ExecResult>(init.report ?? "solved");

  // Execution Sprint: the scramble shown during setup IS the challenge — same seed, same state.
  const preparedScramble = useExecScramble(filter, seed, mode === "exec");
  const scramble = preparedScramble ?? "";
  const scrambleReady = mode !== "exec" || preparedScramble !== null;
  const challenge: Challenge = useMemo(
    () =>
      mode === "exec" && preparedScramble
        ? challengeFromScramble(scramble, filter, seed, setup)
        : makeChallenge(filter, seed, setup),
    [mode, preparedScramble, scramble, filter, seed, setup],
  );
  const groups: TrainGroup[] = useMemo(() => {
    const g: TrainGroup[] = [];
    if (filter !== "edges")
      g.push({ piece: "corners", tokens: challenge.corners });
    if (filter !== "corners")
      g.push({ piece: "edges", tokens: challenge.edges });
    return g;
  }, [challenge, filter]);

  const storedFor = useCallback(
    (a: string, b: string, piece: "corners" | "edges") =>
      resolveWords(pairs[pairKey(a, b)], piece, prefs.sharing).words,
    [pairs, prefs.sharing],
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
  const [words, setWords] = useState<string[][]>(() =>
    seededWords(init, groups, wordFor),
  );

  const running = phase === "active" || phase === "recall";
  const targets = groups.reduce((n, g) => n + g.tokens.length, 0);
  const pairCount = groups.reduce((n, g) => n + fullPairs(g.tokens).length, 0);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(performance.now()), 50);
    return () => window.clearInterval(id);
  }, [running]);

  const start = useCallback(() => {
    // Exec keeps its seed so the memo matches the scramble the user just applied.
    if (mode !== "exec") setSeed((s) => s + 1);
    setInputs(groups.map(() => ""));
    setWords(groups.map(() => []));
    setReport("solved");
    const t = performance.now();
    setTimes({ start: t, split: null, end: null });
    setNow(t);
    setPhase("active");
  }, [groups, mode]);

  const hold = useHoldStart({ enabled: phase === "idle" && scrambleReady, onStart: start });

  const toRecall = useCallback(() => {
    setTimes((t) => ({ ...t, split: performance.now() }));
    setInputs(groups.map(() => ""));
    setPhase("recall");
  }, [groups]);

  const results = useMemo(
    () => compareGroups(groups, inputs, vocabulary),
    [groups, inputs, vocabulary],
  );

  const submit = useCallback(() => {
    const end = performance.now();
    setTimes((t) => ({ ...t, end }));
    setPhase("review");
    const r = compareGroups(groups, inputs, vocabulary);
    const ms =
      mode === "recall"
        ? (times.split ?? end) - times.start
        : end - times.start;
    const attempt: Attempt = {
      id: Date.now(),
      mode,
      ms,
      targets,
      correct:
        mode === "exec"
          ? true
          : mode === "full"
            ? gradeFullMemo(groups, words, storedFor).every(
                (row) => row.status === "main" || row.status === "alternate",
              )
            : r.every((g) => g.correct),
      pairs: mode === "full" || mode === "exec" ? pairCount : undefined,
    };
    setHistory((h) => [attempt, ...h]);
    const rows = mode === "full" ? gradeFullMemo(groups, words, storedFor) : [];
    store.update((data) => ({
      ...data,
      attempts: [
        {
          id: crypto.randomUUID(),
          kind: "memo",
          correct: attempt.correct,
          accuracy:
            mode === "full"
              ? rows.filter(
                  (row) => row.status === "main" || row.status === "alternate",
                ).length / Math.max(1, pairCount)
              : r.reduce(
                  (sum, group) => sum + group.actual.length - group.wrong,
                  0,
                ) / Math.max(1, targets),
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
    groups,
    inputs,
    vocabulary,
    mode,
    times,
    targets,
    words,
    pairCount,
    storedFor,
    store,
  ]);

  const removeAttempt = useCallback((id: number) => {
    setHistory((h) => h.filter((a) => a.id !== id));
    store.update((data) => ({ ...data, attempts: data.attempts.filter((attempt) => Date.parse(attempt.createdAt) !== id) }));
  }, [store]);
  const removeLatestAttempt = useCallback(
    () => {
      const latest = history.find((attempt) => attempt.mode === mode);
      if (!latest) return;
      removeAttempt(latest.id);
    },
    [history, mode, removeAttempt],
  );
  const clearAttempts = useCallback(
    () => {
      setHistory((h) => h.filter((a) => a.mode !== mode));
      store.update((data) => ({ ...data, attempts: data.attempts.filter((attempt) => attempt.trainingMode !== mode) }));
    },
    [mode, store],
  );

  /** Execution Sprint setup: swap the scramble before starting, like the Timer's N. */
  const newScramble = useCallback(() => {
    if (phase === "idle") setSeed((s) => s + 1);
  }, [phase]);

  /** Execution Sprint is self-reported; the latest attempt follows the Solved/DNF choice. */
  const setExecResult = useCallback((r: ExecResult) => {
    setReport(r);
    setHistory((h) =>
      h[0]?.mode === "exec"
        ? [{ ...h[0], correct: r === "solved" }, ...h.slice(1)]
        : h,
    );
    store.update((data) => {
      const index = data.attempts.findIndex((attempt) => attempt.trainingMode === "exec");
      if (index < 0) return data;
      const attempts = [...data.attempts];
      attempts[index] = { ...attempts[index], correct: r === "solved", accuracy: r === "solved" ? 1 : 0 };
      return { ...data, attempts };
    });
  }, [store]);

  const next = useCallback(() => {
    if (mode === "exec") setSeed((s) => s + 1);
    setPhase("idle");
  }, [mode]);

  const setMode = (m: TrainMode) => {
    setModeState(m);
    setPhase("idle");
  };
  const setFilter = (f: TrainFilter) => {
    setFilterState(f);
    setPhase("idle");
  };

  // State-aware keys for the non-typing moments. Never fires from text fields.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
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
        e.target instanceof HTMLButtonElement &&
        (e.key === "Enter" || e.code === "Space")
      )
        return;
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
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, mode, toRecall, submit]);

  const clock = running ? now : (times.end ?? now);
  const elapsed = {
    total: clock - times.start,
    memo: (times.split ?? clock) - times.start,
    recall: times.split !== null ? clock - times.split : 0,
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
    scramble,
    scrambleReady,
    groups,
    vocabulary,
    targets,
    pairCount,
    wordFor,
    storedFor,
    fullRows: gradeFullMemo(groups, words, storedFor),
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
    words,
    setGroupWords: (i: number, w: string[]) =>
      setWords((prev) => {
        const nextWords = groups.map((_, j) => prev[j] ?? []);
        nextWords[i] = w;
        return nextWords;
      }),
    toRecall,
    submit,
    next,
    results,
    allCorrect: results.every((g) => g.correct),
    elapsed,
    history: history.filter((h) => h.mode === mode),
    display,
    setDisplay,
    report,
    setExecResult,
  };
}

export type TrainingSession = ReturnType<typeof useTrainingSession>;

function seededTimes(init: TrainInit): Times {
  const t = performance.now();
  const mode = init.mode ?? "recall";
  if (!init.phase || init.phase === "idle")
    return { start: t, split: null, end: t };
  if (init.phase === "active")
    return {
      start: t - (mode === "exec" ? 17600 : 6400),
      split: null,
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
    return tokens.join("");
  });
}

function seededWords(
  init: TrainInit,
  groups: TrainGroup[],
  stored: (
    a: string,
    b: string,
    piece: "corners" | "edges",
  ) => string | undefined,
): string[][] {
  if (init.words !== "mixed") return groups.map(() => []);
  let changed = 0;
  let skipped = false;
  return groups.map((g) =>
    fullPairs(g.tokens).map(([a, b], i) => {
      const word = stored(a, b, g.piece);
      if (!word)
        return curatedSuggestions[a + b]?.[0]?.word ?? `${a}${b}`.toLowerCase();
      if (i === 1 && changed < 2) return CHANGED_WORDS[changed++];
      if (i === 3 && !skipped) {
        skipped = true;
        return "";
      }
      return word;
    }),
  );
}
