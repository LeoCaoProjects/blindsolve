import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultSetup } from "../contexts/AppDataContext";
import { settingsDraftKey } from "../utils/settingsDraft";
import { useSettingsAutosave } from "./useSettingsAutosave";

const state = vi.hoisted(() => ({ app: {} as any, store: {} as any }));
vi.mock("../../app/Store", () => ({ useStore: () => state.store }));
vi.mock("../contexts/AppDataContext", async (original) => ({
  ...(await original<typeof import("../contexts/AppDataContext")>()),
  useAppData: () => state.app,
}));
beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  state.store = {
    ready: true,
    user: null,
    sync: "local",
    storageIssue: "",
    notify: vi.fn(),
    retryStorage: vi.fn(),
  };
  state.app = {
    setup: defaultSetup(),
    prefs: { defaultView: { top: "white", front: "green" } },
    setNavGuard: vi.fn(),
  };
  state.app.saveSetup = vi.fn((setup, view) => {
    state.app.setup = setup;
    state.app.prefs.defaultView = view;
    return true;
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
const tick = (ms = 5000) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

describe("recoverable Settings autosave", () => {
  it("does not duplicate the global storage warning or keep attempting to apply a blocked draft", () => {
    state.store.storageIssue = "Saved data could not be read";
    const { result, rerender } = renderHook(useSettingsAutosave);
    act(() =>
      result.current.setDraft((d) => ({ ...d, schemeName: "Recover me" })),
    );
    tick(15000);
    expect(result.current.status).toBe("");
    expect(result.current.needsRetry).toBe(false);
    expect(state.app.saveSetup).not.toHaveBeenCalled();
    expect(localStorage.getItem(settingsDraftKey("guest"))).not.toBeNull();
    state.store.storageIssue = "";
    rerender();
    tick();
    expect(state.app.saveSetup).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("");
  });
  it("keeps typing locally, batches a complete edit and does not resave a settled value", () => {
    const { result, rerender } = renderHook(useSettingsAutosave);
    act(() => result.current.setDraft((d) => ({ ...d, schemeName: "C" })));
    tick(3000);
    act(() => result.current.setDraft((d) => ({ ...d, schemeName: "Custom" })));
    expect(
      JSON.parse(localStorage.getItem(settingsDraftKey("guest"))!).setup
        .schemeName,
    ).toBe("Custom");
    tick(4999);
    expect(state.app.saveSetup).not.toHaveBeenCalled();
    tick(1);
    expect(state.app.saveSetup).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe("");
    expect(localStorage.getItem(settingsDraftKey("guest"))).toBeNull();
    rerender();
    tick(20000);
    expect(state.app.saveSetup).toHaveBeenCalledTimes(1);
  });

  it("recovers incomplete drafts across unmount/reload and never applies empty or duplicate tokens", () => {
    const first = renderHook(useSettingsAutosave);
    const ids = Object.keys(first.result.current.draft.scheme);
    const a = ids[0],
      b = ids[1];
    const previousLetter = first.result.current.draft.scheme[a];
    act(() =>
      first.result.current.setDraft((d) => ({
        ...d,
        scheme: { ...d.scheme, [a]: "" },
      })),
    );
    tick(20000);
    first.unmount();
    expect(state.app.saveSetup).not.toHaveBeenCalled();
    const second = renderHook(useSettingsAutosave);
    expect(second.result.current.draft.scheme[a]).toBe(previousLetter);
    act(() =>
      second.result.current.setDraft((d) => ({
        ...d,
        scheme: { ...d.scheme, [a]: d.scheme[b] },
      })),
    );
    tick(10000);
    expect(second.result.current.status).toBe("");
    expect(state.app.saveSetup).not.toHaveBeenCalled();
    act(() =>
      second.result.current.setDraft((d) => ({
        ...d,
        scheme: { ...d.scheme, [a]: "CH" },
      })),
    );
    tick();
    expect(state.app.saveSetup).toHaveBeenCalledTimes(1);
  });

  it("applies a complete edit when navigating without requesting confirmation", () => {
    const { result } = renderHook(useSettingsAutosave);
    act(() => result.current.setDraft((d) => ({ ...d, schemeName: "Ready" })));
    const guard = state.app.setNavGuard.mock.calls.at(-1)[0];
    let allowed: boolean | undefined;
    act(() => {
      allowed = guard("/training");
    });
    expect(allowed).toBe(true);
    expect(state.app.saveSetup).toHaveBeenCalledTimes(1);
    expect(state.app.setup.schemeName).toBe("Ready");
  });

  it("does not cross account boundaries when an idle save is pending", () => {
    const { result, rerender } = renderHook(useSettingsAutosave);
    act(() =>
      result.current.setDraft((d) => ({ ...d, schemeName: "Guest draft" })),
    );
    state.store.user = { id: "another-account" };
    state.app.setup = { ...defaultSetup(), schemeName: "Account lettering" };
    rerender();
    tick(10000);
    expect(state.app.saveSetup).not.toHaveBeenCalled();
    expect(result.current.draft.schemeName).toBe("Account lettering");
    expect(
      JSON.parse(localStorage.getItem(settingsDraftKey("guest"))!).setup
        .schemeName,
    ).toBe("Guest draft");
    expect(
      localStorage.getItem(settingsDraftKey("another-account")),
    ).toBeNull();
  });

  it("retains a draft and requires an explicit choice after another device changes the setup", () => {
    const { result, rerender } = renderHook(useSettingsAutosave);
    act(() =>
      result.current.setDraft((d) => ({ ...d, schemeName: "My draft" })),
    );
    state.app.setup = { ...defaultSetup(), schemeName: "Remote change" };
    rerender();
    tick(10000);
    expect(result.current.conflict).toBe(true);
    expect(state.app.saveSetup).not.toHaveBeenCalled();
    act(() => result.current.useSaved());
    expect(result.current.draft.schemeName).toBe("Remote change");
    expect(localStorage.getItem(settingsDraftKey("guest"))).toBeNull();
  });

  it("blocks leaving only when the local draft cannot be stored, then retries safely", () => {
    const { result } = renderHook(useSettingsAutosave);
    const write = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("quota");
      });
    act(() =>
      result.current.setDraft((d) => ({
        ...d,
        scheme: { ...d.scheme, U0: "" },
      })),
    );
    const guard = state.app.setNavGuard.mock.calls.at(-1)[0];
    expect(guard("/training")).toBe(false);
    tick(10000);
    expect(state.app.saveSetup).not.toHaveBeenCalled();
    write.mockRestore();
    act(() => result.current.retry());
    expect(result.current.needsRetry).toBe(false);
    expect(state.app.setNavGuard.mock.calls.at(-1)[0]("/training")).toBe(true);
    expect(state.app.saveSetup).not.toHaveBeenCalled();
    expect(localStorage.getItem(settingsDraftKey("guest"))).not.toBeNull();
  });

  it("preserves drafts if applying them fails and keeps successful offline saves silent", () => {
    const { result } = renderHook(useSettingsAutosave);
    state.app.saveSetup.mockReturnValueOnce(false);
    act(() =>
      result.current.setDraft((d) => ({ ...d, schemeName: "Offline" })),
    );
    tick();
    expect(result.current.needsRetry).toBe(true);
    expect(localStorage.getItem(settingsDraftKey("guest"))).not.toBeNull();
    state.store.sync = "offline";
    act(() => result.current.retry());
    expect(result.current.status).toBe("");
    expect(localStorage.getItem(settingsDraftKey("guest"))).toBeNull();
  });

  it("preserves unreadable recovery data rather than silently overwriting it", () => {
    localStorage.setItem(settingsDraftKey("guest"), "broken json");
    const { result } = renderHook(useSettingsAutosave);
    act(() => result.current.setDraft((d) => ({ ...d, schemeName: "Oops" })));
    tick(10000);
    expect(result.current.ready).toBe(false);
    expect(localStorage.getItem(settingsDraftKey("guest"))).toBe("broken json");
    expect(state.app.saveSetup).not.toHaveBeenCalled();
  });
});
