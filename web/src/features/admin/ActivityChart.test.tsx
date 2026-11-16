import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { ActivityChart, activityPoints } from "./ActivityChart";
afterEach(cleanup);
it("does not fabricate an empty trend", () => {
  render(<ActivityChart days={[]} />);
  expect(screen.getByText("No activity in this period.")).toBeTruthy();
  expect(screen.queryByRole("img")).toBeNull();
});
it("uses a compact single-day value and preserves exact values for every series", () => {
  render(
    <ActivityChart
      days={[{ day: "2026-11-16", accounts: 2, solves: 20, training: 35 }]}
    />,
  );
  expect(screen.queryByRole("img")).toBeNull();
  expect(screen.getByText("20", { selector: "span" })).toBeTruthy();
  fireEvent.click(screen.getByRole("radio", { name: "Training" }));
  expect(screen.getByText("35", { selector: "span" })).toBeTruthy();
  fireEvent.click(screen.getByText("Daily values"));
  expect(screen.getByRole("row", { name: "2026-11-16 2 20 35" })).toBeTruthy();
});
it("switches charts without changing the exact underlying values", () => {
  render(
    <ActivityChart
      days={[
        { day: "2026-11-01", accounts: 1, solves: 3, training: 0 },
        { day: "2026-11-16", accounts: 2, solves: 8, training: 5 },
      ]}
    />,
  );
  expect(screen.getByRole("img", { name: /Solves by day/ })).toBeTruthy();
  expect(screen.getByLabelText("Chart scale").textContent).toBe("048");
  fireEvent.click(screen.getByRole("radio", { name: "Accounts" }));
  expect(screen.getByRole("img", { name: /Accounts by day/ })).toBeTruthy();
  fireEvent.click(screen.getByText("Daily values"));
  expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(3);
  expect(screen.getByRole("row", { name: "2026-11-01 1 3 0" })).toBeTruthy();
});

it("keeps exact values when the selected series is empty and distinguishes years", () => {
  render(
    <ActivityChart
      days={[
        { day: "2025-11-01", accounts: 1, solves: 0, training: 0 },
        { day: "2026-11-16", accounts: 2, solves: 0, training: 5 },
      ]}
    />,
  );
  expect(screen.getByText("No solves in this period.")).toBeTruthy();
  expect(screen.queryByRole("img")).toBeNull();
  fireEvent.click(screen.getByRole("radio", { name: "Accounts" }));
  const caption = document.querySelector("figcaption")!;
  const first = screen
    .getByRole("group", { name: /Accounts values/ })
    .querySelector("button")!;
  fireEvent.focus(first);
  expect(caption.textContent).toContain("2025");
  fireEvent.keyDown(first, { key: "End" });
  expect(caption.textContent).toContain("2026");
  fireEvent.click(screen.getByText("Daily values"));
  expect(screen.getByRole("row", { name: "2026-11-16 2 0 5" })).toBeTruthy();
});

it("fills empty days without inventing hourly values for a 24-hour response", () => {
  const days = [{ day: "2026-11-16", accounts: 1, solves: 4, training: 3 }];
  const points = activityPoints(
    days,
    "2026-11-15T10:00:00Z",
    "2026-11-16T10:00:00Z",
  );
  expect(points.map((p) => [p.day, p.solves])).toEqual([["2026-11-16", 4]]);
  expect(activityPoints([], "2026-11-15", "2026-11-16")).toEqual([]);
});
it("bounds long-range points and preserves every count in monthly groups", () => {
  const days = [
    { day: "2020-01-02", accounts: 2, solves: 3, training: 4 },
    { day: "2026-11-16", accounts: 5, solves: 6, training: 7 },
  ];
  const points = activityPoints(days);
  expect(points.length).toBeLessThanOrEqual(36);
  expect(points.reduce((total, point) => total + point.solves, 0)).toBe(9);
  expect(points.reduce((total, point) => total + point.accounts, 0)).toBe(7);
  expect(points.reduce((total, point) => total + point.training, 0)).toBe(11);
  expect(points[0].day).toBe("2020-01-02");
  expect(points.at(-1)?.end).toBe("2026-11-16");
});
it("exposes exact values through pointer and arrow-key exploration", () => {
  render(
    <ActivityChart
      days={[
        { day: "2026-11-15", accounts: 1, solves: 3, training: 0 },
        { day: "2026-11-16", accounts: 2, solves: 8, training: 5 },
      ]}
    />,
  );
  const points = within(
    screen.getByRole("group", { name: /Solves values/ }),
  ).getAllByRole("button");
  fireEvent.mouseEnter(points[0]);
  expect(document.querySelector("figcaption")?.textContent).toContain(
    "3 solves",
  );
  points[0].focus();
  fireEvent.keyDown(points[0], { key: "ArrowRight" });
  expect(document.activeElement).toBe(points[1]);
  expect(document.querySelector("figcaption")?.textContent).toContain(
    "8 solves",
  );
});

it("keeps overlapping daily values and zero days identical despite older unrelated accounts", () => {
  const days = [
    { day: "2020-01-01", accounts: 1, solves: 0, training: 0 },
    { day: "2026-11-14", accounts: 0, solves: 5, training: 1 },
    { day: "2026-11-16", accounts: 0, solves: 2, training: 0 },
  ];
  const recent = activityPoints(
    days.filter((d) => d.day >= "2026-10-18"),
    "2026-10-18T10:00:00Z",
    "2026-11-17T10:00:00Z",
    "solves",
  );
  const all = activityPoints(days, null, "2026-11-17T10:00:00Z", "solves");
  expect(all).toEqual(recent);
  expect(all.map((p) => [p.day, p.end, p.solves])).toEqual([
    ["2026-11-14", "2026-11-14", 5],
    ["2026-11-15", "2026-11-15", 0],
    ["2026-11-16", "2026-11-16", 2],
    ["2026-11-17", "2026-11-17", 0],
  ]);
});
it("uses daily points through 60 days, Monday weeks through 365, then months", () => {
  const days = [{ day: "2026-01-01", accounts: 1, solves: 2, training: 3 }];
  expect(activityPoints(days, null, "2026-03-01")).toHaveLength(60);
  const weeks = activityPoints(days, null, "2026-03-02");
  expect(weeks[0].end).toBe("2026-01-04");
  expect(weeks[1].day).toBe("2026-01-05");
  expect(weeks.reduce((n, p) => n + p.solves, 0)).toBe(2);
  const months = activityPoints(days, null, "2027-01-01");
  expect(months[0].end).toBe("2026-01-31");
  expect(months[1].day).toBe("2026-02-01");
});
it("shows an exact last-24-hour total instead of a daily trend", () => {
  render(
    <ActivityChart
      range="24h"
      days={[
        { day: "2026-11-15", accounts: 1, solves: 3, training: 2 },
        { day: "2026-11-16", accounts: 0, solves: 2, training: 4 },
      ]}
    />,
  );
  expect(screen.queryByRole("img")).toBeNull();
  expect(screen.getByText("Last 24 hours")).toBeTruthy();
  expect(screen.getByText("5", { selector: "span" })).toBeTruthy();
  fireEvent.click(screen.getByRole("radio", { name: "Training" }));
  expect(screen.getByText("6", { selector: "span" })).toBeTruthy();
});
