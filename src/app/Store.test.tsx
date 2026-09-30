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
}));
import { StoreProvider, useStore } from "./Store";
import { emptyData, loadLocal, SyncConflictError } from "../lib/repository";
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
  it("automatically migrates meaningful guest data into a new empty account once", async () => {
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
    expect(loadLocal(null).data.scheme.name).toBe("Speffz");

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
  it("keeps the guest copy until a failed automatic migration is retried successfully", async () => {
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
    expect(loadLocal(null).data.scheme.name).toBe("Speffz");
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
    await act(async () => new Promise((resolve) => setTimeout(resolve, 900)));
    expect(mocks.save).not.toHaveBeenCalled();
    expect(loadLocal("alice").data.multiphaseTiming).toBe(false);
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
