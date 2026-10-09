import { useCallback, useEffect, useMemo, useState } from "react";
import { traceMemo } from "../../domain/bld/trace";
import type { TraceSection } from "../../domain/bld/types";
import {
  LetterPairDb,
  MemoSample,
  Penalty,
  Piece,
  SolveDraft,
  SolveMemo,
} from "../types/solve";
import { isTypingTarget } from "../utils/keyboard";
import {
  isClassicM2Configuration,
  m2ExecutionRepresentation,
  m2SecondTargetStickerId,
} from "../../domain/bld/memoConventions";

export type ReconStep =
  | { kind: "break"; piece: Piece; options: string[]; answer: string }
  | { kind: "word"; piece: Piece; pair: string; first: string; second: string }
  | { kind: "review" };
export type Decision = "keep" | "replace" | "alternate";
export interface ReconResult {
  penalty: Penalty;
  memo: SolveMemo;
  dbUpdates: LetterPairDb;
  cycleBreaks: { corners: string[]; edges: string[] };
}

interface Options {
  draft: SolveDraft;
  db: LetterPairDb;
  onSave: (result: ReconResult) => void;
}

/**
 * Reconstruction is driven by the production trace engine. It pauses at every
 * buffer return, applies the physical sticker the user chose, then retraces.
 */
export function useReconstruction({ draft, db, onSave }: Options) {
  const [snapshot] = useState<LetterPairDb>(db);
  const [choices, setChoices] = useState({
    corners: [] as string[],
    edges: [] as string[],
  });
  const [index, setIndex] = useState(0);
  const [penalty, setPenalty] = useState<Penalty>("ok");
  const [breaks, setBreaks] = useState<Partial<Record<Piece, string>>>({});
  const [words, setWords] = useState<Record<string, string>>({});
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [optionFocus, setOptionFocus] = useState(0);

  const traced = useMemo(
    () =>
      draft.engine
        ? traceMemo(draft.engine.state, draft.engine.scheme, choices)
        : null,
    [draft.engine, choices],
  );
  const presented = useMemo(() => {
    if (!traced || !draft.engine) return traced;
    const edgeExecution = m2ExecutionRepresentation(
      traced.edges,
      draft.engine.scheme,
      Boolean(
        draft.memoPrefs?.m2SecondTargetSwap &&
        draft.engine.scheme.edgeMethod === "m2",
      ),
    );
    return {
      ...traced,
      edges: { ...traced.edges, targets: edgeExecution.executionTargets },
    };
  }, [draft.engine, draft.memoPrefs?.m2SecondTargetSwap, traced]);
  const pieceOrder: Piece[] =
    draft.memoPrefs?.memoOrder === "edges-first"
      ? ["edges", "corners"]
      : ["corners", "edges"];
  const pending = pieceOrder
    .map((piece) => ({ piece, section: traced?.[piece] }))
    .find((item) => item.section?.status === "cycle-break") as
    { piece: Piece; section: TraceSection } | undefined;
  const presentedBreakId = useCallback(
    (id: string) =>
      pending?.piece === "edges" &&
      draft.memoPrefs?.m2SecondTargetSwap &&
      draft.engine?.scheme &&
      isClassicM2Configuration(draft.engine.scheme)
        ? m2SecondTargetStickerId(
            id,
            pending.section.targets.length,
            draft.engine.scheme.orientation,
          )
        : id,
    [
      draft.engine?.scheme,
      draft.memoPrefs?.m2SecondTargetSwap,
      pending,
    ],
  );

  const sample = useMemo<MemoSample>(() => {
    if (!traced || !presented || !draft.engine) return draft.sample;
    const make = (piece: Piece, section: TraceSection) => {
      const tokens = section.targets.map((target) => target.token);
      const pairs = pairTokens(tokens);
      if (section.status !== "cycle-break") return { pairs };
      const options = section.validCycleBreaks.map(
        (id) =>
          draft.engine!.scheme.stickers[
            piece === "edges" ? presentedBreakId(id) : id
          ].label,
      );
      const at = tokens.length;
      const withSlot = [...pairs];
      if (tokens.length % 2) withSlot[withSlot.length - 1] += "·";
      else withSlot.push("··");
      return {
        pairs: withSlot,
        break: { at, options, answer: options[0] ?? "" },
      };
    };
    const corners = make("corners", presented.corners),
      edges = make("edges", presented.edges);
    return {
      corners: corners.pairs,
      edges: edges.pairs,
      hasM2Parity: draft.sample.hasM2Parity,
      targetRepresentation: draft.sample.targetRepresentation,
      ...(corners.break ? { cornerBreak: corners.break } : {}),
      ...(edges.break ? { edgeBreak: edges.break } : {}),
    };
  }, [draft.engine, draft.sample, presented, presentedBreakId, traced]);

  const completedSample = useMemo<MemoSample>(() => {
    if (
      !presented ||
      !traced ||
      traced.corners.status !== "complete" ||
      traced.edges.status !== "complete"
    )
      return sample;
    return {
      corners: pairTokens(presented.corners.targets.map((t) => t.token)),
      edges: pairTokens(presented.edges.targets.map((t) => t.token)),
      hasM2Parity: draft.sample.hasM2Parity,
      targetRepresentation: draft.sample.targetRepresentation,
    };
  }, [presented, sample, traced]);

  const steps = useMemo<ReconStep[]>(() => {
    if (pending) {
      const options = pending.section.validCycleBreaks.map(
        (id) => draft.engine!.scheme.stickers[presentedBreakId(id)].label,
      );
      return [
        {
          kind: "break",
          piece: pending.piece,
          options,
          answer: options[0] ?? "",
        },
      ];
    }
    const result: ReconStep[] = [];
    const seen = new Set<string>();
    pieceOrder
      .map(
        (piece) =>
          [
            piece,
            presented?.[piece].targets.map((target) => target.token) ?? [],
          ] as [Piece, string[]],
      )
      .forEach(([piece, tokens]) => {
        for (let index = 0; index + 1 < tokens.length; index += 2) {
          const first = tokens[index],
            second = tokens[index + 1],
            pair = first + second;
          if (db[pair] || seen.has(pair) || pair.includes("·")) continue;
          seen.add(pair);
          result.push({ kind: "word", piece, pair, first, second });
        }
      });
    result.push({ kind: "review" });
    return result;
  }, [db, draft.engine, pending, pieceOrder, presented, presentedBreakId]);
  const step = steps[Math.min(index, steps.length - 1)];

  useEffect(
    () => setOptionFocus(0),
    [index, pending?.piece, pending?.section.targets.length],
  );
  const next = useCallback(
    () => setIndex((value) => Math.min(value + 1, steps.length - 1)),
    [steps.length],
  );
  const back = useCallback(
    () => setIndex((value) => Math.max(0, value - 1)),
    [],
  );

  const pickBreak = useCallback(
    (token: string) => {
      if (!pending || !draft.engine) return;
      const id = pending.section.validCycleBreaks.find(
        (candidate) =>
          draft.engine!.scheme.stickers[presentedBreakId(candidate)].label ===
          token,
      );
      if (!id) return;
      setBreaks((current) => ({ ...current, [pending.piece]: token }));
      setChoices((current) => ({
        ...current,
        [pending.piece]: [...current[pending.piece], id],
      }));
      setIndex(0);
    },
    [draft.engine, pending, presentedBreakId],
  );

  const setWord = useCallback(
    (pair: string, word: string) =>
      setWords((current) => ({ ...current, [pair]: word })),
    [],
  );
  const decide = useCallback(
    (pair: string, decision: Decision) =>
      setDecisions((current) => ({ ...current, [pair]: decision })),
    [],
  );
  const wordFor = useCallback(
    (pair: string) => words[pair] ?? snapshot[pair]?.[0] ?? "",
    [snapshot, words],
  );
  const isNew = useCallback(
    (pair: string) => !snapshot[pair] && !!words[pair]?.trim(),
    [snapshot, words],
  );
  const storedFor = useCallback(
    (pair: string) => snapshot[pair]?.[0] ?? null,
    [snapshot],
  );
  const allPairs = useMemo(
    () =>
      Array.from(
        new Set([...completedSample.corners, ...completedSample.edges]),
      ).filter((p) => !p.includes("·")),
    [completedSample],
  );
  const changedPairs = useMemo(
    () =>
      allPairs.filter((pair) => {
        const used = words[pair]?.trim(),
          stored = snapshot[pair];
        return (
          !!used &&
          !!stored &&
          !stored.some(
            (word) => word.trim().toLowerCase() === used.toLowerCase(),
          )
        );
      }),
    [allPairs, snapshot, words],
  );
  const newPairs = useMemo(() => allPairs.filter(isNew), [allPairs, isNew]);

  const finish = useCallback(() => {
    const toPairs = (pairs: string[]) =>
      pairs.map((pair) => ({ pair, word: wordFor(pair) }));
    const updates: LetterPairDb = {};
    allPairs.forEach((pair) => {
      const used = words[pair]?.trim();
      if (!used) return;
      const existing = snapshot[pair];
      if (!existing) updates[pair] = [used];
      else if (
        !existing.some(
          (word) => word.trim().toLowerCase() === used.toLowerCase(),
        )
      ) {
        const decision = decisions[pair] ?? "keep";
        if (decision === "replace")
          updates[pair] = [used, ...existing.slice(1)];
        if (decision === "alternate") updates[pair] = [...existing, used];
      }
    });
    onSave({
      penalty,
      memo: {
        corners: toPairs(completedSample.corners),
        edges: toPairs(completedSample.edges),
        hasM2Parity: completedSample.hasM2Parity,
      },
      dbUpdates: updates,
      cycleBreaks: choices,
    });
  }, [
    allPairs,
    choices,
    completedSample,
    decisions,
    onSave,
    penalty,
    snapshot,
    wordFor,
    words,
  ]);

  const primary = useCallback(() => {
    if (step.kind === "break") pickBreak(step.options[optionFocus]);
    else if (step.kind === "word") next();
    else finish();
  }, [finish, next, optionFocus, pickBreak, step]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.key === "Escape") {
        event.preventDefault();
        finish();
        return;
      }
      if (isTypingTarget(event.target) || event.metaKey || event.ctrlKey)
        return;
      if (event.key === "1") return setPenalty("ok");
      if (event.key === "2") return setPenalty("+2");
      if (event.key === "3") return setPenalty("dnf");
      if (step.kind === "break") {
        const count = step.options.length;
        if (event.key === "ArrowRight" || event.key === "ArrowDown") {
          event.preventDefault();
          setOptionFocus((value) => (value + 1) % count);
        } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
          event.preventDefault();
          setOptionFocus((value) => (value - 1 + count) % count);
        } else if (event.key === "Enter") {
          event.preventDefault();
          pickBreak(step.options[optionFocus]);
        } else if (step.options.includes(event.key.toUpperCase()))
          pickBreak(event.key.toUpperCase());
      } else if (event.key === "Enter" && step.kind === "review") {
        event.preventDefault();
        finish();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [finish, optionFocus, pickBreak, step]);

  return {
    draft,
    sample: pending ? sample : completedSample,
    steps,
    step,
    index,
    penalty,
    setPenalty,
    breaks,
    breakTargetIds: pending?.section.validCycleBreaks ?? [],
    optionFocus,
    pickBreak,
    words,
    setWord,
    wordFor,
    storedFor,
    isNew,
    newPairs,
    changedPairs,
    decisions,
    decide,
    next,
    back,
    finish,
    primary,
    isResolved: () => !pending,
    primaryLabel: step.kind === "review" ? "Save solve" : "Continue",
  };
}

export type Reconstruction = ReturnType<typeof useReconstruction>;

function pairTokens(tokens: string[]) {
  const result: string[] = [];
  for (let index = 0; index < tokens.length; index += 2)
    result.push(tokens.slice(index, index + 2).join(""));
  return result;
}
