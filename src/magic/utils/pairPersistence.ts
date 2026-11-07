import type { AppData } from "../../lib/repository";
import type { LetterPair } from "../../domain/letterPairs";
import { pairKey as physicalPairKey } from "../../domain/letterPairs";
import type { PairDb, PairEntry } from "../types/app";
import { primaryWords, pairKey, splitKey } from "./pairs";

function recordsByPair(data: AppData) {
  const grouped: Record<string, { edges?: LetterPair; corners?: LetterPair }> =
    {};
  for (const record of Object.values(data.pairs)) {
    const key = pairKey(record.firstToken, record.secondToken);
    const scope =
      data.scheme.stickers[record.firstStickerId]?.pieceType === "edge"
        ? "edges"
        : "corners";
    (grouped[key] ??= {})[scope] = record;
  }
  return grouped;
}
const effective = (record?: LetterPair) =>
  record ? primaryWords([record.primaryMnemonic]) : undefined;
const latestShared = (records: Array<LetterPair | undefined>) =>
  records
    .flatMap((record) => (record?.vocabulary ? [record.vocabulary] : []))
    .sort(
      (a, b) => Date.parse(b.sharedUpdatedAt) - Date.parse(a.sharedUpdatedAt),
    )[0];

/** Hydration is read-only. Legacy values retain their existing interpretation;
 * their original Shared/override intent cannot be recovered from effective words.
 */
export function pairsFromStore(data: AppData): PairDb {
  return Object.fromEntries(
    Object.entries(recordsByPair(data)).map(([key, records]) => {
      const shared = latestShared([records.edges, records.corners]);
      if (shared) {
        const entry: PairEntry = { shared: primaryWords(shared.shared) };
        for (const scope of ["edges", "corners"] as const) {
          const record = records[scope];
          if (record?.vocabulary?.override?.length)
            entry[scope] = primaryWords(record.vocabulary.override);
          // Mixed-version records still carry a usable effective value.
          else if (record && !record.vocabulary)
            entry[scope] = effective(record);
        }
        return [key, entry];
      }
      const edge = effective(records.edges),
        corner = effective(records.corners);
      if (edge && corner && JSON.stringify(edge) === JSON.stringify(corner))
        return [key, { shared: edge }];
      if (edge && corner) return [key, { shared: edge, corners: corner }];
      if ((data.pairSharing ?? "shared") === "shared" && (edge || corner))
        return [key, { shared: edge ?? corner! }];
      return [
        key,
        {
          shared: [],
          ...(edge ? { edges: edge } : {}),
          ...(corner ? { corners: corner } : {}),
        },
      ];
    }),
  );
}
function clean(entry: PairEntry | null | undefined): PairEntry | null {
  if (!entry) return null;
  const next: PairEntry = { shared: primaryWords(entry.shared) };
  for (const scope of ["edges", "corners"] as const) {
    const words = primaryWords(entry[scope] ?? []);
    if (words.length) next[scope] = words;
  }
  return next.shared.length || next.edges?.length || next.corners?.length
    ? next
    : null;
}

/** Update only explicitly edited pairs. Scope identity travels in the existing
 * pair payload; physical keys, UUIDs, ownership and sync transport stay intact.
 */
export function writePairEntries(
  data: AppData,
  edits: Record<string, PairEntry | null>,
  timestamp = new Date().toISOString(),
): AppData {
  const decoded = pairsFromStore(data),
    grouped = recordsByPair(data);
  const next = { ...data.pairs };
  let changed = false;
  for (const [key, value] of Object.entries(edits)) {
    const entry = clean(value),
      before = clean(decoded[key]);
    if (JSON.stringify(before) === JSON.stringify(entry)) continue;
    const [first, second] = splitKey(key),
      records = grouped[key] ?? {};
    const previousShared = latestShared([records.edges, records.corners]);
    const sharedChanged =
      JSON.stringify(before?.shared ?? []) !==
      JSON.stringify(entry?.shared ?? []);
    const sharedUpdatedAt =
      sharedChanged || !previousShared
        ? timestamp
        : previousShared.sharedUpdatedAt;
    for (const [type, scope] of [
      ["edge", "edges"],
      ["corner", "corners"],
    ] as const) {
      const a = Object.values(data.scheme.stickers).find(
        (s) => s.pieceType === type && s.label === first,
      );
      const b = Object.values(data.scheme.stickers).find(
        (s) => s.pieceType === type && s.label === second,
      );
      if (!a || !b) continue;
      const id = physicalPairKey(a.id, b.id),
        old = next[id];
      const words = entry?.[scope] ?? entry?.shared ?? [];
      if (!entry || !words.length) {
        if (old) {
          delete next[id];
          changed = true;
        }
        continue;
      }
      const overrideChanged =
        JSON.stringify(before?.[scope] ?? []) !==
        JSON.stringify(entry[scope] ?? []);
      const overrideUpdatedAt =
        overrideChanged || !old?.vocabulary
          ? timestamp
          : old.vocabulary.overrideUpdatedAt;
      const vocabulary: NonNullable<LetterPair["vocabulary"]> = {
        shared: entry.shared,
        sharedUpdatedAt,
        overrideUpdatedAt,
        ...(entry[scope] ? { override: entry[scope] } : {}),
      };
      if (
        old &&
        JSON.stringify(old.vocabulary) === JSON.stringify(vocabulary) &&
        old.primaryMnemonic === words[0]
      )
        continue;
      next[id] = {
        id: old?.id ?? crypto.randomUUID(),
        firstStickerId: a.id,
        secondStickerId: b.id,
        firstToken: first,
        secondToken: second,
        primaryMnemonic: words[0],
        encounters: old?.encounters ?? 0,
        forgotten: old?.forgotten ?? 0,
        updatedAt: timestamp,
        vocabulary,
      };
      changed = true;
    }
  }
  return changed
    ? {
        ...data,
        pairs: next,
        pairSharing: "separate",
        preferencesUpdatedAt:
          data.pairSharing === "separate"
            ? data.preferencesUpdatedAt
            : timestamp,
      }
    : data;
}

export function replacePairEntries(
  data: AppData,
  db: PairDb,
  timestamp?: string,
) {
  // Clearing the database includes records from previous lettering schemes.
  // Store diffing will enqueue pair deletions without touching other records.
  if (!Object.keys(db).length)
    return Object.keys(data.pairs).length ? { ...data, pairs: {} } : data;
  const edits = Object.fromEntries(
    [
      ...new Set([...Object.keys(pairsFromStore(data)), ...Object.keys(db)]),
    ].map((key) => [key, db[key] ?? null]),
  );
  return writePairEntries(data, edits, timestamp);
}
