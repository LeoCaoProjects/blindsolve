import { fireEvent, render, screen, act } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { LegacyRecoverySection } from "./LegacyRecoverySection";

const mock = vi.hoisted(() => ({
  workspaceIdentity: vi.fn(), readLegacyRecovery: vi.fn(), downloadJson: vi.fn(),
}));
vi.mock("../../../app/Store", () => ({ useStore: () => mock }));
vi.mock("../../utils/backup", () => ({ downloadJson: mock.downloadJson }));

const review = {
  format: "blindsolve-v1-review",
  version: 1,
  tables: [
    { table: "practice_attempts", status: "unavailable", rows: [] },
    { table: "letter_pair_aliases", status: "complete", rows: [{ source: { id: "8" }, reason: "review" }] },
  ],
};
beforeEach(() => {
  vi.resetAllMocks();
  mock.workspaceIdentity.mockReturnValue("owner:a:1");
});

it("exports review data separately and reports denied coverage", async () => {
  mock.readLegacyRecovery.mockResolvedValue(review);
  render(<LegacyRecoverySection account="a" />);
  fireEvent.click(screen.getByRole("button", { name: "Export legacy records" }));
  await screen.findByText(/Practice attempts: access unavailable/);
  expect(mock.readLegacyRecovery).toHaveBeenCalledWith("a");
  expect(mock.downloadJson).toHaveBeenCalledWith(review, "blindsolve-v1-review.json");
});

it("does not download or retain a result across a workspace transition", async () => {
  let resolve!: (value: typeof review) => void;
  mock.readLegacyRecovery.mockReturnValue(new Promise((done) => { resolve = done; }));
  const view = render(<LegacyRecoverySection key="a" account="a" />);
  fireEvent.click(screen.getByRole("button", { name: "Export legacy records" }));
  mock.workspaceIdentity.mockReturnValue("owner:b:2");
  view.rerender(<LegacyRecoverySection key="b" account="b" />);
  await act(async () => resolve(review));
  expect(mock.downloadJson).not.toHaveBeenCalled();
  expect(screen.getByRole("status").textContent).toBe("");
});
