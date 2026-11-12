import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  oauth: vi.fn(),
  otp: vi.fn(),
  store: {
    ready: true,
    user: null as null | { id: string },
    guestMigration: null,
  },
  account: { provider: null as string | null },
}));
vi.mock("../../lib/supabase", () => ({
  supabase: { auth: { signInWithOAuth: mocks.oauth, verifyOtp: mocks.otp } },
  supabaseUrl: "https://example.invalid",
}));
vi.mock("../../app/Store", () => ({ useStore: () => mocks.store }));
vi.mock("../contexts/AppDataContext", () => ({
  useAppData: () => ({ account: mocks.account }),
}));
import { useSignInFlow } from "./useSignInFlow";
import { StrictMode } from "react";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.store.user = null;
  mocks.account.provider = null;
  history.replaceState({}, "", "/");
});
afterEach(cleanup);
it("consumes a WCA callback only once under StrictMode effect replay", async () => {
  history.replaceState({}, "", "/#wca_token_hash=disposable");
  mocks.otp.mockResolvedValue({ error: { message: "Expired callback" } });
  const { result } = renderHook(() => useSignInFlow(), { wrapper: StrictMode });
  await waitFor(() => expect(result.current.error).toBe("Expired callback"));
  expect(mocks.otp).toHaveBeenCalledOnce();
  expect(result.current.step).toBe("idle");
});
it("ignores cancelled OAuth completion and allows a fresh retry", async () => {
  let finish!: (value: unknown) => void;
  mocks.oauth
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValue({ data: {}, error: { message: "retry error" } });
  const { result } = renderHook(() => useSignInFlow());
  act(() => result.current.start("google"));
  act(() => result.current.cancel());
  await act(async () =>
    finish({ data: { url: "https://example.invalid" }, error: null }),
  );
  expect(result.current.step).toBe("idle");
  expect(result.current.error).toBeNull();
  act(() => result.current.start("google"));
  await waitFor(() => expect(result.current.error).toBe("retry error"));
  expect(mocks.oauth.mock.calls[0][0].options.skipBrowserRedirect).toBe(true);
});
it.each(["switch", "unmount"])(
  "ignores pending errors after %s",
  async (kind) => {
    let finish!: (value: unknown) => void;
    mocks.oauth.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const hook = renderHook(() => useSignInFlow());
    act(() => hook.result.current.start("google"));
    if (kind === "switch") {
      mocks.store.user = { id: "other" };
      hook.rerender();
    } else hook.unmount();
    await act(async () =>
      finish({ data: {}, error: { message: "abandoned" } }),
    );
    expect(hook.result.current.error).toBeNull();
  },
);
it("handles thrown OAuth failure without leaving redirecting state", async () => {
  mocks.oauth.mockRejectedValue(new Error("network"));
  const { result } = renderHook(() => useSignInFlow());
  act(() => result.current.start("google"));
  await waitFor(() =>
    expect(result.current.error).toContain("could not be started"),
  );
  expect(result.current.step).toBe("idle");
});
it("handles failed WCA callback, consumes callback URL and permits provider retry", async () => {
  history.replaceState({}, "", "/#wca_token_hash=disposable");
  mocks.otp.mockRejectedValue(new Error("expired"));
  mocks.oauth.mockResolvedValue({ data: {}, error: { message: "retry" } });
  const { result } = renderHook(() => useSignInFlow());
  await waitFor(() =>
    expect(result.current.error).toContain("could not be completed"),
  );
  expect(location.hash).toBe("");
  expect(result.current.step).toBe("idle");
  act(() => result.current.start("google"));
  await waitFor(() => expect(result.current.error).toBe("retry"));
});
it("does not complete sign-in while signed out or hydration is pending", () => {
  const done = vi.fn();
  mocks.store.ready = false;
  mocks.account.provider = "google";
  const hook = renderHook(() => useSignInFlow({ onDone: done }));
  expect(done).not.toHaveBeenCalled();
  mocks.store.ready = true;
  mocks.account.provider = null;
  hook.rerender();
  expect(done).not.toHaveBeenCalled();
  mocks.account.provider = "google";
  hook.rerender();
  expect(done).toHaveBeenCalledOnce();
});
