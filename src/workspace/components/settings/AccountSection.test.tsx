import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  retrySync: vi.fn(),
  setAccount: vi.fn(),
}));

vi.mock("../../contexts/AppDataContext", () => ({
  LOCAL_ACCOUNT: { provider: null, name: "", detail: "", status: "local" },
  useAppData: () => ({
    account: {
      provider: "google",
      name: "Test User",
      detail: "test@example.com",
      status: "failed",
      lastAttemptAt: "2026-09-28T01:23:00.000Z",
    },
    setAccount: mocks.setAccount,
    retrySync: mocks.retrySync,
    syncMessage: "Network unavailable",
  }),
}));

vi.mock("../../hooks/useSignInFlow", () => ({
  useSignInFlow: () => ({ step: "idle", provider: null, start: vi.fn() }),
}));

import { AccountSection } from "./AccountSection";

describe("AccountSection synchronization controls", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the real attempt time and invokes the record-sync retry", () => {
    render(<AccountSection />);
    expect(screen.getByText(/last tried/).textContent).not.toContain("14:02");
    expect(screen.getByText("Network unavailable")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(mocks.retrySync).toHaveBeenCalledTimes(1);
    expect(mocks.setAccount).not.toHaveBeenCalled();
  });
});
