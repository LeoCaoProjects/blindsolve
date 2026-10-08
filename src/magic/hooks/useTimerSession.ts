import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppData } from "../contexts/AppDataContext";
import { useStore } from "../../app/Store";
import {
  generateBlindScramble,
  scrambleToState,
} from "../../domain/bld/cubing";
import { traceMemo, traceWithCanonicalBreaks } from "../../domain/bld/trace";
import type { MemoTrace, TraceTarget } from "../../domain/bld/types";
import {
  applyM2SecondTargetSwap,
  m2NeedsParity,
  m2SecondTargetStickerId,
} from "../../domain/bld/memoConventions";
import type { MemoPair } from "../types/solve";
import { DemoStage, Penalty, SolveDraft } from "../types/solve";
import { stateFromScramble } from "../utils/cube";
import { isTypingTarget } from "../utils/keyboard";
import { sessionStats } from "../utils/time";
import type { ReconResult } from "./useReconstruction";
import { TimerResult, isRunning, useTimer } from "./useTimer";

interface Options {
  multiphase: boolean;
  stage: DemoStage;
  initialSessionsOpen?: boolean;
}

export function useTimerSession({
  multiphase,
  stage: _stage,
  initialSessionsOpen = false,
}: Options) {
  const store = useStore();
  const {
    solves,
    setSolves,
    timerDb: db,
    applyTimerDbUpdates,
    activeSessionId,
    prefs,
  } = useAppData();
  const [scramble, setScramble] = useState("");
  const [draft, setDraft] = useState<SolveDraft | null>(null);
  const [reconOpen, setReconOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [sessionsOpen, setSessionsOpen] = useState(initialSessionsOpen);

  const traceRef = useRef<MemoTrace | null>(null);
  const scrambleRef = useRef(scramble);
  const draftRef = useRef(draft);
  scrambleRef.current = scramble;
  draftRef.current = draft;

  const handleStop = useCallback(
    (r: TimerResult) => {
      void (async () => {
        const scheme = store.data.scheme;
        // Scramble notation is always interpreted in the fixed white-top/green-front frame.
        const state = await scrambleToState(scrambleRef.current);
        const { trace, choices } = traceWithCanonicalBreaks(state, scheme);
        const presentedTrace =
          prefs.m2SecondTargetSwap && scheme.edgeMethod === "m2"
            ? { ...trace, edges: applyM2SecondTargetSwap(trace.edges, scheme) }
            : trace;
        traceRef.current = trace;
        const pair = (tokens: string[]) =>
          Array.from(
            { length: Math.ceil(tokens.length / 2) },
            (_, i) => (tokens[i * 2] ?? "") + (tokens[i * 2 + 1] ?? ""),
          );
        const sampleFor = (piece: "corners" | "edges") => {
          const section = presentedTrace[piece],
            tokens = section.targets.map((t) => t.token);
          const at = section.targets.findIndex((t) => t.cycleBreak);
          if (at < 0) return { pairs: pair(tokens) };
          const partial = traceMemo(state, scheme, {
            corners: piece === "corners" ? [] : choices.corners,
            edges: piece === "edges" ? [] : choices.edges,
          })[piece];
          const options = partial.validCycleBreaks.map(
            (id) =>
              scheme.stickers[
                piece === "edges" &&
                prefs.m2SecondTargetSwap &&
                scheme.edgeMethod === "m2"
                  ? m2SecondTargetStickerId(id, partial.targets.length)
                  : id
              ].label,
          );
          return {
            pairs: pair(tokens),
            break: {
              at,
              options: options.length ? options : [section.targets[at].token],
              answer: section.targets[at].token,
            },
          };
        };
        const corners = sampleFor("corners"),
          edges = sampleFor("edges");
        const solveId = crypto.randomUUID(),
          date = new Date().toISOString();
        store.update((data) => ({
          ...data,
          solves: [
            {
              id: solveId,
              scramble: scrambleRef.current,
              memoMs: Math.round(r.memo ?? 0),
              executionMs: Math.round(r.total - (r.memo ?? 0)),
              totalMs: Math.round(r.total),
              result: "success",
              edgeMemo: [],
              cornerMemo: [],
              cycleBreaks: choices,
              schemeSnapshot: scheme,
              reconstruction: "pending",
              engineVersion: 3,
              multiphase,
              sessionId: activeSessionId,
              createdAt: date,
            },
            ...data.solves,
          ],
        }));
        setDraft({
          solveId,
          time: r.total,
          memoTime: r.memo,
          scramble: scrambleRef.current,
          date,
          sample: {
            corners: corners.pairs,
            edges: edges.pairs,
            m2Parity: scheme.edgeMethod === "m2" && m2NeedsParity(trace.edges),
            ...(corners.break ? { cornerBreak: corners.break } : {}),
            ...(edges.break ? { edgeBreak: edges.break } : {}),
          },
          engine: { state, scheme },
          memoPrefs: {
            m2SecondTargetSwap: prefs.m2SecondTargetSwap,
            memoOrder: prefs.memoOrder,
          },
        });
      })();
    },
    [
      multiphase,
      store,
      activeSessionId,
      prefs.m2SecondTargetSwap,
      prefs.memoOrder,
    ],
  );

  const overlayOpen =
    draft !== null || selectedId !== null || shortcutsOpen || sessionsOpen;
  const timer = useTimer({
    multiphase,
    disabled: overlayOpen,
    onStop: handleStop,
  });
  const running = isRunning(timer.phase);
  const newScramble = useCallback(
    async () => setScramble(await generateBlindScramble()),
    [],
  );

  // Hold the finished time on screen for a beat before reconstruction takes over.
  useEffect(() => {
    if (!draft || reconOpen) return;
    const t = window.setTimeout(() => setReconOpen(true), 520);
    return () => window.clearTimeout(t);
  }, [draft, reconOpen]);

  const saveSolve = useCallback(
    (result: ReconResult) => {
      const d = draftRef.current;
      if (!d) return;
      const rawTrace = d.engine
        ? traceMemo(d.engine.state, d.engine.scheme, result.cycleBreaks)
        : traceRef.current;
      const trace =
        rawTrace &&
        d.engine &&
        d.memoPrefs?.m2SecondTargetSwap &&
        d.engine.scheme.edgeMethod === "m2"
          ? {
              ...rawTrace,
              edges: applyM2SecondTargetSwap(rawTrace.edges, d.engine.scheme),
            }
          : rawTrace;
      if (d.solveId && trace)
        store.update((data) => ({
          ...data,
          solves: data.solves.map((solve) =>
            solve.id === d.solveId
              ? {
                  ...solve,
                  result: result.penalty === "ok" ? "success" : result.penalty,
                  cornerMemo: trace.corners.targets.map((t) => t.token),
                  edgeMemo: trace.edges.targets.map((t) => t.token),
                  cycleBreaks: result.cycleBreaks,
                  memoSnapshot: {
                    corners: snapshot(
                      rawTrace!.corners.targets,
                      result.memo.corners,
                      trace.corners.targets,
                    ),
                    edges: snapshot(
                      rawTrace!.edges.targets,
                      result.memo.edges,
                      trace.edges.targets,
                    ),
                  },
                  reconstruction: "complete",
                  updatedAt: new Date().toISOString(),
                }
              : solve,
          ),
        }));
      applyTimerDbUpdates(result.dbUpdates);
      setReconOpen(false);
      setDraft(null);
      void newScramble();
    },
    [applyTimerDbUpdates, store],
  );

  const selectSolve = useCallback((id: string) => setSelectedId(id), []);
  const closeDetails = useCallback(() => setSelectedId(null), []);
  const setPenalty = useCallback(
    (id: string, penalty: Penalty) => {
      setSolves((prev) =>
        prev.map((s) => (s.id === id ? { ...s, penalty } : s)),
      );
    },
    [setSolves],
  );
  const deleteSolve = useCallback(
    (id: string) => {
      setSolves((prev) => prev.filter((s) => s.id !== id));
      setSelectedId(null);
    },
    [setSolves],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey)
        return;
      if (e.key === "?") {
        setShortcutsOpen((o) => !o);
        return;
      }
      if (shortcutsOpen && e.key === "Escape") {
        setShortcutsOpen(false);
        return;
      }
      if (sessionsOpen || draftRef.current || selectedId || shortcutsOpen)
        return;
      if ((e.key === "n" || e.key === "N") && !running) newScramble();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [newScramble, running, selectedId, shortcutsOpen, sessionsOpen]);

  useEffect(() => {
    if (!scramble) void newScramble();
  }, [newScramble, scramble]);

  const cubeState = useMemo(() => stateFromScramble(scramble), [scramble]);
  const stats = useMemo(() => sessionStats(solves), [solves]);
  const selected = solves.find((s) => s.id === selectedId) ?? null;
  const latest = solves[0] ?? null;
  const lastPenalty =
    timer.phase === "stopped" &&
    !draft &&
    latest &&
    Math.abs(latest.time - timer.elapsed) < 1
      ? latest.penalty
      : null;

  return {
    timer,
    running,
    solves,
    latest,
    db,
    scramble,
    cubeState,
    newScramble,
    draft,
    reconOpen,
    saveSolve,
    selected,
    selectSolve,
    closeDetails,
    setPenalty,
    deleteSolve,
    clearSolves: () => setSolves(() => []),
    deleteLatest: () => setSolves((previous) => previous.slice(1)),
    overlayOpen,
    stats,
    lastPenalty,
    nextIndex: (latest?.index ?? 0) + 1,
    shortcutsOpen,
    openShortcuts: () => setShortcutsOpen(true),
    closeShortcuts: () => setShortcutsOpen(false),
    sessionsOpen,
    openSessions: () => setSessionsOpen(true),
    closeSessions: () => setSessionsOpen(false),
  };
}

export type TimerSession = ReturnType<typeof useTimerSession>;

export function snapshot(
  rawTargets: TraceTarget[],
  words: MemoPair[],
  presentedTargets: TraceTarget[] = rawTargets,
) {
  return Array.from(
    { length: Math.ceil(rawTargets.length / 2) },
    (_, index) => {
      const rawFirst = rawTargets[index * 2],
        rawSecond = rawTargets[index * 2 + 1],
        first = presentedTargets[index * 2] ?? rawFirst,
        second = presentedTargets[index * 2 + 1] ?? rawSecond;
      return {
        firstStickerId: rawFirst.stickerId,
        ...(rawSecond ? { secondStickerId: rawSecond.stickerId } : {}),
        firstToken: first.token,
        ...(second ? { secondToken: second.token } : {}),
        mnemonic: words[index]?.word ?? "",
        firstCycleBreak: rawFirst.cycleBreak,
        ...(rawSecond ? { secondCycleBreak: rawSecond.cycleBreak } : {}),
      };
    },
  );
}
