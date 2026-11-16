import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({
  admin: vi.fn(),
  list: vi.fn(),
  auth: (_event: string, _session: { user: { id: string } } | null) => {},
}));
vi.mock("../../lib/feedback", () => ({
  feedbackAdmin: api.admin,
  listFeedback: api.list,
}));
vi.mock("../../lib/supabase", () => ({
  supabase: {
    auth: {
      onAuthStateChange: (callback: typeof api.auth) => {
        api.auth = callback;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
    },
  },
}));
import { useFeedbackInbox } from "./useFeedbackInbox";
beforeEach(() => {
  vi.resetAllMocks();
  api.admin.mockResolvedValue(true);
  api.list.mockResolvedValue([]);
});
afterEach(cleanup);
it("keeps forbidden inbox empty without requesting records", async () => {
  api.admin.mockResolvedValue(false);
  const { result } = renderHook(() => useFeedbackInbox("alice"));
  await waitFor(() => expect(result.current.feedbackStatus).toBe("ready"));
  expect(result.current.isAdmin).toBe(false);
  expect(api.list).not.toHaveBeenCalled();
});
it("distinguishes empty success from failure and recovers on retry", async () => {
  api.list.mockRejectedValueOnce(new Error("offline"));
  const { result } = renderHook(() => useFeedbackInbox("alice"));
  await waitFor(() => expect(result.current.feedbackStatus).toBe("error"));
  act(() => result.current.retryFeedback());
  await waitFor(() => expect(result.current.feedbackStatus).toBe("ready"));
  expect(result.current.feedback).toEqual([]);
  expect(result.current.isAdmin).toBe(true);
});
it("handles rejected permission checks", async () => {
  api.admin.mockRejectedValue(new Error("offline"));
  const { result } = renderHook(() => useFeedbackInbox("alice"));
  await waitFor(() => expect(result.current.feedbackStatus).toBe("error"));
  expect(result.current.isAdmin).toBe(false);
});
it.each([undefined, "bob"])(
  "ignores old load and mutation completions after owner becomes %s",
  async (nextOwner) => {
    let resolve!: (value: unknown) => void;
    api.list.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const { result, rerender } = renderHook(
      ({ owner }) => useFeedbackInbox(owner),
      { initialProps: { owner: "alice" as string | undefined } },
    );
    await waitFor(() => expect(api.list).toHaveBeenCalledOnce());
    const apply = result.current.capture();
    rerender({ owner: nextOwner });
    expect(result.current.feedback).toEqual([]);
    expect(result.current.isAdmin).toBe(false);
    await act(async () => {
      resolve([{ id: "private" }]);
      apply(() => [{ id: "late" }] as never);
    });
    expect(result.current.feedback).toEqual([]);
  },
);

it("retains confirmed authorization during coalesced focus/visibility/token refresh and transient failure", async () => {
  const { result } = renderHook(() => useFeedbackInbox("alice"));
  await waitFor(() => expect(result.current.feedbackStatus).toBe("ready"));
  let finish!: (allowed: boolean) => void;
  api.admin.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  act(() => {
    window.dispatchEvent(new Event("focus"));
    document.dispatchEvent(new Event("visibilitychange"));
    api.auth("TOKEN_REFRESHED", { user: { id: "alice" } });
  });
  expect(api.admin).toHaveBeenCalledTimes(2);
  expect(result.current.isAdmin).toBe(true);
  expect(result.current.feedbackStatus).toBe("ready");
  await act(async () => finish(true));
  api.admin.mockRejectedValueOnce(new Error("offline"));
  act(() => result.current.retryFeedback());
  await waitFor(() => expect(result.current.feedbackStatus).toBe("error"));
  expect(result.current.isAdmin).toBe(true);
  api.admin.mockResolvedValueOnce(false);
  act(() => result.current.retryFeedback());
  await waitFor(() => expect(result.current.isAdmin).toBe(false));
  expect(result.current.feedback).toEqual([]);
});
it.each(["SIGNED_OUT", "SIGNED_IN"])(
  "invalidates cached permission immediately on %s and ignores the old request",
  async (event) => {
    const { result } = renderHook(() => useFeedbackInbox("alice"));
    await waitFor(() => expect(result.current.isAdmin).toBe(true));
    await waitFor(() => expect(result.current.feedbackStatus).toBe("ready"));
    let finish!: (allowed: boolean) => void;
    api.admin.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    act(() => window.dispatchEvent(new Event("focus")));
    act(() =>
      api.auth(event, event === "SIGNED_OUT" ? null : { user: { id: "bob" } }),
    );
    expect(result.current.isAdmin).toBe(false);
    await act(async () => finish(true));
    expect(result.current.isAdmin).toBe(false);
  },
);
it("removes permission on a confirmed expired session error", async () => {
  const { result } = renderHook(() => useFeedbackInbox("alice"));
  await waitFor(() => expect(result.current.feedbackStatus).toBe("ready"));
  api.admin.mockRejectedValueOnce({ code: "PGRST301" });
  act(() => result.current.retryFeedback());
  await waitFor(() => expect(result.current.isAdmin).toBe(false));
});
