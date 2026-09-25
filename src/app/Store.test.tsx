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
  saveCloud: mocks.save,
}));
import { StoreProvider, useStore } from "./Store";
import { emptyData, loadLocal } from "../lib/repository";
function Harness() {
  const s = useStore();
  return (
    <>
      <span data-testid="state">
        {s.ready ? "ready" : "loading"}|{s.user?.id ?? "guest"}|
        {s.data.scheme.name}|{s.sync}
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
    mocks.load
      .mockReset()
      .mockResolvedValue({ data: emptyData(), revision: 0, dirty: false });
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
});
