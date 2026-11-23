import type { LetterPair } from "../domain/letterPairs";
import { pairKey, normalizeMnemonic } from "../domain/letterPairs";
import { supabase } from "../lib/supabase";
import { parseMnemonicRecordKey, normalizeLabel } from "../domain/letterPairs/identity";
import { logicalMnemonicSchema } from "./logicalPairSchema";
import { logicalDeletionOverlay, mergeLogicalState } from "../domain/letterPairs/logical";
import { readEnvelopeJson, writeEnvelopeJson } from "./localEnvelopeStorage";
import {
  emptyData,
  parseData,
  pairSchema,
  type AppData,
  type SolveRecord,
  type PracticeAttempt,
} from "./model";

const storageKey = (owner: string | null) =>
  `cubeiq-bld-v2:${owner ?? "guest"}`;
export interface LocalEnvelope {
  data: AppData;
  dirty: boolean;
  revision: number;
  pending?: Record<string, SyncChange>;
  lastAttemptAt?: string;
  /** Durable negative records; owner-scoped with this envelope, never inferred from absence. */
  tombstones?: Record<string, string>;
}
export function loadLocal(owner: string | null = null): LocalEnvelope {
  const raw = localStorage.getItem(storageKey(owner));
  if (raw !== null) {
    try {
      const envelope = readEnvelopeJson(raw) as LocalEnvelope;
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
  const legacy = owner === null ? localStorage.getItem("cubeiq-bld-data-v1") : null;
  if (legacy !== null)
    return { data: parseData(JSON.parse(legacy)), dirty: false, revision: 0 };
  return { data: emptyData(), dirty: false, revision: 0 };
}
export function saveLocal(owner: string | null, envelope: LocalEnvelope) {
  writeEnvelopeJson(storageKey(owner), envelope);
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
  activeTimerMode: data.activeTimerMode,
  onboarded: data.onboarded,
  schemeUpdatedAt: data.schemeUpdatedAt,
  multiphaseTiming: data.multiphaseTiming,
  showLiveTimer: data.showLiveTimer,
  m2SecondTargetSwap: data.m2SecondTargetSwap,
  memoOrder: data.memoOrder,
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
  for (const change of changes) {
    const key = syncKey(change);
    if (
      next[key]?.deleted &&
      (change.kind === "solve" || change.kind === "attempt") &&
      !change.deleted
    )
      continue;
    next[key] = change;
  }
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
  tombstones?: Record<string, string>,
) {
  const remoteRecords = new Map(
    seedSyncChanges(remote, "").map((change) => [syncKey(change), change]),
  );
  return Object.fromEntries(
    Object.entries(pending ?? {}).filter(([key, change]) => {
      const remoteChange = remoteRecords.get(key);
      if (change.deleted)
        return tombstones === undefined
          ? remoteChange !== undefined
          : !tombstones[key];
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
      if (
        previous.get(id) !== value &&
        JSON.stringify(previous.get(id)) !== JSON.stringify(value)
      )
        changes.push({
          kind,
          recordId: id,
          payload: kind === "pair" ? pairSchema.parse(value) : value,
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
  if (before.pairs !== after.pairs)
    diffMap(
      "pair",
      new Map(Object.entries(before.pairs)),
      new Map(Object.entries(after.pairs)),
    );
  // The optional logical namespace is additive: never rewrite legacy physical rows.
  const logicalChanges = new Map<string, SyncChange>();
  for (const [recordId, value] of Object.entries(after.logicalPairs ?? {}))
    if (
      JSON.stringify(before.logicalPairs?.[recordId]) !== JSON.stringify(value)
    )
      logicalChanges.set(recordId, {
        kind: "pair",
        recordId,
        payload: logicalMnemonicSchema.parse(value),
        deleted: false,
        updatedAt,
      });
  for (const recordId of Object.keys(before.logicalPairs ?? {}))
    if (!after.logicalPairs?.[recordId])
      logicalChanges.set(recordId, {
        kind: "pair",
        recordId,
        payload: null,
        deleted: true,
        updatedAt,
      });
  for (const [recordId, stamp] of Object.entries(
    after.logicalPairDeletions ?? {},
  ))
    if (
      before.logicalPairDeletions?.[recordId] !== stamp &&
      (!after.logicalPairs?.[recordId] ||
        Date.parse(stamp) >= Date.parse(after.logicalPairs[recordId].updatedAt))
    )
      logicalChanges.set(recordId, {
        kind: "pair",
        recordId,
        payload: null,
        deleted: true,
        updatedAt: stamp,
      });
  changes.push(...logicalChanges.values());
  if (before.solves !== after.solves)
    diffMap(
      "solve",
      new Map(
        before.solves
          .filter((item) => !item.deleted)
          .map((item) => [item.id, item]),
      ),
      new Map(
        after.solves
          .filter((item) => !item.deleted)
          .map((item) => [item.id, item]),
      ),
    );
  if (before.attempts !== after.attempts)
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
      payload: pairSchema.parse(payload),
      deleted: false,
      updatedAt,
    });
  const logical = logicalDeletionOverlay(data, {});
  for (const [recordId, payload] of Object.entries(logical.logicalPairs ?? {}))
    changes.push({
      kind: "pair",
      recordId,
      payload: logicalMnemonicSchema.parse(payload),
      deleted: false,
      updatedAt,
    });
  for (const [recordId, stamp] of Object.entries(
    logical.logicalPairDeletions ?? {},
  ))
    changes.push({
      kind: "pair",
      recordId,
      payload: null,
      deleted: true,
      updatedAt: stamp,
    });
  for (const payload of data.solves)
    changes.push({
      kind: "solve",
      recordId: payload.id,
      payload: payload.deleted ? null : payload,
      deleted: !!payload.deleted,
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
    if (row.kind === "pair" && parseMnemonicRecordKey(row.record_id)) {
      if (row.deleted)
        (data.logicalPairDeletions ??= {})[row.record_id] = row.updated_at;
      else
        (data.logicalPairs ??= {})[row.record_id] = logicalMnemonicSchema.parse(
          row.payload,
        );
      continue;
    }
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

/** Preserve explicit deletion evidence across snapshots, retries, tabs and reloads. */
export function deletionIndex(envelope: LocalEnvelope): Record<string, string> {
  const index = { ...envelope.tombstones };
  for (const [key, stamp] of Object.entries(
    envelope.data.logicalPairDeletions ?? {},
  ))
    if (
      parseMnemonicRecordKey(key) &&
      (!index[`pair:${key}`] ||
        Date.parse(stamp) > Date.parse(index[`pair:${key}`]))
    )
      index[`pair:${key}`] = stamp;
  for (const solve of envelope.data.solves)
    if (solve.deleted)
      index[`solve:${solve.id}`] = solve.updatedAt ?? solve.createdAt;
  for (const change of Object.values(envelope.pending ?? {}))
    if (change.deleted) index[syncKey(change)] = change.updatedAt;
  return index;
}

export function applyTombstones(
  data: AppData,
  tombstones: Record<string, string>,
): AppData {
  const blocked = (kind: string, id: string) => !!tombstones[`${kind}:${id}`];
  const solves = data.solves.filter(
    (record) => !record.deleted && !blocked("solve", record.id),
  );
  const attempts = data.attempts.filter(
    (record) => !blocked("attempt", record.id),
  );
  const pairEntries = Object.entries(data.pairs).filter(([id, record]) => {
    const deletedAt = tombstones[`pair:${id}`];
    return !deletedAt || Date.parse(record.updatedAt) > Date.parse(deletedAt);
  });
  return {
    ...data,
    ...logicalDeletionOverlay(data, tombstones),
    solves: solves.length === data.solves.length ? data.solves : solves,
    attempts:
      attempts.length === data.attempts.length ? data.attempts : attempts,
    pairs:
      pairEntries.length === Object.keys(data.pairs).length
        ? data.pairs
        : Object.fromEntries(pairEntries),
  };
}

export function trackDeletions(
  previous: Record<string, string> | undefined,
  changes: SyncChange[],
) {
  const next = { ...previous };
  for (const change of changes) {
    const key = syncKey(change);
    if (change.deleted) next[key] = change.updatedAt;
    // Pair keys may be intentionally recreated; solve/attempt UUIDs are never reused.
    else if (change.kind === "pair") delete next[key];
  }
  return next;
}

export function reconcileSync(
  local: LocalEnvelope,
  remote: LocalEnvelope,
  cloudAcknowledgement = true,
): LocalEnvelope & { conflicts: number } {
  const merged = mergeData(local.data, remote.data, cloudAcknowledgement);
  const tombstones = deletionIndex(local);
  for (const [key, stamp] of Object.entries(deletionIndex(remote)))
    if (!tombstones[key] || Date.parse(stamp) > Date.parse(tombstones[key]))
      tombstones[key] = stamp;
  let data = applyTombstones(merged.data, tombstones);
  // Attempts lack an edit timestamp; an unacknowledged local result is still explicit work.
  const attempts = new Map(
    data.attempts.map((attempt) => [attempt.id, attempt]),
  );
  for (const change of Object.values(local.pending ?? {}))
    if (
      change.kind === "attempt" &&
      !change.deleted &&
      !tombstones[syncKey(change)] &&
      change.payload
    )
      attempts.set(change.recordId, change.payload as PracticeAttempt);
  data = { ...data, attempts: [...attempts.values()] };
  const differences =
    remote.pending === undefined
      ? seedSyncChanges(data)
      : diffSyncChanges(remote.data, data);
  const differenceKeys = new Set(differences.map(syncKey));
  const outstanding = cloudAcknowledgement
    ? Object.fromEntries(
        Object.entries(pruneAcknowledgedSyncChanges(
          remote.data,
          local.pending,
          deletionIndex(remote),
        )).filter(([key, change]) =>
          // If the server already contains the canonical winner, an older
          // queued upsert must not overwrite it at the refreshed revision.
          change.deleted || differenceKeys.has(key),
        ),
      )
    : local.pending;
  const pending = coalesceSyncChanges(
    outstanding,
    differences.filter((change) => {
      const queued = outstanding?.[syncKey(change)];
      return (
        !queued ||
        queued.deleted !== change.deleted ||
        JSON.stringify(queued.payload) !== JSON.stringify(change.payload)
      );
    }),
  );
  const remoteDeleted = deletionIndex(remote);
  for (const [key, updatedAt] of Object.entries(tombstones)) {
    const split = key.indexOf(":");
    const kind = key.slice(0, split) as SyncRecordKind;
    const recordId = key.slice(split + 1);
    if (
      kind === "pair" &&
      (data.pairs[recordId] || data.logicalPairs?.[recordId])
    )
      continue;
    if (!cloudAcknowledgement && pending[key]?.deleted) continue;
    delete pending[key];
    if (!remoteDeleted[key])
      pending[key] = {
        kind,
        recordId,
        payload: null,
        deleted: true,
        updatedAt,
      };
  }
  return {
    data,
    tombstones,
    pending,
    revision: remote.revision,
    dirty: Object.keys(pending).length > 0,
    lastAttemptAt: local.lastAttemptAt,
    conflicts: merged.conflicts,
  };
}

/** A peer's local data is not proof that its queued operations reached the server. */
export function reconcilePeer(local: LocalEnvelope, incoming: LocalEnvelope) {
  const localPending =
    incoming.revision > local.revision
      ? pruneAcknowledgedSyncChanges(
          incoming.data,
          local.pending,
          deletionIndex(incoming),
        )
      : local.pending;
  const changes = [
    ...Object.values(localPending ?? {}),
    ...Object.values(incoming.pending ?? {}),
  ].sort((a, b) => Date.parse(a.updatedAt) - Date.parse(b.updatedAt));
  const pending = coalesceSyncChanges({}, changes);
  const result = reconcileSync(
    { ...local, pending },
    { ...incoming, pending: incoming.pending ?? {} },
    false,
  );
  return { ...result, revision: Math.max(local.revision, incoming.revision) };
}

export function syncSnapshotEnvelope(
  rows: SyncRecordRow[],
  revision: number,
): LocalEnvelope {
  const tombstones: Record<string, string> = {};
  for (const row of rows)
    if (row.deleted)
      tombstones[`${row.kind}:${row.record_id}`] = row.updated_at;
  const envelope = {
    data: dataFromSyncRecords(rows),
    revision,
    dirty: false,
    pending: {},
    tombstones,
  };
  return { ...envelope, tombstones: deletionIndex(envelope) };
}

export function mergeData(
  local: AppData,
  incoming: AppData,
  preferIncomingLogicalTie = false,
): { data: AppData; conflicts: number } {
  const pairs = { ...local.pairs };
  let conflicts = 0;
  for (const [key, record] of Object.entries(incoming.logicalPairs ?? {})) {
    const previous = local.logicalPairs?.[key];
    if (previous && normalizeMnemonic(previous.primaryMnemonic) !== normalizeMnemonic(record.primaryMnemonic))
      conflicts++;
  }
  for (const [key, p] of Object.entries(incoming.pairs)) {
    const old = pairs[key];
    if (!old) {
      pairs[key] = p;
      continue;
    }
    if (
      normalizeLabel(old.firstToken) !== normalizeLabel(p.firstToken) ||
      normalizeLabel(old.secondToken) !== normalizeLabel(p.secondToken)
    ) {
      // An older client reused a physical key for a different logical pair.
      // Retain the displaced bytes as legacy evidence; never reinterpret labels
      // or overwrite the other pair's word. Keep the incoming transport row in
      // place so synchronization does not fight that old physical key forever.
      const labels = [
        normalizeLabel(old.firstToken),
        normalizeLabel(old.secondToken),
      ];
      const base = JSON.stringify([
        "legacy-v1",
        old.id,
        ...(labels.every((label) => label.length <= 12)
          ? labels
          : [old.updatedAt]),
      ]);
      let archive = base,
        suffix = 0;
      while (
        pairs[archive] &&
        JSON.stringify(pairs[archive]) !== JSON.stringify(old)
      )
        archive = `${base}:${++suffix}`;
      pairs[archive] = old;
      pairs[key] = p;
      continue;
    }
    const newer = Date.parse(p.updatedAt) > Date.parse(old.updatedAt) ? p : old;
    const other = newer === p ? old : p;
    const differs =
      normalizeMnemonic(newer.primaryMnemonic) !==
      normalizeMnemonic(other.primaryMnemonic);
    if (differs) conflicts++;
    if (newer.vocabulary) {
      const shared =
        other.vocabulary &&
        Date.parse(other.vocabulary.sharedUpdatedAt) >
          Date.parse(newer.vocabulary.sharedUpdatedAt)
          ? other.vocabulary
          : newer.vocabulary;
      const scoped =
        other.vocabulary &&
        Date.parse(other.vocabulary.overrideUpdatedAt) >
          Date.parse(newer.vocabulary.overrideUpdatedAt)
          ? other.vocabulary
          : newer.vocabulary;
      const vocabulary = {
        shared: shared.shared,
        sharedUpdatedAt: shared.sharedUpdatedAt,
        overrideUpdatedAt: scoped.overrideUpdatedAt,
        ...(scoped.override ? { override: scoped.override } : {}),
      };
      const words = vocabulary.override ?? vocabulary.shared;
      pairs[key] = {
        ...newer,
        id: p.id,
        vocabulary,
        primaryMnemonic: words[0] ?? "",
      };
      continue;
    }
    pairs[key] = {
      ...newer,
      id: p.id,
    };
  }
  const solveMap = new Map(local.solves.map((s) => [s.id, s]));
  for (const solve of incoming.solves) {
    const old = solveMap.get(solve.id);
    if (old?.deleted && !solve.deleted) continue;
    if (solve.deleted && !old?.deleted) {
      solveMap.set(solve.id, solve);
      continue;
    }
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
      ...mergeLogicalState(local, incoming, preferIncomingLogicalTie),
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
      activeTimerMode: incomingPreferences
        ? incoming.activeTimerMode
        : local.activeTimerMode,
      onboarded: local.onboarded || incoming.onboarded,
      multiphaseTiming: incomingPreferences
        ? incoming.multiphaseTiming
        : local.multiphaseTiming,
      showLiveTimer: incomingPreferences
        ? incoming.showLiveTimer
        : local.showLiveTimer,
      m2SecondTargetSwap: incomingPreferences
        ? incoming.m2SecondTargetSwap
        : local.m2SecondTargetSwap,
      memoOrder: incomingPreferences ? incoming.memoOrder : local.memoOrder,
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

type CloudOwnerContext = { owner: string; isCurrent: () => boolean };
type AuthorizeRead = <T extends { setHeader(name: string, value: string): unknown }>(request: T) => T;

async function pinCloudRead(context?: CloudOwnerContext) {
  if (!supabase) throw new Error("Cloud storage is not configured.");
  const client = supabase;
  const checkCurrent = () => {
    if (context && !context.isCurrent())
      throw new Error("Account changed during synchronization.");
  };
  checkCurrent();
  const session = context ? (await client.auth.getSession()).data.session : null;
  checkCurrent();
  if (context && (!session?.access_token || session.user.id !== context.owner))
    throw new Error("Account changed during synchronization.");
  const authorize: AuthorizeRead = (request) => {
    checkCurrent();
    if (session)
      request.setHeader("Authorization", `Bearer ${session.access_token}`);
    return request;
  };
  const checkSession = async () => {
    checkCurrent();
    const latest = await client.auth.getSession();
    checkCurrent();
    if (latest.error || latest.data.session?.user.id !== context?.owner ||
        latest.data.session?.access_token !== session?.access_token)
      throw new Error("Account session changed. Sign in again or retry the export.");
  };
  return { client, authorize, checkCurrent, checkSession };
}

const legacyReviewSources = [
  {
    table: "practice_attempts",
    columns: "id::text,user_id,pair_id,kind,correct,accuracy,details::text,created_at",
    reason: "The original bigint ID and details do not establish a canonical attempt identity or training mode.",
  },
  {
    table: "letter_pair_aliases",
    columns: "id::text,user_id,pair_id,mnemonic",
    reason: "The alias and physical pair reference do not establish a canonical word or scope.",
  },
] as const;
type LegacyReviewTable = {
  table: typeof legacyReviewSources[number]["table"];
  status: "complete" | "partial" | "unavailable";
  rows: { source: Record<string, unknown>; reason: string }[];
  issue?: string;
};

/** Explicit, read-only review, independent of canonical/V2 hydration. */
export async function loadLegacyRecovery(context: CloudOwnerContext) {
  const { client, authorize, checkSession } = await pinCloudRead(context);
  const tables: LegacyReviewTable[] = [];
  for (const { table, columns, reason } of legacyReviewSources) {
    const result: LegacyReviewTable = { table, status: "complete", rows: [] };
    let cursor: string | undefined;
    for (;;) {
      await checkSession();
      let query = client.from(table).select(columns).eq("user_id", context.owner)
        .order("id", { ascending: true }).limit(200);
      if (cursor !== undefined) query = query.gt("id", cursor);
      const response = await Promise.resolve(authorize(query)).catch(() => null);
      await checkSession();
      if (!response || response.error || !Array.isArray(response.data)) {
        result.status = result.rows.length ? "partial" : "unavailable";
        result.issue = "The server could not read this table. Check account access or retry.";
        break;
      }
      const { data } = response;
      if (!data.length) break;
      for (const row of data as unknown[]) {
        if (!row || typeof row !== "object" || !("user_id" in row) || row.user_id !== context.owner)
          throw new Error("The server response could not be verified for this account.");
        const source = row as Record<string, unknown>;
        const id = source.id;
        if (typeof id !== "string" || !/^-?\d{1,19}$/.test(id) ||
            (cursor !== undefined && BigInt(id) <= BigInt(cursor))) {
          result.status = "partial";
          result.issue = "A source ID could not be verified or pagination did not advance.";
          result.rows.push({ source, reason: result.issue });
          break;
        }
        result.rows.push({ source, reason });
        cursor = id;
      }
      if (result.status === "partial") break;
    }
    tables.push(result);
  }
  return { format: "blindsolve-v1-review", version: 1, tables } as const;
}

export async function loadCloud(context?: CloudOwnerContext): Promise<LocalEnvelope> {
  const { client, authorize, checkCurrent } = await pinCloudRead(context);
  const { data: snapshotData, error: snapshotError } = await authorize(
    client.rpc("get_bld_sync_snapshot"),
  );
  checkCurrent();
  if (snapshotError) throw new Error(snapshotError.message);
  const snapshot = snapshotData as {
    revision: number;
    records: SyncRecordRow[];
  } | null;
  if (!snapshot) throw new Error("Authentication required.");
  if (snapshot.records.length || snapshot.revision > 0)
    return syncSnapshotEnvelope(snapshot.records, snapshot.revision);
  const { data, error } = await authorize(client.rpc("get_bld_workspace"));
  checkCurrent();
  if (error) throw new Error(error.message);
  const result = data as { data: unknown; revision: number };
  const workspace = result.data ? parseData(result.data) : await loadLegacyCloud(authorize);
  checkCurrent();
  return {
    data: workspace,
    revision: result.revision,
    dirty: false,
    // An account without record-based data is seeded once after the safe merge.
    pending: undefined,
  };
}
/** Read-only migration of V1 rows. Never remove the original normalized tables. */
async function loadLegacyCloud(authorize: AuthorizeRead): Promise<AppData> {
  const data = emptyData();
  if (!supabase) return data;
  const [pairs, solves, schemes] = await Promise.all([
    authorize(supabase
      .from("letter_pairs")
      .select(
        "id,first_sticker_id,second_sticker_id,first_token,second_token,primary_mnemonic,updated_at",
      )
      .order("id")),
    authorize(supabase
      .from("bld_solves")
      .select(
        "id,scramble,memo_ms,execution_ms,total_ms,result,corner_memo,edge_memo,cycle_breaks,created_at,scheme_snapshot",
      )
      .order("id")),
    authorize(supabase
      .from("lettering_schemes")
      .select(
        "id,name,orientation,edge_buffer,corner_buffer,edge_method,corner_method,updated_at",
      )
      .eq("is_active", true)
      .maybeSingle()),
  ]);
  for (const result of [pairs, solves, schemes])
    if (result.error)
      throw new Error(`V1 data could not be loaded: ${result.error.message}`);
  // PostgREST defaults to a 1,000-row cap. Never silently truncate a V1 account.
  if (pairs.data?.length === 1000) {
    for (let offset = 1000; ; offset += 1000) {
      const next = await authorize(supabase
        .from("letter_pairs")
        .select(
          "id,first_sticker_id,second_sticker_id,first_token,second_token,primary_mnemonic,updated_at",
        )
        .order("id")
        .range(offset, offset + 999));
      if (next.error) throw new Error(next.error.message);
      pairs.data.push(...next.data);
      if (next.data.length < 1000) break;
    }
  }
  if (solves.data?.length === 1000) {
    for (let offset = 1000; ; offset += 1000) {
      const next = await authorize(supabase
        .from("bld_solves")
        .select(
          "id,scramble,memo_ms,execution_ms,total_ms,result,corner_memo,edge_memo,cycle_breaks,created_at,scheme_snapshot",
        )
        .order("id")
        .range(offset, offset + 999));
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
    const labels = await authorize(supabase
      .from("sticker_labels")
      .select("physical_sticker_id,token")
      .eq("scheme_id", s.id)
      .order("physical_sticker_id"));
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

export function splitSyncBatches(changes: SyncChange[]) {
  const batches: SyncChange[][] = [];
  let batch: SyncChange[] = [],
    bytes = 2;
  const encoder = new TextEncoder();
  for (const change of changes) {
    const size = encoder.encode(JSON.stringify(change)).length + 1;
    if (batch.length && (batch.length >= 500 || bytes + size > 4500000)) {
      batches.push(batch);
      batch = [];
      bytes = 2;
    }
    batch.push(change);
    bytes += size;
  }
  if (batch.length) batches.push(batch);
  return batches;
}

export async function saveCloudChanges(
  changes: SyncChange[],
  revision: number,
  context?: { owner: string; isCurrent: () => boolean },
): Promise<number> {
  if (!supabase) throw new Error("Cloud storage is not configured.");
  if (!changes.length) return revision;
  let currentRevision = revision;
  for (const batch of splitSyncBatches(changes)) {
    if (context && !context.isCurrent())
      throw new Error("Account changed during synchronization.");
    const session = context
      ? (await supabase.auth.getSession()).data.session
      : null;
    if (context && (!context.isCurrent() || session?.user.id !== context.owner))
      throw new Error("Account changed during synchronization.");
    const request = supabase.rpc("apply_bld_sync_changes", {
      changes: batch.map((change) => ({
        kind: change.kind,
        record_id: change.recordId,
        payload:
          change.kind === "pair" && !change.deleted
            ? change.payload &&
              typeof change.payload === "object" &&
              "identity" in change.payload &&
              change.payload.identity === "logical-v1"
              ? logicalMnemonicSchema.parse(change.payload)
              : pairSchema.parse(change.payload)
            : change.payload,
        deleted: change.deleted,
        updated_at: change.updatedAt,
      })),
      expected_revision: currentRevision,
    });
    // The SDK awaits its current token internally. Bind this batch to its checked
    // owner so an auth change during that await cannot retarget queued history.
    if (session)
      request.setHeader("Authorization", `Bearer ${session.access_token}`);
    const { data, error } = await request;
    if (error) {
      if (error.code === "40001") throw new SyncConflictError(error.message);
      throw new Error(error.message);
    }
    currentRevision = data as number;
  }
  return currentRevision;
}

export const syncRetryDelay = (attempt: number) =>
  Math.min(60_000, 2_000 * 2 ** Math.max(0, attempt));
