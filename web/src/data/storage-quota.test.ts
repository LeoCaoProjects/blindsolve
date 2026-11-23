import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { emptyData, type SolveRecord } from "./model";
import { loadLocal, reconcileSync, saveLocal } from "./repository";
import { readEnvelopeJson, writeEnvelopeJson } from "./localEnvelopeStorage";
import { portableSnapshot, readPortableSnapshot } from "./portableRecovery";

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

it("durably saves a legacy migration whose seeded outbox exceeds the storage quota", () => {
  const data = emptyData();
  const solve: SolveRecord = {
    id: crypto.randomUUID(),
    scramble: "R U F",
    memoMs: 1000,
    executionMs: 2000,
    totalMs: 3000,
    result: "success",
    edgeMemo: [],
    cornerMemo: [],
    cycleBreaks: { edges: [], corners: [] },
    createdAt: new Date(0).toISOString(),
    schemeSnapshot: data.scheme,
  };
  // jsdom enforces a real 5,000,000-code-unit localStorage quota.
  const count = Math.ceil(2_600_000 / JSON.stringify(solve).length);
  data.solves = Array.from({ length: count }, () => ({
    ...solve,
    id: crypto.randomUUID(),
  }));
  const legacy = { data, revision: 0, dirty: false };
  saveLocal("alice", legacy);
  const original = localStorage.getItem("cubeiq-bld-v2:alice");
  const migrated = reconcileSync(legacy, legacy);
  expect(JSON.stringify(migrated).length).toBeGreaterThan(5_000_000);
  expect(() => saveLocal("alice", migrated)).not.toThrow();
  const restored = loadLocal("alice");
  expect(restored.data.solves).toEqual(data.solves);
  expect(restored.pending).toEqual(migrated.pending);
  expect(restored.dirty).toBe(true);
  expect(localStorage.getItem("cubeiq-bld-v2:alice")!.length).toBeLessThan(
    original!.length,
  );
  expect(readPortableSnapshot(portableSnapshot(restored)).data.solves).toEqual(
    data.solves,
  );
  expect(original).not.toBeNull();
}, 15_000);

it("keeps compression on later writes and preserves exact envelope contents", () => {
  const set = Storage.prototype.setItem;
  const write = vi
    .spyOn(Storage.prototype, "setItem")
    .mockImplementation(function (this: Storage, key, value) {
      if (value.length > 10_000)
        throw new DOMException("Full", "QuotaExceededError");
      set.call(this, key, value);
    });
  const value = {
    data: { notes: "🧩 café 漢字 ".repeat(4000) },
    pending: { unusual: "must survive" },
    tombstones: { deleted: "stamp" },
    revision: 17,
  };
  writeEnvelopeJson("test", value);
  expect(readEnvelopeJson(localStorage.getItem("test")!)).toEqual(value);
  write.mockClear();
  writeEnvelopeJson("test", { ...value, revision: 18 });
  expect(write).toHaveBeenCalledTimes(1);
  expect(readEnvelopeJson(localStorage.getItem("test")!)).toEqual({
    ...value,
    revision: 18,
  });
});

it.each(["QuotaExceededError", "SecurityError"])(
  "preserves disk when both formats cannot be saved (%s)",
  (name) => {
    const original = { data: emptyData(), dirty: false, revision: 2 };
    saveLocal("alice", original);
    const bytes = localStorage.getItem("cubeiq-bld-v2:alice");
    const writes = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("Controlled failure", name);
      });
    expect(() => saveLocal("alice", { ...original, revision: 3 })).toThrow();
    expect(localStorage.getItem("cubeiq-bld-v2:alice")).toBe(bytes);
    expect(writes).toHaveBeenCalledTimes(name === "QuotaExceededError" ? 2 : 1);
  },
);

it("rejects damaged or unknown encodings without overwriting their source", () => {
  for (const value of [
    { storageEncoding: "future", contents: "anything", length: 10 },
    { storageEncoding: "lz-utf16-v1", contents: "", length: 10 },
  ]) {
    const raw = JSON.stringify(value);
    localStorage.setItem("cubeiq-bld-v2:alice", raw);
    expect(() => loadLocal("alice")).toThrow();
    expect(localStorage.getItem("cubeiq-bld-v2:alice")).toBe(raw);
  }
});
