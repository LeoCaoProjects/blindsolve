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
  isClassicM2Configuration,
  m2ExecutionRepresentation,
  m2SecondTargetStickerId,
} from "../../domain/bld/memoConventions";
import { inferM2OrientationFromBuffer } from "../../domain/bld/orientation";
import type { MemoPair } from "../types/solve";
import { DemoStage, Penalty, SolveDraft } from "../types/solve";
import { stateFromScramble } from "../utils/cube";
import { isTypingTarget } from "../utils/keyboard";
import { sessionStats, storedTimerTimes } from "../utils/time";
import type { ReconResult } from "./useReconstruction";
import { TimerResult, isRunning, useTimer } from "./useTimer";
import { randomStateScramble } from "../utils/randomStateScramble";
import { memoPairReference } from "../../domain/letterPairs/identity";
import {
  timerCategory,
  timerPieces,
  type TimerMode,
} from "../utils/timerModes";

interface Options {
  multiphase: boolean;
  stage: DemoStage;
  active?: boolean;
}

export function useTimerSession({
  multiphase,
  stage: _stage,
  active = true,
}: Options) {
  const store = useStore();
  const ownerKey = store.user?.id ?? "guest";
  const ownerRef = useRef(ownerKey);
  ownerRef.current = ownerKey;
  const alive = useRef(true);
  const {
    solves,
    setSolves,
    timerDb: db,
    setDefaultWords,
    timerMode,
    setTimerMode,
    prefs,
  } = useAppData();
  const [scramble, setScramble] = useState("");
  const [scrambleMode, setScrambleMode] = useState<TimerMode>(timerMode);
  const [scramblePending, setScramblePending] = useState(false);
  const [scrambleError, setScrambleError] = useState(false);
  const [draft, setDraft] = useState<SolveDraft | null>(null);
  const [reconOpen, setReconOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [processingStop, setProcessingStop] = useState(false);

  const traceRef = useRef<MemoTrace | null>(null);
  const scrambleRequestRef = useRef(0);
  const scrambleRef = useRef(scramble);
  const draftRef = useRef(draft);
  scrambleRef.current = scramble;
  draftRef.current = draft;

  const handleStop = useCallback(
    (r: TimerResult) => {
      void (async () => {
        setProcessingStop(true);
        const stoppedScramble = scrambleRef.current;
        const stoppedMode = timerMode;
        const stoppedOwner = ownerKey;
        const pieces = timerPieces(stoppedMode);
        try {
          const scheme = store.data.scheme;
          // Scramble notation is always interpreted in the fixed white-top/green-front frame.
          const state = await scrambleToState(stoppedScramble);
          if (!alive.current || ownerRef.current !== stoppedOwner) return;
          const { trace, choices } = traceWithCanonicalBreaks(state, scheme);
          const edgeExecution = m2ExecutionRepresentation(
            trace.edges,
            scheme,
            prefs.m2SecondTargetSwap && scheme.edgeMethod === "m2",
          );
          const presentedTrace = {
            ...trace,
            edges: { ...trace.edges, targets: edgeExecution.executionTargets },
          };
          traceRef.current = trace;
          const pair = (tokens: string[]) =>
            Array.from(
              { length: Math.ceil(tokens.length / 2) },
              (_, i) => memoPairReference(tokens.slice(i * 2, i * 2 + 2)),
            );
          const sampleFor = (piece: "corners" | "edges") => {
            if (!pieces.includes(piece)) return { pairs: [] };
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
                  isClassicM2Configuration(scheme)
                    ? m2SecondTargetStickerId(
                        id,
                        partial.targets.length,
                        inferM2OrientationFromBuffer(scheme.edgeBuffer)!,
                      )
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
                scramble: stoppedScramble,
                ...storedTimerTimes(r.total, r.memo),
                result: "success",
                edgeMemo: [],
                cornerMemo: [],
                cycleBreaks: choices,
                schemeSnapshot: scheme,
                reconstruction: "pending",
                engineVersion: 3,
                multiphase,
                timerMode: stoppedMode,
                sessionId: timerCategory(stoppedMode),
                createdAt: date,
              },
              ...data.solves,
            ],
          }));
          setDraft({
            solveId,
            timerMode: stoppedMode,
            time: r.total,
            memoTime: r.memo,
            scramble: stoppedScramble,
            date,
            sample: {
              corners: corners.pairs,
              edges: edges.pairs,
              hasM2Parity: edgeExecution.hasM2Parity,
              targetRepresentation:
                prefs.m2SecondTargetSwap && isClassicM2Configuration(scheme)
                  ? "m2-execution"
                  : "raw",
              ...(corners.break ? { cornerBreak: corners.break } : {}),
              ...(edges.break ? { edgeBreak: edges.break } : {}),
            },
            engine: { state, scheme },
            memoPrefs: {
              m2SecondTargetSwap: prefs.m2SecondTargetSwap,
              memoOrder: prefs.memoOrder,
            },
          });
        } finally {
          setProcessingStop(false);
        }
      })();
    },
    [multiphase, store, timerMode, ownerKey, prefs.m2SecondTargetSwap, prefs.memoOrder],
  );

  const overlayOpen =
    draft !== null || selectedId !== null || shortcutsOpen || processingStop;
  const timer = useTimer({
    multiphase,
    disabled:
      overlayOpen ||
      !active ||
      !store.ready ||
      scramblePending ||
      !scramble ||
      scrambleMode !== timerMode,
    onStop: handleStop,
  });
  const running = isRunning(timer.phase);
  const newScramble = useCallback(async () => {
    const request = ++scrambleRequestRef.current;
    setScramblePending(true);
    setScrambleError(false);
    try {
      const next =
        timerMode === "3bld"
          ? await generateBlindScramble()
          : await randomStateScramble(
              timerMode,
              crypto.getRandomValues(new Uint32Array(1))[0],
            );
      if (request === scrambleRequestRef.current) {
        setScramble(next);
        setScrambleMode(timerMode);
      }
    } catch {
      if (request === scrambleRequestRef.current) setScrambleError(true);
    } finally {
      if (request === scrambleRequestRef.current) setScramblePending(false);
    }
  }, [timerMode]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      scrambleRequestRef.current++;
    };
  }, []);

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
      const edgeExecution =
        rawTrace && d.engine
          ? m2ExecutionRepresentation(
              rawTrace.edges,
              d.engine.scheme,
              Boolean(
                d.memoPrefs?.m2SecondTargetSwap &&
                d.engine.scheme.edgeMethod === "m2",
              ),
            )
          : null;
      const trace =
        rawTrace && edgeExecution
          ? {
              ...rawTrace,
              edges: {
                ...rawTrace.edges,
                targets: edgeExecution.executionTargets,
              },
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
                  cornerMemo: timerPieces(d.timerMode).includes("corners")
                    ? rawTrace!.corners.targets.map((t) => t.token)
                    : [],
                  edgeMemo: timerPieces(d.timerMode).includes("edges")
                    ? rawTrace!.edges.targets.map((t) => t.token)
                    : [],
                  cycleBreaks: result.cycleBreaks,
                  memoSnapshot: {
                    corners: snapshot(
                      timerPieces(d.timerMode).includes("corners")
                        ? rawTrace!.corners.targets
                        : [],
                      result.memo.corners,
                      trace.corners.targets,
                    ),
                    edges: snapshot(
                      timerPieces(d.timerMode).includes("edges")
                        ? rawTrace!.edges.targets
                        : [],
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
      setDefaultWords(result.defaultWords);
      setReconOpen(false);
      setDraft(null);
      void newScramble();
    },
    [setDefaultWords, store],
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
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey || e.isComposing || e.repeat || e.defaultPrevented)
        return;
      if (e.key === "?") {
        setShortcutsOpen((o) => !o);
        return;
      }
      if (shortcutsOpen && e.key === "Escape") {
        setShortcutsOpen(false);
        return;
      }
      if (draftRef.current || selectedId || shortcutsOpen || processingStop)
        return;
      if (
        (e.key === "n" || e.key === "N") &&
        !e.repeat &&
        !running &&
        !scramblePending
      )
        void newScramble();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    active,
    newScramble,
    running,
    scramblePending,
    selectedId,
    shortcutsOpen,
    processingStop,
  ]);

  useEffect(() => {
    void newScramble();
  }, [newScramble]);

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
    scramble: scrambleMode === timerMode ? scramble : "",
    scramblePending:
      scramblePending || (scrambleMode !== timerMode && !scrambleError),
    scrambleError,
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
    shortcutsOpen,
    openShortcuts: () => setShortcutsOpen(true),
    closeShortcuts: () => setShortcutsOpen(false),
    timerMode,
    setTimerMode: (mode: TimerMode) => {
      if (
        running ||
        overlayOpen ||
        timer.phase === "armed" ||
        timer.phase === "ready" ||
        mode === timerMode
      )
        return;
      timer.reset();
      setTimerMode(mode);
    },
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
        firstToken: rawFirst.token,
        ...(rawSecond ? { secondToken: rawSecond.token } : {}),
        ...(first.stickerId !== rawFirst.stickerId
          ? {
              firstExecutionStickerId: first.stickerId,
              firstExecutionToken: first.token,
            }
          : {}),
        ...(rawSecond && second && second.stickerId !== rawSecond.stickerId
          ? {
              secondExecutionStickerId: second.stickerId,
              secondExecutionToken: second.token,
            }
          : {}),
        mnemonic: words[index]?.word ?? "",
        firstCycleBreak: rawFirst.cycleBreak,
        ...(rawSecond ? { secondCycleBreak: rawSecond.cycleBreak } : {}),
      };
    },
  );
}
