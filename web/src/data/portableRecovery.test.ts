import { expect, it } from "vitest";
import { mnemonicRecordKey } from "../domain/letterPairs/identity";
import { mergeBackup } from "../workspace/utils/backup";
import { portableSnapshot, readPortableSnapshot } from "./portableRecovery";
import { emptyData, type AppData } from "./model";
import { type LocalEnvelope } from "./repository";

const id = "4c8b15b6-937d-4820-b214-439ac7bba673";
const stamp = "2026-11-08T00:00:00Z";
const key = mnemonicRecordKey("S", "HB", "shared");
const data: AppData = {
  ...emptyData(),
  attempts: [{ id, kind: "memo", correct: true, createdAt: stamp }],
  solves: [{
    id, createdAt: stamp, scramble: "R U", memoMs: 100, executionMs: 200,
    totalMs: 300, result: "success", edgeMemo: [], cornerMemo: [],
    cycleBreaks: { edges: [], corners: [] },
  }],
  logicalPairs: {
    [key]: {
      id, identity: "logical-v1", scope: "shared", firstToken: "S",
      secondToken: "HB", primaryMnemonic: "Original", updatedAt: stamp,
    },
  },
};

it("exports owner-envelope and pending deletions without queue or account metadata", () => {
  const envelope: LocalEnvelope = {
    data, dirty: true, revision: 88, tombstones: { [`attempt:${id}`]: stamp },
    pending: {
      solve: { kind: "solve", recordId: id, payload: null, deleted: true, updatedAt: stamp },
      pair: { kind: "pair", recordId: key, payload: null, deleted: true, updatedAt: stamp },
    },
  };
  const snapshot = portableSnapshot(envelope);
  expect(Object.keys(snapshot).sort()).toEqual(["data", "exportedAt", "history", "tombstones", "version"]);
  expect(snapshot.tombstones).toEqual({
    [`attempt:${id}`]: stamp, [`solve:${id}`]: stamp, [`pair:${key}`]: stamp,
  });
  const restored = readPortableSnapshot(JSON.parse(JSON.stringify(snapshot)));
  expect(restored.data.attempts).toEqual([]);
  expect(restored.data.solves).toEqual([]);
  expect(restored.data.logicalPairs).toEqual({});
  const stale = readPortableSnapshot({ version: 3, data });
  const merged = mergeBackup(restored.data, stale.data, "keep-mine", restored.tombstones);
  expect(merged.attempts).toEqual([]);
  expect(merged.solves).toEqual([]);
  expect(merged.logicalPairs).toEqual({});
  expect(() => mergeBackup(restored.data, stale.data, "replace", restored.tombstones)).toThrow("separate local workspace");
});

it("keeps foreign markers out of merges, including legacy logical deletions", () => {
  const foreign = readPortableSnapshot({
    version: 3, data: { ...emptyData(), logicalPairDeletions: { [key]: stamp } },
  });
  const current = mergeBackup(data, foreign.data, "prefer-backup", {});
  expect(current.logicalPairs?.[key].primaryMnemonic).toBe("Original");
  expect(current.logicalPairDeletions).toBeUndefined();
  expect(current.attempts).toEqual(data.attempts);
  expect(current.solves).toEqual(data.solves);
});

it.each(["attempt:bad-id", "settings:workspace", 'pair:["mnemonic-v1","S","HB","invalid"]'])(
  "rejects malformed or unsupported marker %s",
  (key) => {
    const snapshot = portableSnapshot({ data, dirty: false, revision: 0 });
    expect(() => readPortableSnapshot({ ...snapshot, tombstones: { [key]: stamp } })).toThrow();
  },
);

it("rejects malformed marker values and untrusted envelope metadata", () => {
  const snapshot = portableSnapshot({ data, dirty: false, revision: 0 });
  expect(() => readPortableSnapshot({ ...snapshot, tombstones: { [`attempt:${id}`]: "invalid" } })).toThrow();
  expect(() => readPortableSnapshot({ ...snapshot, owner: "claimed owner" })).toThrow();
});
