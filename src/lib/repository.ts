import { z } from "zod";
import { createSpeffzScheme } from "../domain/bld/speffz";
import type { LetteringScheme } from "../domain/bld/types";
import type { LetterPair } from "../domain/letterPairs";
import { pairKey, normalizeMnemonic } from "../domain/letterPairs";
import { supabase } from "./supabase";

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
  mnemonic: string;
  firstCycleBreak?: boolean;
  secondCycleBreak?: boolean;
}
export interface PracticeAttempt {
  id: string;
  kind: "memo" | "flashcard";
  correct: boolean;
  accuracy: number;
  createdAt: string;
  trainingMode?: "recall" | "trace" | "full";
  durationMs?: number;
  targets?: number;
  pairs?: number;
}
export interface AppData {
  schemeHistory?: Array<{ scheme: LetteringScheme; updatedAt: string }>;
  scheme: LetteringScheme;
  pairs: Record<string, LetterPair>;
  solves: SolveRecord[];
  attempts: PracticeAttempt[];
  onboarded: boolean;
  schemeUpdatedAt: string;
  multiphaseTiming: boolean;
  pairSharing?: "shared" | "separate";
  flippedEdges?: "cycle" | "separate";
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
  onboarded: false,
  schemeUpdatedAt: new Date(0).toISOString(),
  multiphaseTiming: true,
  pairSharing: "shared",
  flippedEdges: "cycle",
  twistedCorners: "cycle",
  defaultCubeView: { top: "white", front: "green" },
  preferencesUpdatedAt: new Date(0).toISOString(),
});
const text = z.string().max(1000),
  tokens = z.array(z.string().max(12)).max(200);
const iso = z
  .string()
  .refine((v) => Number.isFinite(Date.parse(v)), "Invalid date");
const pairSchema = z
  .object({
    id: z.string().uuid(),
    firstStickerId: text,
    secondStickerId: text,
    firstToken: text,
    secondToken: text,
    primaryMnemonic: text,
    alternates: z.array(text).max(100),
    encounters: z.number().int().nonnegative(),
    forgotten: z.number().int().nonnegative(),
    updatedAt: iso,
  })
  .refine((p) => p.forgotten <= p.encounters);
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
    memoSnapshot: z
      .object({
        corners: z.array(
          z.object({
            firstStickerId: text,
            secondStickerId: text.optional(),
            firstToken: text,
            secondToken: text.optional(),
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
            mnemonic: text,
          }),
        ),
      })
      .optional(),
  })
  .refine(
    (s) => s.totalMs === s.memoMs + s.executionMs,
    "Invalid timing split",
  );
const dataSchema = z.object({
  schemeHistory: z
    .array(z.object({ scheme: schemeSchema, updatedAt: iso }))
    .max(100)
    .optional(),
  scheme: schemeSchema,
  pairs: z.record(z.string(), pairSchema),
  solves: z.array(solveSchema).max(100000),
  attempts: z
    .array(
      z.object({
        id: z.string().uuid(),
        kind: z.enum(["memo", "flashcard"]),
        correct: z.boolean(),
        accuracy: z.number().min(0).max(1),
        createdAt: iso,
        trainingMode: z.enum(["recall", "trace", "full"]).optional(),
        durationMs: z.number().int().nonnegative().optional(),
        targets: z.number().int().nonnegative().optional(),
        pairs: z.number().int().nonnegative().optional(),
      }),
    )
    .default([]),
  onboarded: z.boolean().default(true),
  schemeUpdatedAt: iso.default(new Date(0).toISOString()),
  multiphaseTiming: z.boolean().default(true),
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
      { ...s, label: parsed.scheme.stickers[id]?.label ?? s.label },
    ]),
  );
  const scheme = { ...parsed.scheme, stickers };
  const error = validateScheme(scheme);
  if (error) throw new Error(error);
  const pairs: Record<string, LetterPair> = {};
  for (const pair of Object.values(parsed.pairs)) {
    if (!stickers[pair.firstStickerId] || !stickers[pair.secondStickerId])
      throw new Error("Backup contains an unknown sticker ID.");
    const key = pairKey(pair.firstStickerId, pair.secondStickerId);
    if (pairs[key])
      throw new Error("Backup contains duplicate pair identities.");
    pairs[key] = pair;
  }
  const repairMetadata = (old: LetteringScheme) => {
    const repaired = {
      ...old,
      stickers: Object.fromEntries(
        Object.entries(defaults.stickers).map(([id, s]) => [
          id,
          { ...s, label: old.stickers[id]?.label ?? s.label },
        ]),
      ),
    };
    const error = validateScheme(repaired);
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
      scheme: repairMetadata(s.scheme),
    })),
  };
}

const storageKey = (owner: string | null) =>
  `cubeiq-bld-v2:${owner ?? "guest"}`;
export interface LocalEnvelope {
  data: AppData;
  dirty: boolean;
  revision: number;
}
export function loadLocal(owner: string | null = null): LocalEnvelope {
  const raw = localStorage.getItem(storageKey(owner));
  if (raw) {
    try {
      const envelope = JSON.parse(raw) as LocalEnvelope;
      return { ...envelope, data: parseData(envelope.data) };
    } catch (e) {
      try {
        localStorage.setItem(
          `${storageKey(owner)}:unreadable:${Date.now()}`,
          raw,
        );
      } catch {
        /* Keep original intact if storage is unavailable. */
      }
      throw e;
    }
  }
  const legacy = !owner && localStorage.getItem("cubeiq-bld-data-v1");
  if (legacy)
    return { data: parseData(JSON.parse(legacy)), dirty: false, revision: 0 };
  return { data: emptyData(), dirty: false, revision: 0 };
}
export function saveLocal(owner: string | null, envelope: LocalEnvelope) {
  localStorage.setItem(storageKey(owner), JSON.stringify(envelope));
}

export function mergeData(
  local: AppData,
  incoming: AppData,
): { data: AppData; conflicts: number } {
  const pairs = { ...local.pairs };
  let conflicts = 0;
  for (const [key, p] of Object.entries(incoming.pairs)) {
    const old = pairs[key];
    if (!old) {
      pairs[key] = p;
      continue;
    }
    const newer = Date.parse(p.updatedAt) > Date.parse(old.updatedAt) ? p : old;
    const other = newer === p ? old : p;
    const differs =
      normalizeMnemonic(newer.primaryMnemonic) !==
      normalizeMnemonic(other.primaryMnemonic);
    if (differs) conflicts++;
    const alternatives = [
      ...newer.alternates,
      ...other.alternates,
      ...(differs && other.primaryMnemonic ? [other.primaryMnemonic] : []),
    ];
    pairs[key] = {
      ...newer,
      id: p.id,
      alternates: alternatives.filter(
        (s, i, a) =>
          normalizeMnemonic(s) !== normalizeMnemonic(newer.primaryMnemonic) &&
          a.findIndex((v) => normalizeMnemonic(v) === normalizeMnemonic(s)) ===
            i,
      ),
      encounters: Math.max(old.encounters, p.encounters),
      forgotten: Math.max(old.forgotten, p.forgotten),
    };
  }
  const solveMap = new Map(local.solves.map((s) => [s.id, s]));
  for (const solve of incoming.solves) {
    const old = solveMap.get(solve.id);
    if (
      !old ||
      Date.parse(solve.updatedAt ?? solve.createdAt) >
        Date.parse(old.updatedAt ?? old.createdAt)
    )
      solveMap.set(solve.id, solve);
  }
  const incomingScheme =
    Date.parse(incoming.schemeUpdatedAt) > Date.parse(local.schemeUpdatedAt);
  const incomingPreferences =
    Date.parse(incoming.preferencesUpdatedAt) >
    Date.parse(local.preferencesUpdatedAt);
  return {
    conflicts,
    data: {
      schemeHistory: [
        ...new Map(
          [
            ...(local.schemeHistory ?? []),
            ...(incoming.schemeHistory ?? []),
            ...(JSON.stringify(local.scheme) !== JSON.stringify(incoming.scheme)
              ? [
                  {
                    scheme: incomingScheme ? local.scheme : incoming.scheme,
                    updatedAt: incomingScheme
                      ? local.schemeUpdatedAt
                      : incoming.schemeUpdatedAt,
                  },
                ]
              : []),
          ].map((s) => [JSON.stringify(s.scheme), s]),
        ).values(),
      ].slice(-20),
      scheme: incomingScheme ? incoming.scheme : local.scheme,
      schemeUpdatedAt: incomingScheme
        ? incoming.schemeUpdatedAt
        : local.schemeUpdatedAt,
      pairs,
      solves: [...solveMap.values()].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      ),
      attempts: [
        ...new Map(
          [...local.attempts, ...incoming.attempts].map((a) => [a.id, a]),
        ).values(),
      ],
      onboarded: local.onboarded || incoming.onboarded,
      multiphaseTiming: incomingPreferences
        ? incoming.multiphaseTiming
        : local.multiphaseTiming,
      pairSharing: incomingPreferences
        ? incoming.pairSharing
        : local.pairSharing,
      flippedEdges: incomingPreferences
        ? incoming.flippedEdges
        : local.flippedEdges,
      twistedCorners: incomingPreferences
        ? incoming.twistedCorners
        : local.twistedCorners,
      defaultCubeView: incomingPreferences
        ? incoming.defaultCubeView
        : local.defaultCubeView,
      preferencesUpdatedAt: incomingPreferences
        ? incoming.preferencesUpdatedAt
        : local.preferencesUpdatedAt,
    },
  };
}

export async function loadCloud(): Promise<LocalEnvelope> {
  if (!supabase) throw new Error("Cloud storage is not configured.");
  const { data, error } = await supabase.rpc("get_bld_workspace");
  if (error) throw new Error(error.message);
  const result = data as { data: unknown; revision: number };
  return {
    data: result.data ? parseData(result.data) : await loadLegacyCloud(),
    revision: result.revision,
    dirty: false,
  };
}
/** Read-only migration of V1 rows. Never remove the original normalized tables. */
async function loadLegacyCloud(): Promise<AppData> {
  const data = emptyData();
  if (!supabase) return data;
  const [pairs, solves, schemes] = await Promise.all([
    supabase
      .from("letter_pairs")
      .select("*,letter_pair_aliases(mnemonic)")
      .order("id"),
    supabase.from("bld_solves").select("*").order("id"),
    supabase
      .from("lettering_schemes")
      .select("*,sticker_labels(*)")
      .eq("is_active", true)
      .maybeSingle(),
  ]);
  for (const result of [pairs, solves, schemes])
    if (result.error)
      throw new Error(`V1 data could not be loaded: ${result.error.message}`);
  // PostgREST defaults to a 1,000-row cap. Never silently truncate a V1 account.
  if (pairs.data?.length === 1000) {
    for (let offset = 1000; ; offset += 1000) {
      const next = await supabase
        .from("letter_pairs")
        .select("*,letter_pair_aliases(mnemonic)")
        .order("id")
        .range(offset, offset + 999);
      if (next.error) throw new Error(next.error.message);
      pairs.data.push(...next.data);
      if (next.data.length < 1000) break;
    }
  }
  if (solves.data?.length === 1000) {
    for (let offset = 1000; ; offset += 1000) {
      const next = await supabase
        .from("bld_solves")
        .select("*")
        .order("id")
        .range(offset, offset + 999);
      if (next.error) throw new Error(next.error.message);
      solves.data.push(...next.data);
      if (next.data.length < 1000) break;
    }
  }
  for (const p of pairs.data ?? [])
    data.pairs[pairKey(p.first_sticker_id, p.second_sticker_id)] = {
      id: p.id,
      firstStickerId: p.first_sticker_id,
      secondStickerId: p.second_sticker_id,
      firstToken: p.first_token,
      secondToken: p.second_token,
      primaryMnemonic: p.primary_mnemonic,
      alternates: (p.letter_pair_aliases as Array<{ mnemonic: string }>).map(
        (a) => a.mnemonic,
      ),
      encounters: p.encounters,
      forgotten: p.forgotten,
      updatedAt: p.updated_at,
    };
  data.solves = (solves.data ?? []).map((s) => ({
    id: s.id,
    scramble: s.scramble,
    memoMs: s.memo_ms,
    executionMs: s.execution_ms,
    totalMs: s.total_ms,
    result: s.result,
    cornerMemo: s.corner_memo,
    edgeMemo: s.edge_memo,
    cycleBreaks: s.cycle_breaks,
    createdAt: s.created_at,
    ...(s.scheme_snapshot ? { schemeSnapshot: s.scheme_snapshot } : {}),
  }));
  const s = schemes.data;
  if (s) {
    data.scheme = {
      ...data.scheme,
      id: s.id,
      name: s.name,
      orientation: s.orientation,
      edgeBuffer: s.edge_buffer,
      cornerBuffer: s.corner_buffer,
      edgeMethod: s.edge_method,
      cornerMethod: s.corner_method,
    };
    for (const sticker of s.sticker_labels as Array<{
      physical_sticker_id: string;
      token: string;
    }>) {
      if (data.scheme.stickers[sticker.physical_sticker_id])
        data.scheme.stickers[sticker.physical_sticker_id].label = sticker.token;
    }
    data.schemeUpdatedAt = s.updated_at;
  }
  data.onboarded =
    !!s || !!data.solves.length || !!Object.keys(data.pairs).length;
  return parseData(data);
}
export async function saveCloud(
  data: AppData,
  revision: number,
): Promise<number> {
  if (!supabase) throw new Error("Cloud storage is not configured.");
  const { data: next, error } = await supabase.rpc("save_bld_workspace", {
    payload: data,
    expected_revision: revision,
  });
  if (error) throw new Error(error.message);
  return next as number;
}
export function downloadBackup(data: AppData) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify({ version: 3, data }, null, 2)], {
      type: "application/json",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `3bld-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function parseBackup(content: string) {
  const parsed: unknown = JSON.parse(content);
  if (
    typeof parsed === "object" &&
    parsed !== null &&
    "version" in parsed &&
    parsed.version !== 1 &&
    parsed.version !== 2 &&
    parsed.version !== 3
  )
    throw new Error(
      "Unsupported backup version. Use a compatible 3BLD backup.",
    );
  return parseData(
    typeof parsed === "object" && parsed !== null && "data" in parsed
      ? parsed.data
      : parsed,
  );
}
