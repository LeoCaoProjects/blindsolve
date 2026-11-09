import {
  mnemonicRecordKey,
  MNEMONIC_SCOPES,
  normalizeLabel,
  parseMnemonicRecordKey,
  validLabel,
  type LogicalMnemonic,
  type MnemonicScope,
} from "./identity";

export interface LogicalPairState {
  logicalPairs?: Record<string, LogicalMnemonic>;
  /** Explicit logical deletions; mirrored through the existing pair RPC tombstones. */
  logicalPairDeletions?: Record<string, string>;
}
type Entry = { shared: string[]; edges?: string[]; corners?: string[] };
type Entries = Record<string, Entry>;
const words = (values: string[] | undefined) =>
  values?.[0]?.trim() ? [values[0].trim()] : [];
const uiKey = (first: string, second: string) =>
  `${normalizeLabel(first)}|${normalizeLabel(second)}`;

/** This overlay never mutates or removes the original legacy records. */
export function logicalEntries(
  legacy: Entries,
  state: LogicalPairState,
): Entries {
  const result: Entries = Object.fromEntries(
    Object.entries(legacy).map(([key, entry]) => [
      key,
      { ...entry, shared: [...entry.shared] },
    ]),
  );
  const keys = new Set([
    ...Object.keys(state.logicalPairs ?? {}),
    ...Object.keys(state.logicalPairDeletions ?? {}),
  ]);
  for (const key of keys) {
    const labels = parseMnemonicRecordKey(key);
    if (!labels) continue;
    const [first, second, scope] = labels,
      pair = uiKey(first, second);
    const entry = result[pair] ?? { shared: [] };
    const record = state.logicalPairs?.[key],
      deleted = state.logicalPairDeletions?.[key];
    const value =
      record && (!deleted || Date.parse(record.updatedAt) > Date.parse(deleted))
        ? words([record.primaryMnemonic])
        : [];
    if (scope === "shared") entry.shared = value;
    else if (value.length) entry[scope] = value;
    else delete entry[scope];
    result[pair] = entry;
  }
  return Object.fromEntries(
    Object.entries(result).filter(
      ([, entry]) =>
        entry.shared.length || entry.edges?.length || entry.corners?.length,
    ),
  );
}

/** New values are sparse and scoped; absent legacy labels never use current sticker labels. */
export function writeLogicalEntries<T extends LogicalPairState>(
  state: T,
  legacy: Entries,
  edits: Record<string, Entry | null>,
  timestamp: string,
): T & LogicalPairState {
  const current = logicalEntries(legacy, state);
  const records = { ...state.logicalPairs },
    deletions = { ...state.logicalPairDeletions };
  let changed = false;
  for (const [input, requested] of Object.entries(edits)) {
    const labels = input.split("|").map(normalizeLabel);
    if (labels.length !== 2 || !labels.every(validLabel)) continue;
    const [first, second] = labels,
      before = current[uiKey(first, second)];
    if (!before && !requested) continue;
    for (const scope of MNEMONIC_SCOPES) {
      const next = words(requested?.[scope]),
        previous = words(before?.[scope]);
      if (requested && JSON.stringify(next) === JSON.stringify(previous))
        continue;
      const key = mnemonicRecordKey(first, second, scope);
      if (next.length) {
        records[key] = {
          id: records[key]?.id ?? crypto.randomUUID(),
          identity: "logical-v1",
          scope,
          firstToken: first,
          secondToken: second,
          primaryMnemonic: next[0],
          updatedAt: timestamp,
        };
        delete deletions[key];
      } else {
        delete records[key];
        deletions[key] = timestamp;
      }
      changed = true;
    }
  }
  return changed
    ? { ...state, logicalPairs: records, logicalPairDeletions: deletions }
    : state;
}

/** Scope-level last-write-wins; separate logical pairs can never share a record key. */
export function mergeLogicalState(
  local: LogicalPairState,
  incoming: LogicalPairState,
): LogicalPairState {
  const records = { ...local.logicalPairs };
  const deletions = { ...local.logicalPairDeletions };
  for (const [key, value] of Object.entries(incoming.logicalPairs ?? {}))
    if (
      !records[key] ||
      Date.parse(value.updatedAt) > Date.parse(records[key].updatedAt)
    )
      records[key] = value;
  for (const [key, stamp] of Object.entries(
    incoming.logicalPairDeletions ?? {},
  ))
    if (!deletions[key] || Date.parse(stamp) > Date.parse(deletions[key]))
      deletions[key] = stamp;
  for (const [key, stamp] of Object.entries(deletions)) {
    if (records[key] && Date.parse(records[key].updatedAt) > Date.parse(stamp))
      delete deletions[key];
    else delete records[key];
  }
  return {
    ...(local.logicalPairs || incoming.logicalPairs
      ? { logicalPairs: records }
      : {}),
    ...(local.logicalPairDeletions || incoming.logicalPairDeletions
      ? { logicalPairDeletions: deletions }
      : {}),
  };
}

export function logicalDeletionOverlay(
  state: LogicalPairState,
  tombstones: Record<string, string>,
): LogicalPairState {
  const deletes: Record<string, string> = {};
  for (const [key, stamp] of Object.entries(tombstones))
    if (key.startsWith("pair:") && parseMnemonicRecordKey(key.slice(5)))
      deletes[key.slice(5)] = stamp;
  return mergeLogicalState(
    state,
    Object.keys(deletes).length ? { logicalPairDeletions: deletes } : {},
  );
}
