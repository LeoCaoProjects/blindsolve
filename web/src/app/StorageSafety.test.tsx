import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "@supabase/supabase-js";
const cloud = vi.hoisted(() => ({
  callback: undefined as
    undefined | ((event: string, session: Session | null) => void),
  load: vi.fn(),
  save: vi.fn(),
}));
vi.mock("../lib/supabase", () => ({
  supabase: {
    auth: {
      onAuthStateChange: (callback: typeof cloud.callback) => {
        cloud.callback = callback;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
    },
  },
}));
vi.mock("../data/repository", async (original) => ({
  ...(await original<object>()),
  loadCloud: cloud.load,
  saveCloudChanges: cloud.save,
}));
import { StoreProvider, useStore } from "./Store";
import { StorageWarning } from "./StorageWarning";
import { mergeBackup } from "../workspace/utils/backup";
import { deletionIndex, loadLocal, saveLocal } from "../data/repository";
import { emptyData, type SolveRecord } from "../data/model";

const solve = (): SolveRecord => ({
  id: crypto.randomUUID(),
  scramble: "R U",
  memoMs: 1000,
  executionMs: 2000,
  totalMs: 3000,
  result: "success",
  edgeMemo: [],
  cornerMemo: [],
  cycleBreaks: { edges: [], corners: [] },
  createdAt: new Date().toISOString(),
  schemeSnapshot: emptyData().scheme,
});
function Harness() {
  const store = useStore();
  return (
    <>
      <StorageWarning />
      <output data-testid="status">
        {store.ready ? "ready" : "loading"}|{store.user?.id ?? "guest"}|
        {store.sync}|{store.data.solves.length}|{store.data.attempts.length}
      </output>
      <button
        onClick={() =>
          store.update((data) => ({
            ...data,
            solves: [...data.solves, solve()],
          }))
        }
      >
        Timer
      </button>
      <button
        onClick={() =>
          store.update((data) => ({
            ...data,
            attempts: [
              ...data.attempts,
              {
                id: crypto.randomUUID(),
                kind: "memo",
                trainingMode: "exec",
                correct: true,
                durationMs: 1234,
                createdAt: new Date().toISOString(),
              },
            ],
          }))
        }
      >
        Training
      </button>
      <button
        onClick={() => store.update((current) => mergeBackup(current, {
          ...emptyData(), showLiveTimer: false, preferencesUpdatedAt: new Date().toISOString(),
        }, "keep-mine", deletionIndex(store.recoveryEnvelope())))}
      >
        Import
      </button>
      <p>{store.message}</p>
    </>
  );
}
const mount = () =>
  render(
    <StoreProvider>
      <Harness />
    </StoreProvider>,
  );
async function auth(owner: string | null) {
  await act(async () => {
    cloud.callback?.(
      "SIGNED_IN",
      owner ? ({ user: { id: owner } } as Session) : null,
    );
    await new Promise((resolve) => setTimeout(resolve, 5));
  });
}
function failWrites(name = "QuotaExceededError") {
  return vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("Controlled storage failure", name);
  });
}
beforeEach(() => {
  localStorage.clear();
  cloud.load.mockReset().mockResolvedValue({
    data: emptyData(),
    revision: 0,
    dirty: false,
    pending: {},
  });
  cloud.save.mockReset().mockResolvedValue(1);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("local persistence failures", () => {
  it("opens workspaces with unfinished archived lettering without a storage warning or a reset", async () => {
    const data = emptyData();
    data.onboarded = true;
    data.solves = [solve()];
    const archive = structuredClone(data.scheme);
    archive.stickers["U:UB"].label = "";
    data.schemeHistory = [
      { scheme: archive, updatedAt: new Date(0).toISOString() },
    ];
    saveLocal(null, { data, revision: 0, dirty: false });
    mount();
    await auth(null);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByTestId("status")).toHaveTextContent(
      "ready|guest|local|1|0",
    );
    fireEvent.click(screen.getByText("Training", { exact: true }));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(loadLocal().data.solves).toHaveLength(1);
    expect(
      loadLocal().data.schemeHistory?.[0].scheme.stickers["U:UB"].label,
    ).toBe("");
  });
  for (const action of ["Timer", "Training", "Import"]) {
    it(`keeps previous bytes and retains unsaved ${action} work until recovery`, async () => {
      saveLocal(null, {
        data: { ...emptyData(), onboarded: true, solves: [solve()] },
        revision: 0,
        dirty: false,
      });
      const before = localStorage.getItem("cubeiq-bld-v2:guest");
      mount();
      await auth(null);
      const writes = failWrites();
      fireEvent.click(screen.getByText(action, { exact: true }));
      expect(localStorage.getItem("cubeiq-bld-v2:guest")).toBe(before);
      expect(screen.getByRole("alert")).toHaveTextContent("only in this tab");
      expect(screen.getByTestId("status")).toHaveTextContent("|error|");
      expect(screen.queryByText(/Backup merged/)).toBeNull();
      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
      fireEvent.click(screen.getByText("Retry saving"));
      expect(screen.getAllByRole("alert")).toHaveLength(1);
      writes.mockRestore();
      fireEvent.click(screen.getByText("Retry saving"));
      expect(screen.queryByRole("alert")).toBeNull();
      expect(loadLocal().data.solves).toHaveLength(
        action === "Timer" ? 2 : 1,
      );
      expect(loadLocal().data.attempts).toHaveLength(
        action === "Training" ? 1 : 0,
      );
      if (action === "Import") expect(loadLocal().data.showLiveTimer).toBe(false);
      const recovered = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(recovered);
      expect(recovered.defaultPrevented).toBe(false);
    });
  }

  it("does not send an undurable outbox and isolates volatile account data", async () => {
    mount();
    await auth("alice");
    const original = localStorage.getItem("cubeiq-bld-v2:alice");
    const writes = failWrites();
    fireEvent.click(screen.getByText("Training", { exact: true }));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 850));
    });
    expect(cloud.save).not.toHaveBeenCalled();
    expect(localStorage.getItem("cubeiq-bld-v2:alice")).toBe(original);
    await auth("bob");
    expect(screen.getByTestId("status")).toHaveTextContent("bob|error|0|0");
    await auth("alice");
    expect(screen.getByTestId("status")).toHaveTextContent("alice|error|0|1");
    writes.mockRestore();
    fireEvent.click(screen.getByText("Retry saving"));
    expect(
      Object.values(loadLocal("alice").pending ?? {}).some(
        (change) => change.kind === "attempt",
      ),
    ).toBe(true);
    await waitFor(() => expect(cloud.save).toHaveBeenCalledTimes(1));
    // Bob's hydration metadata also failed to persist; recovering Alice must
    // not dismiss the warning for a different owner.
    expect(screen.getByRole("alert")).toHaveTextContent("Another account");
    await auth("bob");
    expect(screen.queryByRole("alert")).toBeNull();
    await auth("alice");
    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("alice|saved|0|1"),
    );
    expect(loadLocal("alice").dirty).toBe(false);
    expect(loadLocal("bob").data.attempts).toHaveLength(0);
  });

  it("does not report saved if acknowledgement persistence fails", async () => {
    let acknowledge!: (revision: number) => void;
    cloud.save.mockImplementation(
      () =>
        new Promise((resolve) => {
          acknowledge = resolve;
        }),
    );
    mount();
    await auth("alice");
    fireEvent.click(screen.getByText("Timer", { exact: true }));
    await waitFor(() => expect(cloud.save).toHaveBeenCalledTimes(1));
    const before = localStorage.getItem("cubeiq-bld-v2:alice");
    const writes = failWrites();
    await act(async () => acknowledge(1));
    expect(localStorage.getItem("cubeiq-bld-v2:alice")).toBe(before);
    expect(loadLocal("alice").dirty).toBe(true);
    expect(screen.getByTestId("status")).toHaveTextContent("alice|error|1|0");
    writes.mockRestore();
    fireEvent.click(screen.getByText("Retry saving"));
    expect(loadLocal("alice").dirty).toBe(false);
    expect(screen.getByTestId("status")).toHaveTextContent("alice|saved|1|0");
  });

  it("resumes a blocked outbox on storage retry without an account transition", async () => {
    mount();
    await auth("alice");
    const writes = failWrites("SecurityError");
    fireEvent.click(screen.getByText("Training", { exact: true }));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 850));
    });
    expect(cloud.save).not.toHaveBeenCalled();
    writes.mockRestore();
    fireEvent.click(screen.getByText("Retry saving"));
    await waitFor(() => expect(cloud.save).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("alice|saved|0|1"),
    );
    expect(loadLocal("alice").dirty).toBe(false);
  });

  it("recovers from unavailable reads without overwriting previous data", async () => {
    const original = emptyData();
    original.scheme.name = "My lettering";
    original.defaultCubeView = { top: "white", front: "orange" };
    saveLocal(null, {
      data: { ...original, solves: [solve()] },
      revision: 0,
      dirty: false,
    });
    const reads = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new DOMException("Blocked", "SecurityError");
      });
    mount();
    await auth(null);
    fireEvent.click(screen.getByText("Training", { exact: true }));
    reads.mockRestore();
    fireEvent.click(screen.getByText("Retry saving"));
    expect(loadLocal().data.solves).toHaveLength(1);
    expect(loadLocal().data.attempts).toHaveLength(1);
    expect(loadLocal().data.scheme.name).toBe("My lettering");
    expect(loadLocal().data.defaultCubeView).toEqual({ top: "white", front: "orange" });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("never replaces unreadable original JSON, even after retry or account switch", async () => {
    localStorage.setItem("cubeiq-bld-v2:guest", "{broken");
    mount();
    await auth(null);
    fireEvent.click(screen.getByText("Training", { exact: true }));
    fireEvent.click(screen.getByText("Retry saving"));
    await auth("alice");
    await auth(null);
    fireEvent.click(screen.getByText("Timer", { exact: true }));
    expect(localStorage.getItem("cubeiq-bld-v2:guest")).toBe("{broken");
    expect(screen.getByRole("alert")).toBeVisible();
  });
});
