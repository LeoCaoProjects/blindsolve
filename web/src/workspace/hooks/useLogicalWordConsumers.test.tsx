import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import { emptyData, type AppData } from "../../data/model";
import {
  pairsFromStore,
  writeDefaultWords,
  writePairEntries,
} from "../utils/pairPersistence";
import { compareGroups } from "../utils/training";
import { useFlashcards } from "./useFlashcards";
import type { TrainingSession } from "./useTrainingSession";
import { RecallReview } from "../components/training/review/RecallReview";

const state = vi.hoisted(() => ({ data: {} as AppData, update: vi.fn() }));
vi.hoisted(() => {
  window.history.replaceState(null, "", "?sizing=legacy");
});
vi.mock("../../app/Store", () => ({ useStore: () => state }));
vi.mock("../contexts/AppDataContext", async (original) => {
  const actual = await original<typeof import("../contexts/AppDataContext")>();
  return {
    ...actual,
    useAppData: () => ({
      pairs: pairsFromStore(state.data),
      setup: actual.setupFromStore(state.data),
      setDefaultWord: (key: string, word: string) => {
        state.data = writeDefaultWords(state.data, { [key]: word });
      },
    }),
  };
});
beforeEach(() => {
  state.data = emptyData();
  for (const sticker of Object.values(state.data.scheme.stickers))
    if (sticker.label === "T") sticker.label = "SH";
  state.data = writePairEntries(state.data, {
    "SH|B": { shared: ["Ship"], edges: ["Shovel"], corners: ["Shell"] },
  });
});
afterEach(cleanup);

it.each(["delete", "mapping", "edit"])("Flashcards refuses stale Default save after %s", (kind) => {
  const { result, rerender } = renderHook(() => useFlashcards({ card: "SH|B", scope: "edges" }));
  act(() => result.current.beginEdit());
  if (kind === "mapping") state.data = { ...state.data, scheme: { ...state.data.scheme, name: "Changed" } };
  else state.data = writePairEntries(state.data, { "SH|B": kind === "delete" ? null : { shared: ["Newer"] } }, "2030-01-01T00:00:00.000Z");
  rerender();
  const before = JSON.stringify(state.data);
  act(() => result.current.editPrimary("Stale draft"));
  expect(JSON.stringify(state.data)).toBe(before);
  expect(result.current.editError).toContain("workspace changed");
});

it("Flashcards ignores IME Space and rating keys", () => {
  const { result } = renderHook(() => useFlashcards({ card: "SH|B", scope: "edges" }));
  fireEvent.keyDown(window, { code: "Space", isComposing: true });
  expect(result.current.phase).toBe("question");
  act(() => result.current.reveal());
  fireEvent.keyDown(window, { key: "3", isComposing: true });
  expect(result.current.phase).toBe("revealed");
});

it("Flashcards reads atomic custom labels with piece overrides and edits only Default", () => {
  const { result, rerender } = renderHook(() =>
    useFlashcards({ card: "SH|B", scope: "edges", phase: "revealed" }),
  );
  expect(result.current.cardTokens).toEqual(["SH", "B"]);
  expect(result.current.words).toEqual(["Shovel"]);
  act(() => result.current.editPrimary("Shirt"));
  rerender();
  expect(pairsFromStore(state.data)["SH|B"]).toEqual({
    shared: ["Shirt"],
    edges: ["Shovel"],
    corners: ["Shell"],
  });
  expect(state.data.pairs).toEqual({});
});

it("Memo Recall saves the custom tuple to Default and preserves its explicit overrides", () => {
  const next = vi.fn();
  const results = compareGroups(
    [{ piece: "edges", tokens: ["SH", "B"] }],
    ["SH C"],
    ["SH", "B", "C"],
  );
  const session = {
    results,
    history: [],
    next,
    wordFor: () => "Shovel",
    allCorrect: false,
    elapsed: { memo: 4000, recall: 2000 },
  } as unknown as TrainingSession;
  render(<RecallReview t={session} />);
  fireEvent.change(screen.getByRole("textbox", { name: "Word for SHB" }), {
    target: { value: "Shirt" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(next).toHaveBeenCalledOnce();
  expect(pairsFromStore(state.data)["SH|B"]).toEqual({
    shared: ["Shirt"],
    edges: ["Shovel"],
    corners: ["Shell"],
  });
  expect(
    Object.values(state.data.logicalPairs!).every(
      (record) => !("firstStickerId" in record),
    ),
  ).toBe(true);
});
