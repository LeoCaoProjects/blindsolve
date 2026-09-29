import { afterEach, describe, expect, it, vi } from "vitest";
import { withAccountCloudLock } from "./cloudLock";

describe("account cloud lock", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: undefined,
    });
  });

  it("serializes snapshot, admin, and write operations for the same account", async () => {
    let tail = Promise.resolve();
    const request = vi.fn(<T>(_name: string, operation: () => Promise<T>) => {
      const result = tail.then(operation);
      tail = result.then(() => undefined, () => undefined);
      return result;
    });
    Object.defineProperty(navigator, "locks", {
      configurable: true,
      value: { request },
    });
    const events: string[] = [];
    let release!: () => void;
    const first = withAccountCloudLock("alice", async () => {
      events.push("snapshot:start");
      await new Promise<void>((resolve) => { release = resolve; });
      events.push("snapshot:end");
    });
    const second = withAccountCloudLock("alice", async () => {
      events.push("write");
    });

    await vi.waitFor(() => expect(events).toEqual(["snapshot:start"]));
    release();
    await Promise.all([first, second]);
    expect(events).toEqual(["snapshot:start", "snapshot:end", "write"]);
    expect(request).toHaveBeenCalledTimes(2);
    expect(request.mock.calls[0][0]).toBe("blindsolve-cloud:alice");
  });
});
