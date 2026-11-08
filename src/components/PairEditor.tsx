import { writeDefaultWords } from "../magic/utils/pairPersistence";
import { pairKey as logicalPairKey } from "../magic/utils/pairs";
import { useState } from "react";
import { Dialog } from "./Dialog";
import { useStore } from "../app/Store";
import { pairKey } from "../domain/letterPairs";
import suggestions from "../data/letterPairSuggestions.json";
export type PairSelection = readonly [string, string];
export function PairEditor({
  ids,
  onClose,
}: {
  ids: PairSelection;
  onClose: () => void;
}) {
  const { data, update, notify } = useStore(),
    pair = data.pairs[pairKey(...ids)];
  const first = data.scheme.stickers[ids[0]],
    second = data.scheme.stickers[ids[1]];
  const [primary, setPrimary] = useState(pair?.primaryMnemonic ?? ""),
    [show, setShow] = useState(false);
  const proposed =
    first.label.length === 1 && second.label.length === 1
      ? ((suggestions as Record<string, string[]>)[
          first.label + second.label
        ] ?? [])
      : [];
  const save = () => {
    const old = pair;
    update((current) =>
      writeDefaultWords(current, {
        [logicalPairKey(first.label, second.label)]: primary.trim(),
      }),
    );
    notify(
      primary.trim()
        ? `Saved ${first.label} · ${second.label}.`
        : `Cleared ${first.label} · ${second.label}${old?.primaryMnemonic ? `. Previous word: ${old.primaryMnemonic}` : ""}.`,
    );
    onClose();
  };
  return (
    <Dialog title={`${first.label} · ${second.label}`} onClose={onClose}>
      <p className="subtle">
        Saves as Default for both Edges and Corners; optional overrides stay
        unchanged.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <p className="subtle">
          {first.pieceType === "edge" ? "Edges" : "Corners"} · {ids[0]} →{" "}
          {ids[1]}
        </p>
        <label>
          Primary word
          <input
            autoFocus
            value={primary}
            onChange={(e) => setPrimary(e.target.value)}
            maxLength={1000}
            autoComplete="off"
          />
        </label>
        <button
          type="button"
          className="text-button suggestions-trigger"
          onClick={() => setShow(!show)}
          aria-expanded={show}
        >
          {show ? "Hide suggestions" : "Can't think of one? Show suggestions"}
        </button>
        {show && (
          <div className="suggestions">
            {proposed.length ? (
              proposed.map((s) => (
                <button type="button" key={s} onClick={() => setPrimary(s)}>
                  {s}
                </button>
              ))
            ) : (
              <p>No curated suggestions for these tokens yet.</p>
            )}
          </div>
        )}
        <div className="dialog-actions">
          <button
            type="button"
            className="quiet"
            onClick={() => {
              setPrimary("");
            }}
          >
            Clear fields
          </button>
          <button type="submit" className="primary">
            Save
          </button>
        </div>
      </form>
    </Dialog>
  );
}
