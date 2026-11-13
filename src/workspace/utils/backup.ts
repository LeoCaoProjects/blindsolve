import type { AppData } from "../../lib/repository";
import { applyTombstones, assertBackupHistoryCompatible, mergeData } from "../../lib/repository";
import { readPortableSnapshot, type RecoverySnapshot } from "../../lib/portableRecovery";

export type MergeStrategy = "keep-mine" | "prefer-backup" | "replace";
export type ImportSummary =
  | {
      ok: true;
      fileName: string;
      exportedAt: string;
      lettering: string;
      buffers: string;
      pairs: { total: number; added: number; conflicts: number };
      solves: number;
      practice: number;
      file: RecoverySnapshot;
    }
  | { ok: false; fileName: string; problems: string[] };

export function buildBackup(data: AppData) {
  return { version: 3, exportedAt: new Date().toISOString(), data };
}

export function downloadJson(data: unknown, fileName: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function summarize(
  fileName: string,
  raw: unknown,
  current: AppData,
): ImportSummary {
  try {
    const snapshot = readPortableSnapshot(raw);
    const incoming = snapshot.data;
    const rawObject = raw as { exportedAt?: string };
    let added = 0,
      conflicts = 0;
    Object.entries(incoming.pairs).forEach(([key, pair]) => {
      const mine = current.pairs[key];
      if (!mine) added += 1;
      else if (
        mine.primaryMnemonic.trim().toLocaleLowerCase() !==
        pair.primaryMnemonic.trim().toLocaleLowerCase()
      )
        conflicts += 1;
    });
    return {
      ok: true,
      fileName,
      exportedAt: typeof rawObject.exportedAt === "string" ? rawObject.exportedAt : snapshot.exportedAt,
      lettering: incoming.scheme.name || "Custom",
      buffers: `${incoming.scheme.edgeBuffer} · ${incoming.scheme.cornerBuffer}`,
      pairs: { total: Object.keys(incoming.pairs).length, added, conflicts },
      solves: incoming.solves.filter((solve) => !solve.deleted).length,
      practice: incoming.attempts.length,
      file: snapshot,
    };
  } catch (error) {
    return {
      ok: false,
      fileName,
      problems: [(error as Error).message || "not a valid BlindSolve backup"],
    };
  }
}

/** File tombstones belong only to a newly restored namespace. */
export function mergeBackup(
  current: AppData,
  incoming: AppData,
  strategy: MergeStrategy,
  known: Record<string, string> = {},
) {
  assertBackupHistoryCompatible(current, incoming);
  const candidates = applyTombstones({
    ...incoming,
    logicalPairDeletions: undefined,
    logicalPairs: incoming.logicalPairs && Object.fromEntries(
      Object.entries(incoming.logicalPairs).filter(([key]) => !known[`pair:${key}`]),
    ),
  }, known);
  if (strategy === "replace")
    throw new Error("To replace the view with this snapshot, restore it as a separate local workspace.");
  for (const kind of ["solves", "attempts"] as const) {
    const existing = new Set(current[kind].map(({ id }) => id));
    if (candidates[kind].some(({ id }) => !existing.has(id)))
      throw new Error("This file adds history with unknown deletion status. Restore it as a separate local workspace to review it.");
  }
  return strategy === "prefer-backup"
    ? mergeData(candidates, current).data
    : mergeData(current, candidates).data;
}
