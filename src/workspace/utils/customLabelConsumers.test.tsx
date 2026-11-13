import { afterEach, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import {
  memoPairReference,
  memoPairTokens,
} from "../../domain/letterPairs/identity";
import { createSpeffzScheme } from "../../domain/bld/speffz";
import { scrambleToState } from "../../domain/bld/cubing";
import { traceMemo } from "../../domain/bld/trace";
import { RecallInput } from "../components/memo/RecallInput";
import { MemoTrace } from "../components/solve/MemoTrace";
import { useReconstruction } from "../hooks/useReconstruction";
import { compareGroups } from "./training";
import { compareTraceGroups } from "./traceValidation";
import { timerWords, toTimerDb, tokenize } from "./pairs";

afterEach(cleanup);
it("keeps colliding display strings separate in Timer and requires unambiguous answer tokens", () => {
  const db = toTimerDb({
    "S|HB": { shared: ["Shoe"] },
    "SH|B": { shared: ["Ship"], edges: ["Shovel"] },
  });
  expect(db.SHB).toBeUndefined();
  expect(timerWords(db, memoPairReference(["S", "HB"]), "edges")).toEqual([
    "Shoe",
  ]);
  expect(timerWords(db, memoPairReference(["SH", "B"]), "edges")).toEqual([
    "Shovel",
  ]);
  expect(timerWords(db, "SHB", "edges")).toEqual([]);
  const vocab = ["S", "HB", "SH", "B"];
  expect(tokenize("SHB", vocab)).toEqual([""]);
  expect(tokenize("sh b", vocab)).toEqual(["SH", "B"]);
  expect(tokenize("s·hb", vocab)).toEqual(["S", "HB"]);
  expect(
    compareGroups([{ piece: "edges", tokens: ["SH", "B"] }], ["SH B"], vocab)[0]
      .correct,
  ).toBe(true);
  expect(
    compareGroups([{ piece: "edges", tokens: ["SH", "B"] }], ["S HB"], vocab)[0]
      .correct,
  ).toBe(false);
});

it("renders custom tokens atomically, including a cycle-break slot, and retains separators in answer entry", () => {
  render(
    <MemoTrace
      pairs={[memoPairReference(["SH", "B"])]}
      breakAt={1}
      resolved={false}
    />,
  );
  expect(screen.getByText("SH").textContent).toBe("SH");
  expect(screen.getByLabelText("cycle break pending")).toBeTruthy();
  const change = vi.fn(),
    enter = vi.fn();
  render(
    <RecallInput
      label="Answers"
      value="SH "
      tokens={["SH", "B"]}
      onChange={change}
      onEnter={enter}
    />,
  );
  const input = screen.getByRole("textbox") as HTMLInputElement;
  expect(input.value).toBe("SH ");
  fireEvent.change(input, { target: { value: "sh b " } });
  expect(change).toHaveBeenCalledWith("SH B ");
  fireEvent.keyDown(input, { key: "Enter" });
  expect(enter).toHaveBeenCalledOnce();
});

it("reconstructs real custom-label targets and writes Default under atomic logical keys", async () => {
  const state = await scrambleToState("R U F");
  const scheme = createSpeffzScheme();
  for (const sticker of Object.values(scheme.stickers)) sticker.label += "H";
  const onSave = vi.fn();
  const { result } = renderHook(() =>
    useReconstruction({
      draft: {
        time: 3000,
        scramble: "R U F",
        date: new Date().toISOString(),
        timerMode: "3bld",
        sample: { edges: [], corners: [] },
        engine: { state, scheme },
      },
      db: {},
      onSave,
    }),
  );
  for (
    let guard = 0;
    guard < 80 && result.current.step.kind !== "review";
    guard++
  ) {
    for (const pair of [
      ...result.current.sample.edges,
      ...result.current.sample.corners,
    ])
      expect(memoPairTokens(pair).length).toBeGreaterThan(0);
    act(() => {
      const step = result.current.step;
      if (step.kind === "break") result.current.pickBreak(step.options[0]);
      else if (step.kind === "word") {
        expect(memoPairTokens(step.pair)).toHaveLength(2);
        result.current.setWord(step.pair, step.piece, "Custom word");
        result.current.next();
      }
    });
  }
  expect(result.current.step.kind).toBe("review");
  act(() => result.current.finish());
  const saved = onSave.mock.calls[0][0];
  expect(Object.keys(saved.defaultWords).length).toBeGreaterThan(0);
  expect(
    Object.keys(saved.defaultWords).every((key) =>
      key.split("|").every((token) => token.length === 2),
    ),
  ).toBe(true);
  expect(
    saved.memo.edges.every(
      (item: { pair: string }) => memoPairTokens(item.pair).length > 0,
    ),
  ).toBe(true);
});

it("validates custom-label Trace Sprint with physical cycle-break mechanics unchanged", async () => {
  const state = await scrambleToState("R U F");
  const scheme = createSpeffzScheme();
  for (const sticker of Object.values(scheme.stickers)) sticker.label += "H";
  const choices = { edges: [] as string[], corners: [] as string[] };
  let trace = traceMemo(state, scheme, choices);
  for (let guard = 0; guard < 50; guard++) {
    const piece = (["edges", "corners"] as const).find(
      (p) => trace[p].status === "cycle-break",
    );
    if (!piece) break;
    choices[piece].push(trace[piece].validCycleBreaks[0]);
    trace = traceMemo(state, scheme, choices);
  }
  const groups = (["edges", "corners"] as const).map((piece) => ({
    piece,
    tokens: trace[piece].targets.map((t) => t.token),
  }));
  const answers = groups.map((g) => g.tokens.join(" "));
  expect(
    compareTraceGroups(
      state,
      scheme,
      groups,
      answers,
      Object.values(scheme.stickers).map((s) => s.label),
    ).every((g) => g.correct),
  ).toBe(true);
});
