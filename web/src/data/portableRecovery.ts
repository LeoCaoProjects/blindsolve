import { z } from "zod";
import { parseMnemonicRecordKey } from "../domain/letterPairs/identity";
import { applyTombstones, deletionIndex, type LocalEnvelope } from "./repository";
import { parseBackup } from "./backup";
import { setSelectedRecovery } from "./recoverySelection";

const uuid = z.string().uuid();
const stamp = z.string().datetime({ offset: true });
const markerStamp = z.string().refine((value) => Number.isFinite(Date.parse(value)));
const markers = z.record(z.string().max(512), markerStamp).superRefine((entries, context) => {
  for (const key of Object.keys(entries)) {
    const colon = key.indexOf(":");
    const kind = key.slice(0, colon);
    const id = key.slice(colon + 1);
    const valid = kind === "pair"
      ? !!parseMnemonicRecordKey(id)
      : (kind === "solve" || kind === "attempt") && uuid.safeParse(id).success;
    if (!valid) context.addIssue({ code: "custom", path: [key], message: "Unsupported deletion identity" });
  }
});
const snapshotHeader = z.object({
  version: z.literal(4),
  exportedAt: stamp,
  history: z.enum(["known-markers", "legacy-incomplete"]),
  tombstones: markers,
  data: z.unknown(),
}).strict();

const supportedMarkers = (envelope: LocalEnvelope) =>
  Object.fromEntries(Object.entries(deletionIndex(envelope)).filter(([key]) =>
    !key.startsWith("pair:") || !!parseMnemonicRecordKey(key.slice(5)),
  ));

export function portableSnapshot(envelope: LocalEnvelope, legacyIncomplete = false) {
  const tombstones = markers.parse(supportedMarkers(envelope));
  return {
    version: 4 as const,
    exportedAt: new Date().toISOString(),
    history: legacyIncomplete ? "legacy-incomplete" as const : "known-markers" as const,
    tombstones,
    data: applyTombstones(envelope.data, deletionIndex(envelope)),
  };
}

export function readPortableSnapshot(raw: unknown) {
  if (typeof raw === "object" && raw !== null && "version" in raw && raw.version === 4) {
    const header = snapshotHeader.parse(raw);
    const data = parseBackup(JSON.stringify(header.data));
    const tombstones = markers.parse(supportedMarkers({
      data, tombstones: header.tombstones, dirty: false, revision: 0,
    }));
    return { ...header, data: applyTombstones(data, tombstones), tombstones };
  }
  const data = parseBackup(JSON.stringify(raw));
  return {
    version: "legacy" as const,
    exportedAt: new Date(0).toISOString(),
    history: "legacy-incomplete" as const,
    tombstones: markers.parse(supportedMarkers({ data, dirty: false, revision: 0 })),
    data,
  };
}

export type RecoverySnapshot = ReturnType<typeof readPortableSnapshot>;
const prefix = "blindsolve-recovered-v1:";
export const recoveredKey = (id: string) => prefix + uuid.parse(id);
const workspaceMetadata = z.object({
  id: uuid,
  restoredAt: stamp,
  sourceVersion: z.union([z.literal(4), z.literal("legacy")]),
  legacyIncomplete: z.boolean(),
});
type WorkspaceMetadata = z.infer<typeof workspaceMetadata>;
export type RecoveredWorkspace = { metadata: WorkspaceMetadata; envelope: LocalEnvelope };

export function loadRecovered(id: string): RecoveredWorkspace {
  const raw = localStorage.getItem(recoveredKey(id));
  if (raw === null) throw new Error("The selected local workspace is unavailable.");
  const value = JSON.parse(raw);
  const metadata = workspaceMetadata.parse(value.metadata);
  if (metadata.id !== id) throw new Error("Recovered workspace identity does not match.");
  const tombstones = markers.parse(value.tombstones);
  const data = applyTombstones(parseBackup(JSON.stringify(value.data)), tombstones);
  return { metadata, envelope: { data, tombstones, dirty: false, revision: 0 } };
}

export function saveRecovered(metadata: WorkspaceMetadata, envelope: LocalEnvelope) {
  const tombstones = markers.parse(supportedMarkers(envelope));
  const data = parseBackup(JSON.stringify(envelope.data));
  localStorage.setItem(recoveredKey(metadata.id), JSON.stringify({
    metadata,
    data: applyTombstones(data, tombstones),
    tombstones,
  }));
}

export async function createRecovered(snapshot: RecoverySnapshot) {
  if (!navigator.locks || !crypto.randomUUID)
    throw new Error("This browser does not support isolated local recovery.");
  const id = crypto.randomUUID();
  const metadata: WorkspaceMetadata = {
    id, restoredAt: new Date().toISOString(), sourceVersion: snapshot.version,
    legacyIncomplete: snapshot.history === "legacy-incomplete",
  };
  const data = applyTombstones(snapshot.data, snapshot.tombstones);
  await navigator.locks.request(recoveredKey(id), { ifAvailable: true }, (lock) => {
    if (!lock || localStorage.getItem(recoveredKey(id)) !== null)
      throw new Error("The workspace identity is already in use. Try again.");
    saveRecovered(metadata, { data, tombstones: snapshot.tombstones, dirty: false, revision: 0 });
  });
  return id;
}

export function listRecovered() {
  const workspaces: WorkspaceMetadata[] = [];
  for (let index = 0; index < localStorage.length; index++) {
    const key = localStorage.key(index);
    if (!key?.startsWith(prefix)) continue;
    try {
      const raw = localStorage.getItem(key);
      const metadata = workspaceMetadata.parse(JSON.parse(raw ?? "null")?.metadata);
      if (key === recoveredKey(metadata.id)) workspaces.push(metadata);
    } catch {
      // Preserve unreadable entries. They cannot be published as openable workspaces.
    }
  }
  return workspaces.sort((a, b) => b.restoredAt.localeCompare(a.restoredAt));
}

export function selectRecovery(id: string | null) {
  if (id) loadRecovered(id);
  setSelectedRecovery(id);
  window.location.reload();
}
