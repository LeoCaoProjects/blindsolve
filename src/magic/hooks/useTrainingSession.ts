import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppData } from '../contexts/AppDataContext';
import { curatedSuggestions } from '../data/suggestions';
import { Challenge, TrainFilter, makeChallenge } from '../utils/bld';
import { isTypingTarget } from '../utils/keyboard';
import { pairKey, resolveWords } from '../utils/pairs';
import { tokensOf } from '../utils/scheme';
import { TrainGroup, compareGroups, fullPairs } from '../utils/training';
import { useHoldStart } from './useHoldStart';
import { useStore } from '../../app/Store';

export type TrainMode = 'recall' | 'trace' | 'full';
/** idle → (hold Space) → active → [recall] → review → idle */
export type TrainPhase = 'idle' | 'active' | 'recall' | 'review';

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
  answers?: 'correct' | 'typo';
  words?: 'mixed';
}

interface Times {
  start: number;
  split: number | null;
  end: number | null;
}

const SEEDED_MS: Record<TrainMode, {total: number;split?: number;}> = {
  recall: { total: 25730, split: 18420 },
  trace: { total: 21860 },
  full: { total: 61270 }
};

const CHANGED_WORDS = ['roam', 'tuba', 'jacket', 'lantern', 'robin'];

export function useTrainingSession(init: TrainInit) {
  const store = useStore();
  const { setup, pairs, prefs } = useAppData();
  const vocabulary = useMemo(() => tokensOf(setup.scheme), [setup.scheme]);
  const [mode, setModeState] = useState<TrainMode>(init.mode ?? 'recall');
  const [filter, setFilterState] = useState<TrainFilter>(init.filter ?? 'both');
  const [phase, setPhase] = useState<TrainPhase>(init.phase ?? 'idle');
  const [seed, setSeed] = useState(init.seed ?? randomSeed());
  const [history, setHistory] = useState<Attempt[]>(() => store.data.attempts
    .filter((a) => a.trainingMode && a.durationMs !== undefined)
    .map((a) => ({ id: Date.parse(a.createdAt), mode: a.trainingMode!, ms: a.durationMs!, targets: a.targets ?? 0, correct: a.correct, pairs: a.pairs })));
  const [now, setNow] = useState(() => performance.now());

  const challenge: Challenge = useMemo(() => makeChallenge(filter, seed, setup), [filter, seed, setup]);
  const groups: TrainGroup[] = useMemo(() => {
    const g: TrainGroup[] = [];
    if (filter !== 'edges') g.push({ piece: 'corners', tokens: challenge.corners });
    if (filter !== 'corners') g.push({ piece: 'edges', tokens: challenge.edges });
    return g;
  }, [challenge, filter]);

  const [times, setTimes] = useState<Times>(() => seededTimes(init));
  const [inputs, setInputs] = useState<string[]>(() => seededInputs(init, groups));
  const [words, setWords] = useState<string[][]>(() => seededWords(init, groups, (a, b, piece) => resolveWords(pairs[pairKey(a, b)], piece, prefs.sharing).words[0]));

  const running = phase === 'active' || phase === 'recall';
  const targets = groups.reduce((n, g) => n + g.tokens.length, 0);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(performance.now()), 50);
    return () => window.clearInterval(id);
  }, [running]);

  const start = useCallback(() => {
    setSeed(randomSeed());
    setInputs(groups.map(() => ''));
    setWords(groups.map(() => []));
    const t = performance.now();
    setTimes({ start: t, split: null, end: null });
    setNow(t);
    setPhase('active');
  }, [groups]);

  const hold = useHoldStart({ enabled: phase === 'idle', onStart: start });

  const toRecall = useCallback(() => {
    setTimes((t) => ({ ...t, split: performance.now() }));
    setInputs(groups.map(() => ''));
    setPhase('recall');
  }, [groups]);

  const results = useMemo(() => compareGroups(groups, inputs, vocabulary), [groups, inputs, vocabulary]);

  const submit = useCallback(() => {
    const end = performance.now();
    setTimes((t) => ({ ...t, end }));
    setPhase('review');
    const r = compareGroups(groups, inputs, vocabulary);
    const ms = mode === 'recall' ? (times.split ?? end) - times.start : end - times.start;
    const attempt: Attempt = {
      id: Date.now(),
      mode,
      ms,
      targets,
      correct: mode === 'full' ? words.flat().length > 0 : r.every((g) => g.correct),
      pairs: mode === 'full' ? groups.reduce((n, g) => n + fullPairs(g.tokens).length, 0) : undefined
    };
    setHistory((h) => [attempt, ...h]);
    store.update((data) => ({ ...data, attempts: [{
      id: crypto.randomUUID(), kind: 'memo', correct: attempt.correct,
      accuracy: mode === 'full' ? (words.flat().filter(Boolean).length / Math.max(1, attempt.pairs ?? 0)) :
        (r.reduce((n, g) => n + g.actual.length - g.wrong, 0) / Math.max(1, targets)),
      trainingMode: mode, durationMs: Math.round(ms), targets,
      ...(attempt.pairs !== undefined ? { pairs: attempt.pairs } : {}),
      createdAt: new Date().toISOString(),
    }, ...data.attempts] }));
  }, [groups, inputs, vocabulary, mode, times, targets, words, store]);

  const next = useCallback(() => setPhase('idle'), []);

  const setMode = (m: TrainMode) => {
    setModeState(m);
    setPhase('idle');
  };
  const setFilter = (f: TrainFilter) => {
    setFilterState(f);
    setPhase('idle');
  };

  // Keyboard for the non-typing moments. Space during study ends it (like the Timer's memo split).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && phase === 'recall' && !document.querySelector('[role="dialog"], [role="alertdialog"]')) {
        e.preventDefault();
        submit();
        return;
      }
      if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.defaultPrevented) return;
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
      if (e.target instanceof HTMLButtonElement && (e.key === 'Enter' || e.code === 'Space')) return;
      if (phase === 'active' && mode === 'recall' && (e.key === 'Enter' || e.code === 'Space')) {
        e.preventDefault();
        if (!e.repeat) toRecall();
      } else if (phase === 'review' && e.key === 'Enter') {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, mode, toRecall, next, submit]);

  const clock = running ? now : times.end ?? now;
  const elapsed = {
    total: clock - times.start,
    memo: (times.split ?? clock) - times.start,
    recall: times.split !== null ? clock - times.split : 0
  };

  const modeHistory = history.filter((h) => h.mode === mode);

  return {
    mode,
    setMode,
    filter,
    setFilter,
    phase,
    running,
    hold,
    challenge,
    groups,
    vocabulary,
    targets,
    inputs,
    setInput: (i: number, v: string) =>
    setInputs((prev) => {
      const nextInputs = groups.map((_, j) => prev[j] ?? '');
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
    history: modeHistory
  };
}

function randomSeed() {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return value[0];
}

export type TrainingSession = ReturnType<typeof useTrainingSession>;

function seededTimes(init: TrainInit): Times {
  const t = performance.now();
  const mode = init.mode ?? 'recall';
  if (!init.phase || init.phase === 'idle') return { start: t, split: null, end: t };
  if (init.phase === 'active') return { start: t - 6400, split: null, end: null };
  if (init.phase === 'recall') return { start: t - 21800, split: t - 3400, end: null };
  const ms = SEEDED_MS[mode];
  const start = t - ms.total;
  return { start, split: ms.split !== undefined ? start + ms.split : null, end: t };
}

function seededInputs(init: TrainInit, groups: TrainGroup[]): string[] {
  if (!init.answers) return groups.map(() => '');
  return groups.map((g, gi) => {
    const tokens = [...g.tokens];
    if (init.answers === 'typo') {
      if (gi === 0 && tokens.length >= 4) [tokens[2], tokens[3]] = [tokens[3], tokens[2]];
      if (gi === groups.length - 1 && tokens.length > 2) tokens.pop();
    }
    return tokens.join('');
  });
}

function seededWords(
init: TrainInit,
groups: TrainGroup[],
stored: (a: string, b: string, piece: 'corners' | 'edges') => string | undefined)
: string[][] {
  if (init.words !== 'mixed') return groups.map(() => []);
  let changed = 0;
  return groups.map((g) =>
  fullPairs(g.tokens).map(([a, b], i) => {
    const word = stored(a, b, g.piece);
    if (!word) return curatedSuggestions[a + b]?.[0]?.word ?? `${a}${b}`.toLowerCase();
    if (i === 1 && changed < 2) return CHANGED_WORDS[changed++];
    return word;
  })
  );
}
