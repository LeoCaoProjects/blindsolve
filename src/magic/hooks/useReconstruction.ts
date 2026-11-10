import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { inferM2OrientationFromBuffer } from "../../domain/bld/orientation";
import { pairKey, timerWords, timerDefaultWords } from "../utils/pairs";
import {
  memoPairReference,
  memoPairTokens,
} from "../../domain/letterPairs/identity";
import { timerPieces } from "../utils/timerModes";

export type ReconStep =
  | { kind: "break"; piece: Piece; options: string[]; answer: string }
  | { kind: "word"; piece: Piece; pair: string; first: string; second: string }
  | { kind: "review" };
export type Decision = "keep" | "replace";
export interface ReconResult {
  penalty: Penalty;
  memo: SolveMemo;
  defaultWords: Record<string, string>;
  cycleBreaks: { corners: string[]; edges: string[] };
}

interface BreakCheckpoint {
  choices: { corners: string[]; edges: string[] };
  breaks: Partial<Record<Piece, string>>;
  optionFocus: number;
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
  const [editedPiece, setEditedPiece] = useState<Record<string, Piece>>({});
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [optionFocus, setOptionFocus] = useState(0);
  const [breakHistory, setBreakHistory] = useState<BreakCheckpoint[]>([]);
  const committedBreak = useRef<string | null>(null);
  const restoringBreak = useRef(false);
  const choiceKey = JSON.stringify(choices);

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
    draft.timerMode && draft.timerMode !== "3bld"
      ? timerPieces(draft.timerMode)
      : draft.memoPrefs?.memoOrder === "edges-first"
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
            inferM2OrientationFromBuffer(draft.engine.scheme.edgeBuffer)!,
          )
        : id,
    [draft.engine?.scheme, draft.memoPrefs?.m2SecondTargetSwap, pending],
  );

  const sample = useMemo<MemoSample>(() => {
    if (!traced || !presented || !draft.engine) return draft.sample;
    const make = (piece: Piece, section: TraceSection) => {
      if (!timerPieces(draft.timerMode).includes(piece)) return { pairs: [] };
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
      if (tokens.length % 2)
        withSlot[withSlot.length - 1] = memoPairReference([
          tokens[tokens.length - 1],
          "·",
        ]);
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
      !timerPieces(draft.timerMode).every(
        (piece) => traced[piece].status === "complete",
      )
    )
      return sample;
    return {
      corners: timerPieces(draft.timerMode).includes("corners")
        ? pairTokens(presented.corners.targets.map((t) => t.token))
        : [],
      edges: timerPieces(draft.timerMode).includes("edges")
        ? pairTokens(presented.edges.targets.map((t) => t.token))
        : [],
      hasM2Parity: draft.sample.hasM2Parity,
      targetRepresentation: draft.sample.targetRepresentation,
    };
  }, [draft.timerMode, presented, sample, traced]);

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
            pair = memoPairReference([first, second]);
          const key = pair;
          if (
            timerWords(db, pair, piece).length ||
            seen.has(key) ||
            pair.includes("·")
          )
            continue;
          seen.add(key);
          result.push({ kind: "word", piece, pair, first, second });
        }
      });
    result.push({ kind: "review" });
    return result;
  }, [db, draft.engine, pending, pieceOrder, presented, presentedBreakId]);
  const step = steps[Math.min(index, steps.length - 1)];

  useEffect(() => {
    if (restoringBreak.current) {
      restoringBreak.current = false;
      return;
    }
    setOptionFocus(0);
  }, [index, choiceKey, pending?.piece, pending?.section.targets.length]);
  const next = useCallback(
    () => setIndex((value) => Math.min(value + 1, steps.length - 1)),
    [steps.length],
  );
  const back = useCallback(() => {
    if (index > 0) {
      setIndex(index - 1);
      return;
    }
    const previous = breakHistory.at(-1);
    if (!previous) return;
    restoringBreak.current = true;
    committedBreak.current = null;
    setBreakHistory(breakHistory.slice(0, -1));
    setChoices(previous.choices);
    setBreaks(previous.breaks);
    setOptionFocus(previous.optionFocus);
  }, [index, breakHistory]);

  const focusBreak = useCallback(
    (token: string) => {
      if (step.kind !== "break") return;
      const option = step.options.indexOf(token);
      if (option >= 0) setOptionFocus(option);
    },
    [step],
  );

  const pickBreak = useCallback(
    (token: string) => {
      if (!pending || !draft.engine) return;
      const id = pending.section.validCycleBreaks.find(
        (candidate) =>
          draft.engine!.scheme.stickers[presentedBreakId(candidate)].label ===
          token,
      );
      if (!id || committedBreak.current === choiceKey) return;
      committedBreak.current = choiceKey;
      setBreakHistory((history) => [
        ...history,
        {
          choices,
          breaks,
          optionFocus: pending.section.validCycleBreaks.indexOf(id),
        },
      ]);
      setBreaks((current) => ({ ...current, [pending.piece]: token }));
      setChoices((current) => ({
        ...current,
        [pending.piece]: [...current[pending.piece], id],
      }));
      setIndex(0);
    },
    [draft.engine, pending, presentedBreakId, choiceKey, choices, breaks],
  );

  const refKey = (pair: string, piece: Piece) => `${piece}:${pair}`;
  const setWord = useCallback((pair: string, piece: Piece, word: string) => {
    setWords((current) => ({ ...current, [refKey(pair, piece)]: word }));
    setEditedPiece((current) => ({ ...current, [pair]: piece }));
  }, []);
  const decide = useCallback(
    (pair: string, piece: Piece, decision: Decision) =>
      setDecisions((current) => ({
        ...current,
        [refKey(pair, piece)]: decision,
      })),
    [],
  );
  const wordFor = useCallback(
    (pair: string, piece: Piece) =>
      words[refKey(pair, piece)] ??
      timerWords(snapshot, pair, piece)[0] ??
      (editedPiece[pair] ? words[refKey(pair, editedPiece[pair])] : "") ??
      "",
    [snapshot, words, editedPiece],
  );
  const isNew = useCallback(
    (pair: string, piece: Piece) =>
      !timerDefaultWords(snapshot, memoPairTokens(pair)).length &&
      !!words[refKey(pair, piece)]?.trim(),
    [snapshot, words],
  );
  const storedFor = useCallback(
    (pair: string, _piece: Piece) =>
      timerDefaultWords(snapshot, memoPairTokens(pair))[0] ?? null,
    [snapshot],
  );
  const allPairs = useMemo(
    () =>
      Array.from(
        new Map(
          [
            ...completedSample.corners.map((pair, index) => ({
              piece: "corners" as const,
              pair,
              tokens:
                presented?.corners.targets
                  .slice(index * 2, index * 2 + 2)
                  .map((t) => t.token) ?? memoPairTokens(pair),
            })),
            ...completedSample.edges.map((pair, index) => ({
              piece: "edges" as const,
              pair,
              tokens:
                presented?.edges.targets
                  .slice(index * 2, index * 2 + 2)
                  .map((t) => t.token) ?? memoPairTokens(pair),
            })),
          ]
            .filter(({ pair }) => !pair.includes("·"))
            .map((ref) => [refKey(ref.pair, ref.piece), ref]),
        ).values(),
      ),
    [completedSample, presented],
  );
  const changedPairs = useMemo(
    () =>
      allPairs.filter(({ pair, piece }) => {
        const used = words[refKey(pair, piece)]?.trim(),
          stored = timerDefaultWords(snapshot, memoPairTokens(pair));
        return (
          editedPiece[pair] === piece &&
          !!used &&
          stored.length > 0 &&
          !stored.some(
            (word) => word.trim().toLowerCase() === used.toLowerCase(),
          )
        );
      }),
    [allPairs, snapshot, words, editedPiece],
  );
  const newPairs = useMemo(
    () =>
      allPairs.filter(
        ({ pair, piece }) => editedPiece[pair] === piece && isNew(pair, piece),
      ),
    [allPairs, isNew, editedPiece],
  );

  // The saved-solve inspector places cycle separators at the start of their pair.
  const reviewBreakAt = (piece: Piece) => {
    const at =
      presented?.[piece].targets.findIndex((target) => target.cycleBreak) ??
      (piece === "corners"
        ? completedSample.cornerBreak?.at
        : completedSample.edgeBreak?.at) ??
      -1;
    return at >= 0 ? Math.floor(at / 2) * 2 : undefined;
  };
  const reviewMemo: SolveMemo = {
    corners: completedSample.corners.map((pair) => ({
      pair,
      word: wordFor(pair, "corners"),
    })),
    edges: completedSample.edges.map((pair) => ({
      pair,
      word: wordFor(pair, "edges"),
    })),
    cornerBreakAt: reviewBreakAt("corners"),
    edgeBreakAt: reviewBreakAt("edges"),
    hasM2Parity: completedSample.hasM2Parity,
    targetRepresentation: completedSample.targetRepresentation,
  };

  const finish = useCallback(() => {
    const toPairs = (pairs: string[], piece: Piece) =>
      pairs.map((pair) => ({ pair, word: wordFor(pair, piece) }));
    const updates: Record<string, string> = {};
    allPairs.forEach(({ pair, piece, tokens }) => {
      const key = refKey(pair, piece),
        used = words[key]?.trim();
      if (!used || editedPiece[pair] !== piece) return;
      const existing = timerDefaultWords(snapshot, tokens);
      if (tokens.length !== 2) return;
      const defaultKey = pairKey(tokens[0], tokens[1]);
      if (!existing.length) updates[defaultKey] = used;
      else if (
        !existing.some(
          (word) => word.trim().toLowerCase() === used.toLowerCase(),
        )
      ) {
        const decision = decisions[key] ?? "replace";
        if (decision === "replace") updates[defaultKey] = used;
      }
    });
    onSave({
      penalty,
      memo: {
        corners: toPairs(completedSample.corners, "corners"),
        edges: toPairs(completedSample.edges, "edges"),
        hasM2Parity: completedSample.hasM2Parity,
      },
      defaultWords: updates,
      cycleBreaks: choices,
    });
  }, [
    allPairs,
    draft.engine,
    choices,
    completedSample,
    decisions,
    editedPiece,
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
      if (event.key === "Enter" && event.target instanceof HTMLButtonElement)
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
    reviewMemo,
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
    focusBreak,
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
    canBack: index > 0 || breakHistory.length > 0,
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
    result.push(memoPairReference(tokens.slice(index, index + 2)));
  return result;
}
