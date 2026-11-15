import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ admin: vi.fn(), list: vi.fn() }));
vi.mock("../../lib/feedback", () => ({
  feedbackAdmin: api.admin,
  listFeedback: api.list,
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
