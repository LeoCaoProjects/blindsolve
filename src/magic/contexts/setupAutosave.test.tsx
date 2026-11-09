import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyData, diffSyncChanges, type AppData } from "../../lib/repository";
import { AppDataProvider, useAppData } from "./AppDataContext";

const store = vi.hoisted(() => ({
  data: {} as AppData,
  user: null,
  sync: "local",
  update: vi.fn(),
}));
vi.mock("../../app/Store", () => ({ useStore: () => store }));
beforeEach(() => {
  store.data = { ...emptyData(), onboarded: true };
  store.update.mockReset().mockImplementation((fn: (d: AppData) => AppData) => {
    store.data = fn(store.data);
    return true;
  });
});
afterEach(cleanup);
describe("atomic setup autosave", () => {
  it("saves setup and view in one store update and emits just one settings change", () => {
    const { result } = renderHook(useAppData, { wrapper: AppDataProvider });
    const before = store.data;
    act(() => {
      result.current.saveSetup(
        { ...result.current.setup, schemeName: "Personal" },
        { top: "white", front: "blue" },
      );
    });
    expect(store.update).toHaveBeenCalledTimes(1);
    expect(store.data.scheme.name).toBe("Personal");
    expect(store.data.defaultCubeView?.front).toBe("blue");
    expect(
      diffSyncChanges(before, store.data).map((change) => change.kind),
    ).toEqual(["settings"]);
  });
  it("preserves scheme identity and timestamps for view-only updates and makes unchanged saves no-ops", () => {
    const { result, rerender } = renderHook(useAppData, {
      wrapper: AppDataProvider,
    });
    const before = store.data;
    act(() => {
      result.current.saveSetup(result.current.setup, {
        top: "white",
        front: "blue",
      });
    });
    expect(store.data.scheme).toBe(before.scheme);
    expect(store.data.schemeUpdatedAt).toBe(before.schemeUpdatedAt);
    rerender();
    const saved = store.data;
    act(() => {
      result.current.saveSetup(result.current.setup, {
        top: "white",
        front: "blue",
      });
    });
    expect(store.data).toBe(saved);
  });
  it("does not rewrite legacy unsupported methods when only the view changes", () => {
    store.data.scheme.edgeMethod = "3style";
    store.data.scheme.cornerMethod = "raw";
    const { result } = renderHook(useAppData, { wrapper: AppDataProvider });
    const scheme = store.data.scheme;
    act(() => {
      result.current.saveSetup(result.current.setup, {
        top: "white",
        front: "orange",
      });
    });
    expect(store.data.scheme).toBe(scheme);
  });
});
