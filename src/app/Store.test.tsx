import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "@supabase/supabase-js";
const mocks = vi.hoisted(() => ({
  callback: undefined as
    undefined | ((event: string, session: Session | null) => void),
  load: vi.fn(),
  save: vi.fn(),
  legacyReview: vi.fn(),
}));
vi.mock("../lib/supabase", () => ({
  supabase: {
    auth: {
      onAuthStateChange: (cb: typeof mocks.callback) => {
        mocks.callback = cb;
        return {
          data: { listener: null, subscription: { unsubscribe: vi.fn() } },
        };
      },
    },
  },
}));
vi.mock("../lib/repository", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  loadCloud: mocks.load,
  saveCloudChanges: mocks.save,
  loadLegacyRecovery: mocks.legacyReview,
}));
import { StoreProvider, useStore } from "./Store";
import { writeDefaultWords } from "../workspace/utils/pairPersistence";
import { loadRecovered, portableSnapshot, readPortableSnapshot, saveRecovered } from "../lib/portableRecovery";
import {
  emptyData,
  loadLocal,
  saveLocal,
  parseData,
  SyncConflictError,
  syncSnapshotEnvelope,
  type SolveRecord,
} from "../lib/repository";
function Harness() {
  const s = useStore();
  return (
    <>
      <span data-testid="state">
        {s.ready ? "ready" : "loading"}|{s.user?.id ?? "guest"}|
        {s.data.scheme.name}|{s.sync}|{s.lastAttemptAt ?? "never"}
      </span>
      <button
        onClick={() =>
          s.update((d) => ({
            ...d,
            scheme: { ...d.scheme, name: "Edited" },
            schemeUpdatedAt: new Date().toISOString(),
          }))
        }
      >
        Edit
      </button>
      <button onClick={s.retry}>Retry</button>
      <button onClick={() => s.update((data) => ({ ...data }))}>
        No-op edit
      </button>
      <span data-testid="solve-count">
        {s.data.solves.filter((solve) => !solve.deleted).length}
      </span>
      <button
        onClick={() =>
          s.update((data) => ({
            ...data,
            solves: data.solves.map((solve) => ({
              ...solve,
              deleted: true,
              updatedAt: new Date().toISOString(),
            })),
          }))
        }
      >
        Delete solves
      </button>
      <button onClick={() => s.resolveGuestMigration("merge")}>
        Merge guest
      </button>
      <button onClick={() => s.resolveGuestMigration("account")}>
        Use account
      </button>
      <span data-testid="migration">
        {s.guestMigration ? "choose" : "none"}
      </span>
      <span data-testid="multiphase">{String(s.data.multiphaseTiming)}</span>
      <span data-testid="show-live">{String(s.data.showLiveTimer)}</span>
      <button
        onClick={() =>
          s.update((d) => ({
            ...d,
            multiphaseTiming: !d.multiphaseTiming,
            preferencesUpdatedAt: new Date().toISOString(),
          }))
        }
      >
        Toggle multiphase
      </button>
      <button
        onClick={() =>
          s.update((d) => ({
            ...d,
            showLiveTimer: !d.showLiveTimer,
            preferencesUpdatedAt: new Date().toISOString(),
          }))
        }
      >
        Toggle live timer
      </button>
      <p>{s.message}</p>
    </>
  );
}
async function auth(id: string | null, event = "SIGNED_IN") {
  await act(async () => {
    mocks.callback?.(event, id ? ({ user: { id } } as Session) : null);
    await new Promise((r) => setTimeout(r, 5));
  });
}
describe("account state and sync", () => {
  it("reviews V1 rows without changing canonical, guest, backup or outbox state", async () => {
    const id = "58d441ea-30db-4d02-84e1-f001b69aab1a";
    const tombstones = { [`attempt:${id}`]: "2026-09-25T00:00:00Z" };
    mocks.load.mockResolvedValue({
      data: emptyData(), revision: 8, dirty: false, pending: {}, tombstones,
    });
    let store!: ReturnType<typeof useStore>;
    function Capture() {
      store = useStore();
      return null;
    }
    render(<StoreProvider><Capture /></StoreProvider>);
    await auth("alice");
    await waitFor(() => expect(store.ready).toBe(true));
    const bytes = localStorage.getItem("cubeiq-bld-v2:alice");
    const guest = localStorage.getItem("cubeiq-bld-v2:guest");
    const review = { tables: [{ table: "practice_attempts", rows: [{ source: { id: "9" } }] }] };
    mocks.legacyReview.mockResolvedValueOnce(review);
    expect(await store.readLegacyRecovery("alice")).toBe(review);
    expect(mocks.legacyReview).toHaveBeenLastCalledWith({ owner: "alice", isCurrent: expect.any(Function) });
    expect(store.recoveryEnvelope().pending).toEqual({});
    expect(portableSnapshot(store.durableRecovery().envelope)).toMatchObject({
      data: { attempts: [] }, tombstones,
    });
    expect(localStorage.getItem("cubeiq-bld-v2:alice")).toBe(bytes);
    expect(localStorage.getItem("cubeiq-bld-v2:guest")).toBe(guest);
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("exports the active account envelope and opens its snapshot without account callbacks", async () => {
    const id = "8d00ae21-5444-41df-a008-d7bfcdf2f741";
    const stamp = "2026-11-05T01:00:00.000Z";
    const marker = { [`attempt:${id}`]: stamp };
    saveLocal("alice", { data: emptyData(), revision: 1, dirty: false, tombstones: marker });
    saveLocal(null, { data: emptyData(), revision: 0, dirty: false, tombstones: {} });
    let read!: ReturnType<typeof useStore>["durableRecovery"];
    function ExportHarness() {
      const store = useStore();
      read = store.durableRecovery;
      return <span>{store.ready ? "export ready" : "loading"}</span>;
    }
    const account = render(<StoreProvider><ExportHarness /></StoreProvider>);
    await auth("alice");
    await screen.findByText("export ready");
    const snapshot = portableSnapshot(read().envelope);
    expect(snapshot.tombstones).toEqual(marker);
    expect(JSON.stringify(snapshot)).not.toContain("alice");
    account.unmount();

    const restored = readPortableSnapshot(snapshot);
    saveRecovered({
      id, restoredAt: stamp, sourceVersion: 4, legacyIncomplete: false,
    }, { data: restored.data, tombstones: restored.tombstones, dirty: false, revision: 0 });
    const previous = Object.getOwnPropertyDescriptor(navigator, "locks");
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: { request: (_name: string, _options: object, callback: () => Promise<void>) => callback() },
    });
    mocks.callback = undefined;
    mocks.load.mockClear();
    mocks.save.mockClear();
    try {
      const recovery = render(<StoreProvider recoveredId={id}><Harness /></StoreProvider>);
      await waitFor(() => expect(screen.getByTestId("state").textContent).toContain("ready|guest"));
      expect(mocks.callback).toBeUndefined();
      fireEvent.click(screen.getByText("Toggle live timer"));
      expect(loadRecovered(id).envelope.data.showLiveTimer).toBe(false);
      expect(loadRecovered(id).envelope.tombstones).toEqual(marker);
      expect(loadLocal("alice").data.showLiveTimer).toBe(true);
      expect(mocks.load).not.toHaveBeenCalled();
      expect(mocks.save).not.toHaveBeenCalled();
      recovery.unmount();
    } finally {
      if (previous) Object.defineProperty(navigator, "locks", previous);
      else Reflect.deleteProperty(navigator, "locks");
    }
  });

  it("preserves old soft-deletion evidence when an edit happens during hydration", async () => {
    const id = "8d00ae21-5444-41df-a008-d7bfcdf2f741";
    const stamp = "2026-11-05T01:00:00.000Z";
    const solve: SolveRecord = {
      id,
      scramble: "R U",
      memoMs: 1000,
      executionMs: 2000,
      totalMs: 3000,
      result: "success",
      edgeMemo: [],
      cornerMemo: [],
      cycleBreaks: { edges: [], corners: [] },
      createdAt: stamp,
    };
    saveLocal("alice", {
      data: {
        ...emptyData(),
        solves: [{ ...solve, deleted: true, updatedAt: stamp }],
      },
      revision: 1,
      dirty: false,
      pending: {},
    });
    let finish!: (value: ReturnType<typeof syncSnapshotEnvelope>) => void;
    mocks.load.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    render(
      <StoreProvider>
        <Harness />
      </StoreProvider>,
    );
    await auth("alice");
    fireEvent.click(screen.getByText("Edit"));
    expect(loadLocal("alice").tombstones?.["solve:" + id]).toBe(stamp);
    await act(async () =>
      finish(
        syncSnapshotEnvelope(
          [
            {
              kind: "solve",
              record_id: id,
              payload: solve,
              deleted: false,
              updated_at: stamp,
            },
          ],
          1,
        ),
      ),
    );
    await waitFor(() =>
      expect(screen.getByTestId("state").textContent).toContain("ready|alice"),
    );
    expect(screen.getByTestId("solve-count").textContent).toBe("0");
    expect(loadLocal("alice").tombstones?.["solve:" + id]).toBe(stamp);
  });

  it("stays synced after unchanged renders and no-op edits", async () => {
    mocks.load.mockResolvedValue({
      data: emptyData(),
      revision: 0,
      dirty: false,
      pending: {},
    });
    const view = render(
      <StoreProvider>
        <Harness />
      </StoreProvider>,
    );
    await auth("alice");
    await waitFor(() =>
      expect(screen.getByTestId("state").textContent).toContain("|saved|"),
    );
    fireEvent.click(screen.getByText("No-op edit"));
    view.rerender(
      <StoreProvider>
        <Harness />
      </StoreProvider>,
    );
    await auth("alice", "TOKEN_REFRESHED");
    expect(screen.getByTestId("state").textContent).toContain("|saved|");
    expect(mocks.load).toHaveBeenCalledTimes(1);
    expect(mocks.save).not.toHaveBeenCalled();
  });
  for (const offline of [false, true])
    it(`keeps a ${offline ? "temporarily offline" : "signed-in"} deletion through reload, retry and account switching`, async () => {
      const id = "8d00ae21-5444-41df-a008-d7bfcdf2f741";
      const stamp = "2026-11-05T01:00:00.000Z";
      const solve: SolveRecord = {
        id,
        scramble: "R U",
        memoMs: 1000,
        executionMs: 2000,
        totalMs: 3000,
        result: "success",
        edgeMemo: [],
        cornerMemo: [],
        cycleBreaks: { edges: [], corners: [] },
        createdAt: stamp,
      };
      const remote = syncSnapshotEnvelope(
        [
          {
            kind: "solve",
            record_id: id,
            payload: solve,
            deleted: false,
            updated_at: stamp,
          },
        ],
        1,
      );
      mocks.load.mockResolvedValue(remote);
      const view = render(
        <StoreProvider>
          <Harness />
        </StoreProvider>,
      );
      await auth("alice");
      await waitFor(() =>
        expect(screen.getByTestId("solve-count").textContent).toBe("1"),
      );
      if (offline) fireEvent(window, new Event("offline"));
      fireEvent.click(screen.getByText("Delete solves"));
      expect(screen.getByTestId("solve-count").textContent).toBe("0");
      if (offline) {
        fireEvent.click(screen.getByText("Retry"));
        expect(screen.getByTestId("solve-count").textContent).toBe("0");
        fireEvent(window, new Event("online"));
      }
      await waitFor(() => expect(mocks.save).toHaveBeenCalled(), {
        timeout: 3000,
      });
      expect(mocks.save.mock.calls.at(-1)![0]).toContainEqual(
        expect.objectContaining({ recordId: id, deleted: true, payload: null }),
      );
      const deleted = syncSnapshotEnvelope(
        [
          {
            kind: "solve",
            record_id: id,
            payload: null,
            deleted: true,
            updated_at: stamp,
          },
        ],
        2,
      );
      mocks.load.mockResolvedValue(deleted);
      view.unmount();
      render(
        <StoreProvider>
          <Harness />
        </StoreProvider>,
      );
      await auth("alice");
      await waitFor(() =>
        expect(screen.getByTestId("state").textContent).toContain(
          "ready|alice",
        ),
      );
      expect(screen.getByTestId("solve-count").textContent).toBe("0");
      fireEvent.click(screen.getByText("Retry"));
      await waitFor(() =>
        expect(screen.getByTestId("state").textContent).toContain("|saved|"),
      );
      expect(loadLocal("alice").pending).toEqual({});
      mocks.load.mockResolvedValue({
        data: emptyData(),
        revision: 0,
        dirty: false,
        pending: {},
      });
      await auth("bob");
      expect(screen.getByTestId("solve-count").textContent).toBe("0");
      mocks.load.mockResolvedValue(deleted);
      await auth("alice");
      expect(screen.getByTestId("solve-count").textContent).toBe("0");
    });

  it("flushes edits made while an earlier save is in flight", async () => {
    let finish: ((revision: number) => void) | undefined;
    mocks.save.mockImplementationOnce(
      () =>
        new Promise<number>((resolve) => {
          finish = resolve;
        }),
    );
    render(
      <StoreProvider>
        <Harness />
      </StoreProvider>,
    );
    await auth("alice");
    fireEvent.click(screen.getByText("Edit"));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByText("Edit"));
    await act(async () => {
      finish!(1);
    });
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.getByTestId("state").textContent).toContain("|saved"),
    );
    expect(loadLocal("alice").dirty).toBe(false);
  });
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
    });
    mocks.load.mockReset().mockResolvedValue({
      data: emptyData(),
      revision: 0,
      dirty: false,
      pending: {},
    });
    mocks.save.mockReset().mockResolvedValue(1);
  });
  afterEach(cleanup);
  it("restores session, ignores token refresh and isolates sign out/account switch", async () => {
    render(
      <StoreProvider>
        <Harness />
      </StoreProvider>,
    );
    await auth("alice", "INITIAL_SESSION");
    await waitFor(() =>
      expect(screen.getByTestId("state").textContent).toContain("ready|alice"),
    );
    fireEvent.click(screen.getByText("Edit"));
    expect(loadLocal("alice").data.scheme.name).toBe("Edited");
    await auth("alice", "TOKEN_REFRESHED");
    expect(mocks.load).toHaveBeenCalledTimes(1);
    await auth("bob");
    await waitFor(() =>
      expect(screen.getByTestId("state").textContent).toContain(
        "ready|bob|Speffz",
      ),
    );
    await auth(null, "SIGNED_OUT");
    expect(screen.getByTestId("state").textContent).toContain(
      "ready|guest|Speffz|local",
    );
    expect(loadLocal("alice").data.scheme.name).toBe("Edited");
  });
  it("copies meaningful guest data into a new empty account once and retains the guest source", async () => {
    render(
      <StoreProvider>
        <Harness />
      </StoreProvider>,
    );
    await auth(null, "INITIAL_SESSION");
    fireEvent.click(screen.getByText("Edit"));
    expect(loadLocal(null).data.scheme.name).toBe("Edited");

    await auth("alice");
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1), {
      timeout: 2500,
    });
    await waitFor(() => expect(loadLocal("alice").dirty).toBe(false));
    expect(loadLocal("alice").data.scheme.name).toBe("Edited");
    expect(loadLocal(null).data.scheme.name).toBe("Edited");

    const syncedAccount = loadLocal("alice").data;
    mocks.load.mockResolvedValue({
      data: syncedAccount,
      revision: 1,
      dirty: false,
      pending: {},
    });
    await auth(null, "SIGNED_OUT");
    await auth("alice");
    await act(async () => new Promise((resolve) => setTimeout(resolve, 900)));
    expect(mocks.save).toHaveBeenCalledTimes(1);
  });
  it("requires an explicit choice before merging guest data into an existing account", async () => {
    const cloud = emptyData();
    cloud.onboarded = true;
    mocks.load.mockResolvedValue({
      data: cloud,
      revision: 4,
      dirty: false,
      pending: {},
    });
    render(
      <StoreProvider>
        <Harness />
      </StoreProvider>,
    );
    await auth(null, "INITIAL_SESSION");
    fireEvent.click(screen.getByText("Edit"));
    await auth("alice");
    await waitFor(() =>
      expect(screen.getByTestId("migration").textContent).toBe("choose"),
    );
    await act(async () => new Promise((resolve) => setTimeout(resolve, 900)));
    expect(mocks.save).not.toHaveBeenCalled();
    expect(loadLocal(null).data.scheme.name).toBe("Edited");

    fireEvent.click(screen.getByText("Merge guest"));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1), {
      timeout: 2500,
    });
    expect(mocks.save.mock.calls[0][0]).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: "settings" })]),
    );
  });
  it("copies a canonical-only guest workspace while retaining its source", async () => {
    const guest = writeDefaultWords(emptyData(), { "A|B": "Apple" });
    saveLocal(null, { data: guest, revision: 0, dirty: false });
    const source = localStorage.getItem("cubeiq-bld-v2:guest");
    render(<StoreProvider><Harness /></StoreProvider>);
    await auth("alice");
    expect(loadLocal("alice").data.logicalPairs).toEqual(guest.logicalPairs);
    expect(localStorage.getItem("cubeiq-bld-v2:guest")).toBe(source);
  });
  it("requires a choice when an account has only canonical words", async () => {
    const cloud = writeDefaultWords(emptyData(), { "A|B": "Apple" });
    const guest = { ...emptyData(), showLiveTimer: false };
    saveLocal(null, { data: guest, revision: 0, dirty: false });
    mocks.load.mockResolvedValue({ data: cloud, revision: 4, dirty: false, pending: {} });
    render(<StoreProvider><Harness /></StoreProvider>);
    await auth("alice");
    expect(screen.getByTestId("migration").textContent).toBe("choose");
    expect(loadLocal("alice").data.showLiveTimer).toBe(true);
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("retains the guest copy through failed migration and successful retry", async () => {
    mocks.save
      .mockRejectedValueOnce(new Error("Offline"))
      .mockResolvedValueOnce(1);
    render(
      <StoreProvider>
        <Harness />
      </StoreProvider>,
    );
    await auth(null, "INITIAL_SESSION");
    fireEvent.click(screen.getByText("Edit"));
    await auth("alice");
    await waitFor(() => expect(mocks.save).toHaveBeenCalled(), {
      timeout: 2500,
    });
    expect(loadLocal(null).data.scheme.name).toBe("Edited");
    expect(loadLocal("alice").dirty).toBe(true);
    fireEvent.click(screen.getByText("Retry"));
    await waitFor(() => expect(loadLocal("alice").dirty).toBe(false));
    expect(loadLocal(null).data.scheme.name).toBe("Edited");
  });
  it("keeps guest and account workspaces isolated across sign out and sign in", async () => {
    const guest = emptyData();
    guest.onboarded = true;
    guest.multiphaseTiming = false;
    localStorage.setItem(
      "cubeiq-bld-v2:guest",
      JSON.stringify({ data: guest, revision: 0, dirty: false, pending: {} }),
    );
    const cloud = emptyData();
    cloud.onboarded = true;
    cloud.scheme.name = "Account scheme";
    cloud.schemeUpdatedAt = new Date().toISOString();
    mocks.load.mockResolvedValue({
      data: cloud,
      revision: 8,
      dirty: false,
      pending: {},
    });
    render(
      <StoreProvider>
        <Harness />
      </StoreProvider>,
    );
    await auth("alice", "INITIAL_SESSION");
    fireEvent.click(screen.getByText("Use account"));
    await auth(null, "SIGNED_OUT");
    expect(screen.getByTestId("state").textContent).toContain(
      "guest|Speffz|local",
    );
    expect(loadLocal(null).data.multiphaseTiming).toBe(false);
    fireEvent.click(screen.getByText("Toggle multiphase"));
    expect(loadLocal(null).data.multiphaseTiming).toBe(true);
    expect(mocks.save).not.toHaveBeenCalled();
    await auth("alice");
    await waitFor(() =>
      expect(screen.getByTestId("state").textContent).toContain(
        "alice|Account scheme",
      ),
    );
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("does not clear guest history when an unrelated account saves during a pending migration", async () => {
    const guest = emptyData();
    const stamp = "2026-11-05T01:00:00.000Z";
    const recognition = {
      id: crypto.randomUUID(), kind: "memo" as const,
      trainingMode: "recognition" as const, createdAt: stamp,
      durationMs: 1000, targets: 2, correct: true, accuracy: 1,
    };
    guest.attempts = [recognition];
    saveLocal(null, { data: guest, dirty: false, revision: 0 });
    const other = { ...emptyData(), onboarded: true };
    mocks.load.mockResolvedValueOnce({ data: emptyData(), revision: 0, dirty: false, pending: {} })
      .mockResolvedValueOnce({ data: other, revision: 4, dirty: false, pending: {} });
    let finishAlice!: (revision: number) => void;
    mocks.save.mockImplementationOnce(() => new Promise<number>(resolve => { finishAlice = resolve; }))
      .mockResolvedValueOnce(5);
    render(<StoreProvider><Harness /></StoreProvider>);
    await auth("alice", "INITIAL_SESSION");
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1), { timeout: 2500 });
    expect(loadLocal("alice").data.attempts).toEqual([recognition]);
    await auth("bob");
    await waitFor(() => expect(screen.getByTestId("migration").textContent).toBe("choose"));
    fireEvent.click(screen.getByText("Use account"));
    fireEvent.click(screen.getByText("Toggle multiphase"));
    await waitFor(() => expect(loadLocal("bob").revision).toBe(5), { timeout: 2500 });
    await act(async () => finishAlice(1));
    expect(loadLocal("bob").data.attempts).toEqual([]);
    expect(loadLocal("alice").data.attempts).toEqual([recognition]);
    expect(loadLocal().data.attempts).toEqual([recognition]);
  });

  it("does not clear guest edits made in a different tab after migration starts", async () => {
    const guest = { ...emptyData(), onboarded: true };
    saveLocal(null, { data: guest, revision: 0, dirty: false });
    let finish!: (revision: number) => void;
    mocks.save.mockImplementationOnce(() => new Promise<number>(resolve => { finish = resolve; }));
    render(<StoreProvider><Harness /></StoreProvider>);
    await auth("alice", "INITIAL_SESSION");
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1), { timeout: 2500 });
    const newerGuest = { ...guest, scheme: { ...guest.scheme, name: "Guest tab edit" } };
    saveLocal(null, { data: newerGuest, revision: 0, dirty: false });
    await act(async () => finish(1));
    await waitFor(() => expect(loadLocal("alice").revision).toBe(1));
    expect(loadLocal("alice").data.scheme.name).toBe("Speffz");
    expect(loadLocal().data.scheme.name).toBe("Guest tab edit");
  });
  it("retains failed cloud writes locally and retries safely", async () => {
    mocks.save.mockRejectedValueOnce(new Error("Offline"));
    render(
      <StoreProvider>
        <Harness />
      </StoreProvider>,
    );
    await auth("alice");
    fireEvent.click(screen.getByText("Edit"));
    await waitFor(
      () => expect(screen.getByTestId("state").textContent).toContain("|error"),
      { timeout: 3000 },
    );
    expect(loadLocal("alice").dirty).toBe(true);
    expect(loadLocal("alice").data.scheme.name).toBe("Edited");
    fireEvent.click(screen.getByText("Retry"));
    await waitFor(() =>
      expect(screen.getByTestId("state").textContent).toContain("|saved"),
    );
    expect(loadLocal("alice").dirty).toBe(false);
  });
  it("converges after another tab already committed the same pending record", async () => {
    const cloud = emptyData();
    mocks.save.mockImplementationOnce(async (batch) => {
      Object.assign(cloud, batch[0].payload);
      throw new SyncConflictError("stale revision");
    });
    mocks.load
      .mockResolvedValueOnce({
        data: emptyData(),
        revision: 0,
        dirty: false,
        pending: {},
      })
      .mockImplementationOnce(async () => ({
        data: cloud,
        revision: 1,
        dirty: false,
        pending: {},
      }));
    render(
      <StoreProvider>
        <Harness />
      </StoreProvider>,
    );
    await auth("alice");
    fireEvent.click(screen.getByText("Edit"));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1), {
      timeout: 2500,
    });
    await waitFor(() =>
      expect(screen.getByTestId("state").textContent).toContain("|saved"),
    );
    expect(loadLocal("alice").dirty).toBe(false);
    await act(async () => new Promise((resolve) => setTimeout(resolve, 1000)));
    expect(mocks.save).toHaveBeenCalledTimes(1);
  });
  it("does not upload changes before a failed initial download is resolved", async () => {
    mocks.load.mockRejectedValueOnce(new Error("Offline"));
    render(
      <StoreProvider>
        <Harness />
      </StoreProvider>,
    );
    await auth("alice");
    fireEvent.click(screen.getByText("Edit"));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 650));
    });
    expect(mocks.save).not.toHaveBeenCalled();
    expect(loadLocal("alice").data.scheme.name).toBe("Edited");
  });
  it("debounces and deduplicates rapid mutations into one record batch", async () => {
    render(
      <StoreProvider>
        <Harness />
      </StoreProvider>,
    );
    await auth("alice");
    fireEvent.click(screen.getByText("Edit"));
    fireEvent.click(screen.getByText("Edit"));
    fireEvent.click(screen.getByText("Edit"));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1), {
      timeout: 2500,
    });
    expect(mocks.save.mock.calls[0][0]).toEqual([
      expect.objectContaining({ kind: "settings", recordId: "settings" }),
    ]);
  });
  it("opens an already-synced account without creating pending cloud work", async () => {
    const synced = emptyData();
    localStorage.setItem(
      "cubeiq-bld-v2:alice",
      JSON.stringify({ data: synced, revision: 7, dirty: false, pending: {} }),
    );
    mocks.load.mockResolvedValue({
      data: synced,
      revision: 7,
      dirty: false,
      pending: {},
    });
    const view = render(
      <StoreProvider>
        <Harness />
      </StoreProvider>,
    );
    await auth("alice");
    await waitFor(() =>
      expect(screen.getByTestId("state").textContent).toContain("|saved"),
    );
    await act(async () => new Promise((resolve) => setTimeout(resolve, 900)));
    expect(mocks.save).not.toHaveBeenCalled();

    view.unmount();
    render(
      <StoreProvider>
        <Harness />
      </StoreProvider>,
    );
    await auth("alice");
    await waitFor(() =>
      expect(screen.getByTestId("state").textContent).toContain("|saved"),
    );
    await act(async () => new Promise((resolve) => setTimeout(resolve, 900)));
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("hydrates non-default cloud settings without writing defaults back", async () => {
    const cloud = emptyData();
    cloud.onboarded = true;
    cloud.multiphaseTiming = false;
    cloud.showLiveTimer = false;
    cloud.preferencesUpdatedAt = new Date().toISOString();
    mocks.load.mockResolvedValue({
      data: cloud,
      revision: 12,
      dirty: false,
      pending: {},
    });
    render(
      <StoreProvider>
        <Harness />
      </StoreProvider>,
    );
    await auth("alice", "INITIAL_SESSION");
    await waitFor(() =>
      expect(screen.getByTestId("multiphase").textContent).toBe("false"),
    );
    expect(screen.getByTestId("show-live").textContent).toBe("false");
    await act(async () => new Promise((resolve) => setTimeout(resolve, 900)));
    expect(mocks.save).not.toHaveBeenCalled();
    expect(loadLocal("alice").data.multiphaseTiming).toBe(false);
  });
  it("hydrates legacy negative accuracy without a compatibility writeback", async () => {
    const legacy = emptyData();
    legacy.attempts = [
      {
        id: "b6e4ba9f-421f-4962-ba59-b859c75a8855",
        kind: "memo",
        correct: false,
        accuracy: -0.1875,
        trainingMode: "trace",
        durationMs: 4200,
        targets: 16,
        createdAt: "2026-10-09T22:05:36.491Z",
      },
    ];
    mocks.load.mockResolvedValue({
      data: parseData(legacy),
      revision: 21,
      dirty: false,
      pending: {},
    });
    render(
      <StoreProvider>
        <Harness />
      </StoreProvider>,
    );
    await auth("alice", "INITIAL_SESSION");
    await waitFor(() =>
      expect(screen.getByTestId("state").textContent).toContain("|saved"),
    );
    expect(loadLocal("alice").data.attempts[0].accuracy).toBe(0);
    await act(async () => new Promise((resolve) => setTimeout(resolve, 900)));
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("syncs one live-timer preference mutation as one settings write", async () => {
    render(
      <StoreProvider>
        <Harness />
      </StoreProvider>,
    );
    await auth("alice");
    fireEvent.click(screen.getByText("Toggle live timer"));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1), {
      timeout: 2500,
    });
    expect(mocks.save.mock.calls[0][0]).toEqual([
      expect.objectContaining({
        kind: "settings",
        payload: expect.objectContaining({ showLiveTimer: false }),
      }),
    ]);
  });
  it("keeps the live-timer preference in the guest workspace without syncing", async () => {
    render(
      <StoreProvider>
        <Harness />
      </StoreProvider>,
    );
    await auth(null, "INITIAL_SESSION");
    fireEvent.click(screen.getByText("Toggle live timer"));
    expect(loadLocal(null).data.showLiveTimer).toBe(false);
    await act(async () => new Promise((resolve) => setTimeout(resolve, 900)));
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("turns one multiphase toggle into exactly one settings write", async () => {
    render(
      <StoreProvider>
        <Harness />
      </StoreProvider>,
    );
    await auth("alice");
    fireEvent.click(screen.getByText("Toggle multiphase"));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1), {
      timeout: 2500,
    });
    expect(mocks.save.mock.calls[0][0]).toEqual([
      expect.objectContaining({ kind: "settings", recordId: "settings" }),
    ]);
    await act(async () => new Promise((resolve) => setTimeout(resolve, 900)));
    expect(mocks.save).toHaveBeenCalledTimes(1);
  });
  it("keeps offline edits local and resumes once when connectivity returns", async () => {
    render(
      <StoreProvider>
        <Harness />
      </StoreProvider>,
    );
    await auth("alice");
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
    });
    act(() => window.dispatchEvent(new Event("offline")));
    fireEvent.click(screen.getByText("Edit"));
    await act(async () => new Promise((resolve) => setTimeout(resolve, 900)));
    expect(mocks.save).not.toHaveBeenCalled();
    expect(loadLocal("alice").dirty).toBe(true);
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
    });
    act(() => window.dispatchEvent(new Event("online")));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1), {
      timeout: 2500,
    });
    await waitFor(() => expect(loadLocal("alice").dirty).toBe(false));
  });
  it("manual retry performs a fresh cloud health snapshot even with no pending changes", async () => {
    render(
      <StoreProvider>
        <Harness />
      </StoreProvider>,
    );
    await auth("alice");
    await waitFor(() => expect(mocks.load).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByText("Retry"));
    await waitFor(() => expect(mocks.load).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId("state").textContent).not.toContain("|never");
    expect(loadLocal("alice").lastAttemptAt).toBeTruthy();
  });
  it("does not expose raw cloud errors during account hydration", async () => {
    mocks.load.mockRejectedValueOnce(
      new Error('[{"code":"invalid_type","path":["accuracy"]}]'),
    );
    render(
      <StoreProvider>
        <Harness />
      </StoreProvider>,
    );
    await auth("alice");
    await waitFor(() =>
      expect(screen.getByRole("paragraph").textContent).toContain(
        "Your device copy is still available",
      ),
    );
    expect(screen.getByRole("paragraph").textContent).not.toContain(
      "invalid_type",
    );
  });
  it("surfaces an explicit error when retry has no authenticated owner", async () => {
    render(
      <StoreProvider>
        <Harness />
      </StoreProvider>,
    );
    await auth(null, "INITIAL_SESSION");
    fireEvent.click(screen.getByText("Retry"));
    expect(screen.getByRole("paragraph").textContent).toContain(
      "no authenticated account",
    );
    expect(mocks.load).not.toHaveBeenCalled();
  });
});
