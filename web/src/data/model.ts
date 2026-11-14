import { z } from "zod";
import { createSpeffzScheme } from "../domain/bld/speffz";
import type { LetteringScheme } from "../domain/bld/types";
import type { LetterPair } from "../domain/letterPairs";
import { logicalPairFields } from "./logicalPairSchema";
import { normalizeLabel } from "../domain/letterPairs/identity";
import type { LogicalPairState } from "../domain/letterPairs/logical";

export interface SolveRecord {
  id: string;
  scramble: string;
  memoMs: number;
  executionMs: number;
  totalMs: number;
  result: "success" | "+2" | "dnf";
  edgeMemo: string[];
  cornerMemo: string[];
  cycleBreaks: { edges: string[]; corners: string[] };
  createdAt: string;
  updatedAt?: string;
  deleted?: boolean;
  schemeSnapshot?: LetteringScheme;
  reconstruction?: "pending" | "complete";
  engineVersion?: number;
  multiphase?: boolean;
  /** Legacy grouping metadata is retained verbatim; new solves use fixed mode categories. */
  sessionId?: string;
  timerMode?: "3bld" | "edges" | "corners";
  memoSnapshot?: {
    corners: MemoPairSnapshot[];
    edges: MemoPairSnapshot[];
  };
}
export interface MemoPairSnapshot {
  firstStickerId: string;
  secondStickerId?: string;
  firstToken: string;
  secondToken?: string;
  firstExecutionStickerId?: string;
  secondExecutionStickerId?: string;
  firstExecutionToken?: string;
  secondExecutionToken?: string;
  mnemonic: string;
  firstCycleBreak?: boolean;
  secondCycleBreak?: boolean;
}
export interface PracticeAttempt {
  id: string;
  kind: "memo" | "flashcard";
  correct: boolean;
  /** Only objective recall/trace/flashcard attempts have a meaningful accuracy. */
  accuracy?: number;
  createdAt: string;
  /** `full` is legacy-only and remains readable for backward compatibility. */
  trainingMode?: "recall" | "exec" | "trace" | "guided" | "recognition" | "full";
  pairKey?: string;
  pairPiece?: "edges" | "corners";
  durationMs?: number;
  targets?: number;
  pairs?: number;
  scope?: "both" | "corners" | "edges";
  scramble?: string;
  memoMs?: number;
  executionMs?: number;
  rawTargets?: { corners: string[]; edges: string[] };
  executionTargets?: { corners: string[]; edges: string[] };
  tokenSnapshot?: { corners: string[]; edges: string[] };
  memoOrder?: "corners-first" | "edges-first";
}
export interface AppData extends LogicalPairState {
  schemeHistory?: Array<{ scheme: LetteringScheme; updatedAt: string }>;
  scheme: LetteringScheme;
  pairs: Record<string, LetterPair>;
  solves: SolveRecord[];
  attempts: PracticeAttempt[];
  timerSessions?: Array<{ id: string; name: string; createdAt: string }>;
  activeTimerSessionId?: string;
  activeTimerMode?: "3bld" | "edges" | "corners";
  onboarded: boolean;
  schemeUpdatedAt: string;
  multiphaseTiming: boolean;
  showLiveTimer: boolean;
  m2SecondTargetSwap: boolean;
  memoOrder: "corners-first" | "edges-first";
  pairSharing?: "shared" | "separate";
  /** @deprecated Retained only so old settings records round-trip unchanged. */
  flippedEdges?: "cycle" | "separate";
  /** @deprecated Retained only so old settings records round-trip unchanged. */
  twistedCorners?: "cycle" | "separate";
  defaultCubeView?: {
    top: "white" | "yellow" | "green" | "blue" | "red" | "orange";
    front: "white" | "yellow" | "green" | "blue" | "red" | "orange";
  };
  preferencesUpdatedAt: string;
}
export const emptyData = (): AppData => ({
  scheme: createSpeffzScheme(),
  pairs: {},
  solves: [],
  attempts: [],
  timerSessions: [
    { id: "today", name: "Today", createdAt: new Date(0).toISOString() },
  ],
  activeTimerSessionId: "today",
  onboarded: false,
  schemeUpdatedAt: new Date(0).toISOString(),
  multiphaseTiming: true,
  showLiveTimer: true,
  m2SecondTargetSwap: false,
  memoOrder: "corners-first",
  pairSharing: "shared",
  flippedEdges: "cycle",
  twistedCorners: "cycle",
  defaultCubeView: { top: "white", front: "green" },
  preferencesUpdatedAt: new Date(0).toISOString(),
});

/** Whether a workspace contains user-created state rather than untouched defaults. */
export function hasMeaningfulData(data: AppData): boolean {
  const defaults = emptyData();
  return (
    data.onboarded ||
    Object.keys(data.pairs).length > 0 ||
    Object.keys(data.logicalPairs ?? {}).length > 0 ||
    data.solves.length > 0 ||
    data.attempts.length > 0 ||
    JSON.stringify(data.scheme) !== JSON.stringify(defaults.scheme) ||
    data.multiphaseTiming !== defaults.multiphaseTiming ||
    data.showLiveTimer !== defaults.showLiveTimer ||
    data.m2SecondTargetSwap !== defaults.m2SecondTargetSwap ||
    data.memoOrder !== defaults.memoOrder ||
    (data.pairSharing ?? "shared") !== defaults.pairSharing ||
    (data.flippedEdges ?? "cycle") !== defaults.flippedEdges ||
    (data.twistedCorners ?? "cycle") !== defaults.twistedCorners ||
    JSON.stringify(data.defaultCubeView ?? defaults.defaultCubeView) !==
      JSON.stringify(defaults.defaultCubeView) ||
    JSON.stringify(data.timerSessions ?? defaults.timerSessions) !==
      JSON.stringify(defaults.timerSessions) ||
    (data.activeTimerSessionId ?? "today") !== defaults.activeTimerSessionId ||
    (data.activeTimerMode ?? "3bld") !== "3bld"
  );
}
const text = z.string().max(1000),
  tokens = z.array(z.string().max(12)).max(200);
const iso = z
  .string()
  .refine((v) => Number.isFinite(Date.parse(v)), "Invalid date");
export const pairSchema = z.object({
  id: z.string().uuid(),
  firstStickerId: text,
  secondStickerId: text,
  firstToken: text.default(""),
  secondToken: text.default(""),
  primaryMnemonic: text,
  updatedAt: iso,
  vocabulary: z
    .object({
      shared: z
        .array(text)
        .max(100)
        .transform((words) => words.slice(0, 1)),
      sharedUpdatedAt: iso,
      overrideUpdatedAt: iso,
      override: z
        .array(text)
        .max(100)
        .transform((words) => words.slice(0, 1))
        .optional(),
    })
    .optional(),
});
const schemeSchema = z.object({
  id: text,
  name: text,
  orientation: z.object({
    up: z.enum(["U", "D", "L", "R", "F", "B"]),
    front: z.enum(["U", "D", "L", "R", "F", "B"]),
  }),
  edgeBuffer: text,
  cornerBuffer: text,
  edgeMethod: z.enum(["raw", "m2", "old-pochmann", "3style"]),
  cornerMethod: z.enum(["raw", "old-pochmann", "3style"]),
  stickers: z.record(
    z.string(),
    z.object({
      id: text,
      pieceType: z.enum(["edge", "corner"]),
      pieceIndex: z.number().int(),
      orientationIndex: z.number().int(),
      face: text,
      label: z
        .string()
        .trim()
        .min(1)
        .max(12)
        .regex(/^[^\s,·|/]+$/, "Tokens cannot contain spaces or separators"),
    }),
  ),
});
const solveSchema = z
  .object({
    id: z.string().uuid(),
    scramble: text,
    memoMs: z.number().int().nonnegative(),
    executionMs: z.number().int().nonnegative(),
    totalMs: z.number().int().nonnegative(),
    result: z.enum(["success", "+2", "dnf"]),
    edgeMemo: tokens,
    cornerMemo: tokens,
    cycleBreaks: z.object({ edges: z.array(text), corners: z.array(text) }),
    createdAt: iso,
    updatedAt: iso.optional(),
    deleted: z.boolean().optional(),
    schemeSnapshot: schemeSchema.optional(),
    reconstruction: z.enum(["pending", "complete"]).optional(),
    engineVersion: z.number().optional(),
    multiphase: z.boolean().optional(),
    sessionId: text.optional(),
    timerMode: z.enum(["3bld", "edges", "corners"]).optional(),
    memoSnapshot: z
      .object({
        corners: z.array(
          z.object({
            firstStickerId: text,
            secondStickerId: text.optional(),
            firstToken: text,
            secondToken: text.optional(),
            firstExecutionStickerId: text.optional(),
            secondExecutionStickerId: text.optional(),
            firstExecutionToken: text.optional(),
            secondExecutionToken: text.optional(),
            mnemonic: text,
            firstCycleBreak: z.boolean().optional(),
            secondCycleBreak: z.boolean().optional(),
          }),
        ),
        edges: z.array(
          z.object({
            firstStickerId: text,
            secondStickerId: text.optional(),
            firstToken: text,
            secondToken: text.optional(),
            firstExecutionStickerId: text.optional(),
            secondExecutionStickerId: text.optional(),
            firstExecutionToken: text.optional(),
            secondExecutionToken: text.optional(),
            mnemonic: text,
            firstCycleBreak: z.boolean().optional(),
            secondCycleBreak: z.boolean().optional(),
          }),
        ),
      })
      .optional(),
  })
  .refine(
    (s) => s.totalMs === s.memoMs + s.executionMs,
    "Invalid timing split",
  );
// Earlier manual saves could archive an unfinished lettering edit. It remains
// useful recovery evidence, but must not be validated as the active scheme.
const archivedSchemeSchema = schemeSchema.extend({
  stickers: z.record(
    z.string(),
    schemeSchema.shape.stickers.valueType.extend({
      label: z.string().max(12),
    }),
  ),
});
const dataSchema = z.object({
  ...logicalPairFields,
  schemeHistory: z
    .array(z.object({ scheme: archivedSchemeSchema, updatedAt: iso }))
    .max(100)
    .optional(),
  scheme: schemeSchema,
  pairs: z
    .record(z.string(), pairSchema)
    .refine(
      (pairs) => Object.keys(pairs).length <= 100000,
      "Backup contains too many letter pairs",
    ),
  solves: z.array(solveSchema).max(100000),
  attempts: z
    .array(
      z.object({
        id: z.string().uuid(),
        kind: z.enum(["memo", "flashcard"]),
        correct: z.boolean(),
        // Older target-scoring code subtracted extra/wrong tokens from the
        // expected count and could persist a negative percentage. Clamp only
        // persisted finite negative values at this compatibility boundary;
        // current domain objects contain either 0..1 or no accuracy at all.
        accuracy: z.preprocess(
          (value) =>
            typeof value === "number" && Number.isFinite(value) && value < 0
              ? 0
              : value,
          z.number().min(0).max(1).optional(),
        ),
        createdAt: iso,
        trainingMode: z
          .enum(["recall", "exec", "trace", "guided", "recognition", "full"])
          .optional(),
        pairKey: text.optional(),
        pairPiece: z.enum(["edges", "corners"]).optional(),
        durationMs: z.number().int().nonnegative().optional(),
        targets: z.number().int().nonnegative().optional(),
        pairs: z.number().int().nonnegative().optional(),
        scope: z.enum(["both", "corners", "edges"]).optional(),
        scramble: text.optional(),
        memoMs: z.number().int().nonnegative().optional(),
        executionMs: z.number().int().nonnegative().optional(),
        rawTargets: z
          .object({
            corners: z.array(text).max(200),
            edges: z.array(text).max(200),
          })
          .optional(),
        executionTargets: z
          .object({
            corners: z.array(text).max(200),
            edges: z.array(text).max(200),
          })
          .optional(),
        tokenSnapshot: z.object({ corners: tokens, edges: tokens }).optional(),
        memoOrder: z.enum(["corners-first", "edges-first"]).optional(),
      }),
    )
    .max(100000)
    .default([]),
  timerSessions: z
    .array(z.object({ id: text, name: text, createdAt: iso }))
    .max(100)
    .default([
      { id: "today", name: "Today", createdAt: new Date(0).toISOString() },
    ]),
  activeTimerSessionId: text.default("today"),
  activeTimerMode: z.enum(["3bld", "edges", "corners"]).optional(),
  onboarded: z.boolean().default(true),
  schemeUpdatedAt: iso.default(new Date(0).toISOString()),
  multiphaseTiming: z.boolean().default(true),
  showLiveTimer: z.boolean().default(true),
  m2SecondTargetSwap: z.boolean().default(false),
  memoOrder: z.enum(["corners-first", "edges-first"]).default("corners-first"),
  pairSharing: z.enum(["shared", "separate"]).default("shared"),
  flippedEdges: z.enum(["cycle", "separate"]).default("cycle"),
  twistedCorners: z.enum(["cycle", "separate"]).default("cycle"),
  defaultCubeView: z
    .object({
      top: z.enum(["white", "yellow", "green", "blue", "red", "orange"]),
      front: z.enum(["white", "yellow", "green", "blue", "red", "orange"]),
    })
    .default({ top: "white", front: "green" }),
  preferencesUpdatedAt: iso.default(new Date(0).toISOString()),
});

export function validateScheme(scheme: LetteringScheme): string | null {
  const parsed = schemeSchema.safeParse(scheme);
  if (!parsed.success) return parsed.error.issues[0].message;
  const canonical = createSpeffzScheme();
  if (
    Object.keys(scheme.stickers).length !== 48 ||
    Object.keys(canonical.stickers).some((id) => !scheme.stickers[id])
  )
    return "A scheme needs all 48 physical stickers.";
  for (const type of ["edge", "corner"] as const) {
    const stickers = Object.values(scheme.stickers).filter(
      (s) => s.pieceType === type,
    );
    if (new Set(stickers.map((s) => s.label)).size !== 24)
      return `Each ${type} sticker needs a unique token.`;
  }
  if (
    scheme.stickers[scheme.edgeBuffer]?.pieceType !== "edge" ||
    scheme.stickers[scheme.cornerBuffer]?.pieceType !== "corner"
  )
    return "Choose a valid edge and corner buffer.";
  const opposite: Record<string, string> = {
    U: "D",
    D: "U",
    F: "B",
    B: "F",
    R: "L",
    L: "R",
  };
  if (
    scheme.orientation.up === scheme.orientation.front ||
    opposite[scheme.orientation.up] === scheme.orientation.front
  )
    return "Top and front must be adjacent faces.";
  return null;
}

/** Preserve V1 physical IDs and tokens; correct metadata, never silently relabel a personal scheme. */
export function parseData(value: unknown): AppData {
  const parsed = dataSchema.parse(value),
    defaults = createSpeffzScheme();
  if (
    Object.keys(parsed.scheme.stickers).length !== 48 ||
    Object.keys(defaults.stickers).some((id) => !parsed.scheme.stickers[id])
  )
    throw new Error("Backup must include all 48 physical stickers.");
  const stickers = Object.fromEntries(
    Object.entries(defaults.stickers).map(([id, s]) => [
      id,
      {
        ...s,
        label: normalizeLabel(parsed.scheme.stickers[id]?.label ?? s.label),
      },
    ]),
  );
  const scheme = { ...parsed.scheme, stickers };
  const error = validateScheme(scheme);
  if (error) throw new Error(error);
  const pairs: Record<string, LetterPair> = {};
  for (const [key, pair] of Object.entries(parsed.pairs)) {
    // Preserve old transport keys and ambiguous provenance verbatim. Current
    // lettering must never re-key or reinterpret a legacy mnemonic record.
    pairs[key] = pair;
  }
  const repairMetadata = (old: LetteringScheme, archived = false) => {
    if (
      Object.keys(old.stickers).length !== 48 ||
      Object.keys(defaults.stickers).some((id) => !old.stickers[id])
    )
      throw new Error("A saved scheme must include all 48 physical stickers.");
    const repaired = {
      ...old,
      stickers: Object.fromEntries(
        Object.entries(defaults.stickers).map(([id, s]) => [
          id,
          { ...s, label: old.stickers[id]?.label ?? s.label },
        ]),
      ),
    };
    const error = validateScheme(
      archived
        ? {
            ...repaired,
            // Validate structure, buffers and orientation without rewriting archived tokens.
            stickers: Object.fromEntries(
              Object.entries(repaired.stickers).map(([id, s]) => [
                id,
                { ...s, label: defaults.stickers[id].label },
              ]),
            ),
          }
        : repaired,
    );
    if (error) throw new Error(error);
    return repaired;
  };
  return {
    ...parsed,
    scheme,
    pairs,
    solves: parsed.solves.map((s) => ({
      ...s,
      ...(s.schemeSnapshot
        ? { schemeSnapshot: repairMetadata(s.schemeSnapshot) }
        : {}),
    })),
    schemeHistory: parsed.schemeHistory?.map((s) => ({
      ...s,
      scheme: repairMetadata(s.scheme, true),
    })),
  };
}

