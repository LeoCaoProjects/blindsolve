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
  /** Timer sessions are a user-facing grouping; legacy solves belong to Today. */
  sessionId?: string;
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
  trainingMode?: "recall" | "exec" | "trace" | "full";
  pairKey?: string;
  pairPiece?: "edges" | "corners";
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
  timerSessions?: Array<{ id: string; name: string; createdAt: string }>;
  activeTimerSessionId?: string;
  onboarded: boolean;
  schemeUpdatedAt: string;
  multiphaseTiming: boolean;
  showLiveTimer: boolean;
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
  timerSessions: [
    { id: "today", name: "Today", createdAt: new Date(0).toISOString() },
  ],
  activeTimerSessionId: "today",
  onboarded: false,
  schemeUpdatedAt: new Date(0).toISOString(),
  multiphaseTiming: true,
  showLiveTimer: true,
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
    data.solves.length > 0 ||
    data.attempts.length > 0 ||
    JSON.stringify(data.scheme) !== JSON.stringify(defaults.scheme) ||
    data.multiphaseTiming !== defaults.multiphaseTiming ||
    data.showLiveTimer !== defaults.showLiveTimer ||
    (data.pairSharing ?? "shared") !== defaults.pairSharing ||
    (data.flippedEdges ?? "cycle") !== defaults.flippedEdges ||
    (data.twistedCorners ?? "cycle") !== defaults.twistedCorners ||
    JSON.stringify(data.defaultCubeView ?? defaults.defaultCubeView) !==
      JSON.stringify(defaults.defaultCubeView) ||
    JSON.stringify(data.timerSessions ?? defaults.timerSessions) !==
      JSON.stringify(defaults.timerSessions) ||
    (data.activeTimerSessionId ?? "today") !== defaults.activeTimerSessionId
  );
}
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
    sessionId: text.optional(),
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
  pairs: z
    .record(z.string(), pairSchema)
    .refine(
      (pairs) => Object.keys(pairs).length <= 2304,
      "Backup contains too many letter pairs",
    ),
  solves: z.array(solveSchema).max(100000),
  attempts: z
    .array(
      z.object({
        id: z.string().uuid(),
        kind: z.enum(["memo", "flashcard"]),
        correct: z.boolean(),
        accuracy: z.number().min(0).max(1),
        createdAt: iso,
        trainingMode: z.enum(["recall", "exec", "trace", "full"]).optional(),
        pairKey: text.optional(),
        pairPiece: z.enum(["edges", "corners"]).optional(),
        durationMs: z.number().int().nonnegative().optional(),
        targets: z.number().int().nonnegative().optional(),
        pairs: z.number().int().nonnegative().optional(),
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
  onboarded: z.boolean().default(true),
  schemeUpdatedAt: iso.default(new Date(0).toISOString()),
  multiphaseTiming: z.boolean().default(true),
  showLiveTimer: z.boolean().default(true),
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
  pending?: Record<string, SyncChange>;
  lastAttemptAt?: string;
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

export type SyncRecordKind = "settings" | "pair" | "solve" | "attempt";
export interface SyncChange {
  kind: SyncRecordKind;
  recordId: string;
  payload: unknown | null;
  deleted: boolean;
  updatedAt: string;
}

interface SyncRecordRow {
  kind: SyncRecordKind;
  record_id: string;
  payload: unknown | null;
  deleted: boolean;
  updated_at: string;
}

const syncKey = (change: Pick<SyncChange, "kind" | "recordId">) =>
  `${change.kind}:${change.recordId}`;

const settingsPayload = (data: AppData) => ({
  schemeHistory: data.schemeHistory ?? [],
  scheme: data.scheme,
  timerSessions: data.timerSessions,
  activeTimerSessionId: data.activeTimerSessionId,
  onboarded: data.onboarded,
  schemeUpdatedAt: data.schemeUpdatedAt,
  multiphaseTiming: data.multiphaseTiming,
  showLiveTimer: data.showLiveTimer,
  pairSharing: data.pairSharing,
  flippedEdges: data.flippedEdges,
  twistedCorners: data.twistedCorners,
  defaultCubeView: data.defaultCubeView,
  preferencesUpdatedAt: data.preferencesUpdatedAt,
});

export function coalesceSyncChanges(
  current: Record<string, SyncChange> | undefined,
  changes: SyncChange[],
) {
  const next = { ...(current ?? {}) };
  for (const change of changes) next[syncKey(change)] = change;
  return next;
}

/** Remove work that the server snapshot already contains.
 *
 * A successful write in another tab can leave this tab holding an older copy
 * of the same pending record. Replaying that record forever creates revision
 * conflicts without changing any data.
 */
export function pruneAcknowledgedSyncChanges(
  remote: AppData,
  pending: Record<string, SyncChange> | undefined,
) {
  const remoteRecords = new Map(
    seedSyncChanges(remote, "").map((change) => [syncKey(change), change]),
  );
  return Object.fromEntries(
    Object.entries(pending ?? {}).filter(([key, change]) => {
      const remoteChange = remoteRecords.get(key);
      if (change.deleted) return remoteChange !== undefined;
      return (
        !remoteChange ||
        JSON.stringify(remoteChange.payload) !== JSON.stringify(change.payload)
      );
    }),
  );
}

export function diffSyncChanges(
  before: AppData,
  after: AppData,
  updatedAt = new Date().toISOString(),
): SyncChange[] {
  const changes: SyncChange[] = [];
  if (
    JSON.stringify(settingsPayload(before)) !==
    JSON.stringify(settingsPayload(after))
  )
    changes.push({
      kind: "settings",
      recordId: "settings",
      payload: settingsPayload(after),
      deleted: false,
      updatedAt,
    });
  const diffMap = <T>(
    kind: "pair" | "solve" | "attempt",
    previous: Map<string, T>,
    next: Map<string, T>,
  ) => {
    for (const [id, value] of next)
      if (JSON.stringify(previous.get(id)) !== JSON.stringify(value))
        changes.push({
          kind,
          recordId: id,
          payload: value,
          deleted: false,
          updatedAt,
        });
    for (const id of previous.keys())
      if (!next.has(id))
        changes.push({
          kind,
          recordId: id,
          payload: null,
          deleted: true,
          updatedAt,
        });
  };
  diffMap(
    "pair",
    new Map(Object.entries(before.pairs)),
    new Map(Object.entries(after.pairs)),
  );
  diffMap(
    "solve",
    new Map(before.solves.map((item) => [item.id, item])),
    new Map(after.solves.map((item) => [item.id, item])),
  );
  diffMap(
    "attempt",
    new Map(before.attempts.map((item) => [item.id, item])),
    new Map(after.attempts.map((item) => [item.id, item])),
  );
  return changes;
}

export function seedSyncChanges(
  data: AppData,
  updatedAt = new Date().toISOString(),
) {
  const changes: SyncChange[] = [
    {
      kind: "settings",
      recordId: "settings",
      payload: settingsPayload(data),
      deleted: false,
      updatedAt,
    },
  ];
  for (const [recordId, payload] of Object.entries(data.pairs))
    changes.push({
      kind: "pair",
      recordId,
      payload,
      deleted: false,
      updatedAt,
    });
  for (const payload of data.solves)
    changes.push({
      kind: "solve",
      recordId: payload.id,
      payload,
      deleted: false,
      updatedAt,
    });
  for (const payload of data.attempts)
    changes.push({
      kind: "attempt",
      recordId: payload.id,
      payload,
      deleted: false,
      updatedAt,
    });
  return changes;
}

function dataFromSyncRecords(rows: SyncRecordRow[]) {
  const data = emptyData();
  const settings = rows.find(
    (row) => row.kind === "settings" && !row.deleted,
  )?.payload;
  if (settings && typeof settings === "object") Object.assign(data, settings);
  for (const row of rows) {
    if (row.deleted || !row.payload) continue;
    if (row.kind === "pair")
      data.pairs[row.record_id] = row.payload as LetterPair;
    if (row.kind === "solve") data.solves.push(row.payload as SolveRecord);
    if (row.kind === "attempt")
      data.attempts.push(row.payload as PracticeAttempt);
  }
  data.solves.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  data.attempts.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return parseData(data);
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
      // Timer-session metadata is part of the settings record and must follow
      // the same last-writer timestamp as the other preferences. Omitting it
      // here made a read-only cloud merge look like a settings deletion.
      timerSessions: incomingPreferences
        ? incoming.timerSessions
        : local.timerSessions,
      activeTimerSessionId: incomingPreferences
        ? incoming.activeTimerSessionId
        : local.activeTimerSessionId,
      onboarded: local.onboarded || incoming.onboarded,
      multiphaseTiming: incomingPreferences
        ? incoming.multiphaseTiming
        : local.multiphaseTiming,
      showLiveTimer: incomingPreferences
        ? incoming.showLiveTimer
        : local.showLiveTimer,
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
  const { data: snapshotData, error: snapshotError } = await supabase.rpc(
    "get_bld_sync_snapshot",
  );
  if (snapshotError) throw new Error(snapshotError.message);
  const snapshot = snapshotData as {
    revision: number;
    records: SyncRecordRow[];
  } | null;
  if (!snapshot) throw new Error("Authentication required.");
  if (snapshot.records.length)
    return {
      data: dataFromSyncRecords(snapshot.records),
      revision: snapshot.revision,
      dirty: false,
      pending: {},
    };
  const { data, error } = await supabase.rpc("get_bld_workspace");
  if (error) throw new Error(error.message);
  const result = data as { data: unknown; revision: number };
  return {
    data: result.data ? parseData(result.data) : await loadLegacyCloud(),
    revision: result.revision,
    dirty: false,
    // An account without record-based data is seeded once after the safe merge.
    pending: undefined,
  };
}
/** Read-only migration of V1 rows. Never remove the original normalized tables. */
async function loadLegacyCloud(): Promise<AppData> {
  const data = emptyData();
  if (!supabase) return data;
  const [pairs, solves, schemes] = await Promise.all([
    supabase
      .from("letter_pairs")
      .select(
        "id,first_sticker_id,second_sticker_id,first_token,second_token,primary_mnemonic,encounters,forgotten,updated_at,letter_pair_aliases(mnemonic)",
      )
      .order("id"),
    supabase
      .from("bld_solves")
      .select(
        "id,scramble,memo_ms,execution_ms,total_ms,result,corner_memo,edge_memo,cycle_breaks,created_at,scheme_snapshot",
      )
      .order("id"),
    supabase
      .from("lettering_schemes")
      .select(
        "id,name,orientation,edge_buffer,corner_buffer,edge_method,corner_method,updated_at",
      )
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
        .select(
          "id,first_sticker_id,second_sticker_id,first_token,second_token,primary_mnemonic,encounters,forgotten,updated_at,letter_pair_aliases(mnemonic)",
        )
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
        .select(
          "id,scramble,memo_ms,execution_ms,total_ms,result,corner_memo,edge_memo,cycle_breaks,created_at,scheme_snapshot",
        )
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
    const labels = await supabase
      .from("sticker_labels")
      .select("physical_sticker_id,token")
      .eq("scheme_id", s.id)
      .order("physical_sticker_id");
    if (labels.error)
      throw new Error(`V1 labels could not be loaded: ${labels.error.message}`);
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
    for (const sticker of labels.data as Array<{
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
export class SyncConflictError extends Error {}

export async function saveCloudChanges(
  changes: SyncChange[],
  revision: number,
): Promise<number> {
  if (!supabase) throw new Error("Cloud storage is not configured.");
  if (!changes.length) return revision;
  const { data, error } = await supabase.rpc("apply_bld_sync_changes", {
    changes: changes.map((change) => ({
      kind: change.kind,
      record_id: change.recordId,
      payload: change.payload,
      deleted: change.deleted,
      updated_at: change.updatedAt,
    })),
    expected_revision: revision,
  });
  if (error) {
    if (error.code === "40001") throw new SyncConflictError(error.message);
    throw new Error(error.message);
  }
  return data as number;
}

export const syncRetryDelay = (attempt: number) =>
  Math.min(60_000, 2_000 * 2 ** Math.max(0, attempt));
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
