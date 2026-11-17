import { beforeEach, expect, it, vi } from "vitest";
const { rpc, from } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock("./supabase", () => ({ supabase: { rpc, from } }));
vi.mock("../data/cloudLock", () => ({
  withAccountCloudLock: (_owner: string, run: () => unknown) => run(),
}));
import { feedbackAdmin, updateFeedback, deleteFeedback } from "./feedback";
beforeEach(() => rpc.mockReset());
it("does not turn temporary server failure into denied permission", async () => {
  const error = { code: "", message: "Network unavailable" };
  rpc.mockResolvedValue({ data: null, error, status: 503 });
  await expect(feedbackAdmin("alice")).rejects.toBe(error);
});
it.each([
  { code: "PGRST301", status: 401 },
  { code: "42501", status: 403 },
  { code: "", status: 401 },
])(
  "denies confirmed session/permission failure %j",
  async ({ code, status }) => {
    rpc.mockResolvedValue({ data: null, error: { code }, status });
    await expect(feedbackAdmin("alice")).resolves.toBe(false);
  },
);
it("requires explicit permission", async () => {
  for (const data of [null, false, true]) {
    rpc.mockResolvedValue({ data, error: null, status: 200 });
    await expect(feedbackAdmin("alice")).resolves.toBe(data === true);
  }
});

it.each(["update", "delete"] as const)(
  "requires an affected Feedback row for %s, including revoked access",
  async (action) => {
    const single = vi.fn();
    const query = {
      update: vi.fn(),
      delete: vi.fn(),
      eq: vi.fn(),
      select: vi.fn(),
      maybeSingle: vi.fn(),
      single,
    };
    for (const method of [query.update, query.delete, query.eq, query.select])
      method.mockReturnValue(query);
    query.maybeSingle.mockResolvedValue({ data: null, error: null });
    from.mockReturnValue(query);
    const run = () =>
      action === "update"
        ? updateFeedback("feedback-id", { status: "reviewing" })
        : deleteFeedback("feedback-id");
    single.mockResolvedValue({ data: null, error: null });
    await expect(run()).rejects.toThrow(/Feedback was not/);
    single.mockResolvedValue({ data: null, error: { code: "PGRST116" } });
    await expect(run()).rejects.toEqual({ code: "PGRST116" });
    single.mockResolvedValue({ data: { id: "feedback-id" }, error: null });
    await expect(run()).resolves.toBeUndefined();
  },
);
