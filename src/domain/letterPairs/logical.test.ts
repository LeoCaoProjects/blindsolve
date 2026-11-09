import { describe, expect, it } from "vitest";
import {
  logicalEntries,
  mergeLogicalState,
  writeLogicalEntries,
  logicalDeletionOverlay,
  type LogicalPairState,
} from "./logical";
import { mnemonicRecordKey } from "./identity";
const stamp = (n: number) =>
  `2026-11-09T00:00:${String(n).padStart(2, "0")}.000Z`;
describe("additive logical vocabulary", () => {
  it("preserves the legacy source while independent label changes acquire independent words", () => {
    const legacy = {
      "T|B": { shared: ["Tub"], edges: ["Timber"], corners: ["Tower"] },
    };
    const original = JSON.stringify(legacy);
    let data: LogicalPairState = {};
    for (const [index, label] of ["SH", "Z", "T"].entries())
      data = writeLogicalEntries(
        data,
        legacy,
        { [`${label}|B`]: label === "T" ? legacy["T|B"] : { shared: [label] } },
        stamp(index),
      );
    expect(JSON.stringify(legacy)).toBe(original);
    const words = logicalEntries(legacy, data);
    expect(words["T|B"]).toEqual(legacy["T|B"]);
    expect(words["SH|B"].shared).toEqual(["SH"]);
    expect(words["Z|B"].shared).toEqual(["Z"]);
  });
  it("does not conflate S+HB with SH+B or Default with overrides", () => {
    const data = writeLogicalEntries(
      {},
      {},
      {
        "S|HB": { shared: ["One"] },
        "SH|B": { shared: ["Two"], edges: ["Edge"], corners: ["Corner"] },
      },
      stamp(1),
    );
    expect(Object.keys(data.logicalPairs!)).toHaveLength(4);
    expect(logicalEntries({}, data)["SH|B"]).toEqual({
      shared: ["Two"],
      edges: ["Edge"],
      corners: ["Corner"],
    });
    expect(mnemonicRecordKey("S", "HB", "shared")).not.toBe(
      mnemonicRecordKey("SH", "B", "shared"),
    );
  });
  it("keeps logical deletes authoritative over stale legacy copies without deleting the copies", () => {
    const legacy = { "T|B": { shared: ["Tub"], corners: ["Tower"] } };
    const deleted = writeLogicalEntries({}, legacy, { "T|B": null }, stamp(2));
    expect(logicalEntries(legacy, deleted)["T|B"]).toBeUndefined();
    expect(legacy["T|B"].shared).toEqual(["Tub"]);
    const snapshot = logicalDeletionOverlay(
      {},
      Object.fromEntries(
        Object.entries(deleted.logicalPairDeletions!).map(([k, v]) => [
          `pair:${k}`,
          v,
        ]),
      ),
    );
    expect(logicalEntries(legacy, snapshot)["T|B"]).toBeUndefined();
    const recreated = writeLogicalEntries(
      snapshot,
      legacy,
      { "T|B": { shared: ["New"] } },
      stamp(3),
    );
    expect(logicalEntries(legacy, recreated)["T|B"]).toEqual({
      shared: ["New"],
    });
  });
  it("keeps Default and override updates on separate devices independent", () => {
    const a = writeLogicalEntries(
      {},
      {},
      { "T|B": { shared: ["Tub"] } },
      stamp(1),
    );
    const b = writeLogicalEntries(
      {},
      {},
      {
        "T|B": { shared: [], edges: ["Timber"] },
        "SH|B": { shared: ["Ship"] },
      },
      stamp(2),
    );
    expect(logicalEntries({}, mergeLogicalState(a, b))["T|B"]).toEqual({
      shared: ["Tub"],
      edges: ["Timber"],
    });
    expect(logicalEntries({}, mergeLogicalState(a, b))["SH|B"].shared).toEqual([
      "Ship",
    ]);
  });
  it("normalizes case and whitespace and creates nothing for empty or merely visible pairs", () => {
    const data = writeLogicalEntries(
      {},
      {},
      { " t | b ": { shared: ["Tub"] } },
      stamp(1),
    );
    expect(logicalEntries({}, data)["T|B"].shared).toEqual(["Tub"]);
    expect(writeLogicalEntries({}, {}, {}, stamp(1))).toEqual({});
    expect(logicalEntries({}, {})).toEqual({});
  });
});
