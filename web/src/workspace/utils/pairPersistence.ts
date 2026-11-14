import type { AppData } from "../../data/model";
import type { LetterPair } from "../../domain/letterPairs";
import { normalizeLabel, validLabel } from "../../domain/letterPairs";
import {
  logicalEntries,
  writeLogicalEntries,
} from "../../domain/letterPairs/logical";
import type { PairDb, PairEntry } from "../types/app";
import { primaryWords, pairKey, splitKey } from "./pairs";

function recordsByPair(data: AppData) {
  const grouped: Record<string, { edges?: LetterPair; corners?: LetterPair }> =
    {};
  for (const record of Object.values(data.pairs)) {
    const first = normalizeLabel(record.firstToken),
      second = normalizeLabel(record.secondToken);
    if (!validLabel(first) || !validLabel(second)) continue;
    const key = pairKey(first, second);
    const type = data.scheme.stickers[record.firstStickerId]?.pieceType;
    const secondType = data.scheme.stickers[record.secondStickerId]?.pieceType;
    if (!type || type !== secondType) continue; // Unknown scope is retained, never guessed.
    const scope = type === "edge" ? "edges" : "corners";
    const group = (grouped[key] ??= {});
    if (
      !group[scope] ||
      Date.parse(record.updatedAt) > Date.parse(group[scope]!.updatedAt)
    )
      group[scope] = record;
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
function legacyEntries(data: AppData): PairDb {
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
export function pairsFromStore(data: AppData): PairDb {
  return logicalEntries(legacyEntries(data), data);
}

/** New writes have only logical identity. Original physical records are immutable fallback data. */
export function writePairEntries(
  data: AppData,
  edits: Record<string, PairEntry | null>,
  timestamp = new Date().toISOString(),
): AppData {
  return writeLogicalEntries(data, legacyEntries(data), edits, timestamp);
}

/** Exact persisted first-token match, including records from older lettering schemes.
 * The existing store diff produces pair tombstones; all other data stays untouched.
 */
export function deleteFirstLetterPairs(
  data: AppData,
  firstToken: string,
): AppData {
  const first = normalizeLabel(firstToken);
  const edits = Object.fromEntries(
    Object.keys(pairsFromStore(data))
      .filter((key) => splitKey(key)[0] === first)
      .map((key) => [key, null]),
  );
  return writePairEntries(data, edits);
}

export function replacePairEntries(
  data: AppData,
  db: PairDb,
  timestamp?: string,
) {
  // Clearing is logical too; legacy source rows stay preserved behind tombstones.
  const edits = Object.fromEntries(
    [
      ...new Set([...Object.keys(pairsFromStore(data)), ...Object.keys(db)]),
    ].map((key) => [key, db[key] ?? null]),
  );
  return writePairEntries(data, edits, timestamp);
}

/** Ordinary solving/practice edits Default only. Explicit overrides are preserved. */
export function writeDefaultWords(
  data: AppData,
  words: Record<string, string>,
  timestamp?: string,
): AppData {
  const pairs = pairsFromStore(data);
  return writePairEntries(
    data,
    Object.fromEntries(
      Object.entries(words).map(([key, word]) => [
        key,
        { ...(pairs[key] ?? { shared: [] }), shared: primaryWords([word]) },
      ]),
    ),
    timestamp,
  );
}
