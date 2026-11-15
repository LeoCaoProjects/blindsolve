import { parseData, type AppData } from "./model";

const backupHistoryKinds = ["solves", "attempts"] as const;

function backupRecordContent(record: unknown) {
  return JSON.stringify(record, (_key, value) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, value[key]]))
      : value,
  );
}

function backupHistoryIndex(records: readonly unknown[], kind: "solves" | "attempts") {
  const index = new Map<string, unknown>();
  for (const record of records) {
    if (!record || typeof record !== "object" || !("id" in record) || typeof record.id !== "string")
      continue;
    const previous = index.get(record.id);
    if (previous && backupRecordContent(previous) !== backupRecordContent(record))
      throw new Error(
        `The backup contains conflicting ${kind === "solves" ? "solve" : "attempt"} records for ID ${record.id}. Keep the original file and use a backup with one record for this ID.`,
      );
    index.set(record.id, record);
  }
  return index;
}

export function assertBackupHistoryCompatible(current: AppData, incoming: AppData) {
  for (const kind of backupHistoryKinds) {
    const existing = backupHistoryIndex(current[kind], kind);
    for (const [id, record] of backupHistoryIndex(incoming[kind], kind)) {
      const previous = existing.get(id);
      if (previous && backupRecordContent(previous) !== backupRecordContent(record))
        throw new Error(
          `The backup conflicts with the workspace ${kind === "solves" ? "solve" : "attempt"} for ID ${id}. Keep the original file and use a backup with the same record for this ID.`,
        );
    }
  }
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
  const data =
    typeof parsed === "object" && parsed !== null && "data" in parsed
      ? parsed.data
      : parsed;
  const validated = parseData(data);
  // Compare source rows before schema projection can hide differing fields.
  const source = data as Record<string, unknown>;
  for (const kind of backupHistoryKinds) {
    if (Array.isArray(source[kind])) backupHistoryIndex(source[kind], kind);
  }
  return {
    ...validated,
    solves: [...new Map(validated.solves.map((solve) => [solve.id, solve])).values()],
    attempts: [...new Map(validated.attempts.map((attempt) => [attempt.id, attempt])).values()],
  };
}
