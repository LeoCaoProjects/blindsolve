import { useState } from "react";
import { Dialog } from "./Dialog";
import { useStore } from "../app/Store";
import { pairKey, normalizeMnemonic } from "../domain/letterPairs";
import suggestions from "../data/letterPairSuggestions.json";
export type PairSelection = readonly [string, string];
export function PairEditor({
  ids,
  onClose,
}: {
  ids: PairSelection;
  onClose: () => void;
}) {
  const { data, upsertPair, notify } = useStore(),
    pair = data.pairs[pairKey(...ids)];
  const first = data.scheme.stickers[ids[0]],
    second = data.scheme.stickers[ids[1]];
  const [primary, setPrimary] = useState(pair?.primaryMnemonic ?? ""),
    [alternates, setAlternates] = useState(pair?.alternates ?? []),
    [alternate, setAlternate] = useState(""),
    [show, setShow] = useState(false);
  const proposed =
    first.label.length === 1 && second.label.length === 1
      ? ((suggestions as Record<string, string[]>)[
          first.label + second.label
        ] ?? [])
      : [];
  const save = () => {
    const old = pair;
    const all = [
      ...alternates,
      ...(alternate.trim() ? [alternate.trim()] : []),
    ].filter(
      (x, i, a) =>
        normalizeMnemonic(x) !== normalizeMnemonic(primary) &&
        a.findIndex((v) => normalizeMnemonic(v) === normalizeMnemonic(x)) === i,
    );
    upsertPair({
      id: pair?.id ?? crypto.randomUUID(),
      firstStickerId: ids[0],
      secondStickerId: ids[1],
      firstToken: first.label,
      secondToken: second.label,
      primaryMnemonic: primary.trim(),
      alternates: primary.trim() ? all : [],
      encounters: pair?.encounters ?? 0,
      forgotten: pair?.forgotten ?? 0,
      updatedAt: new Date().toISOString(),
    });
    notify(
      primary.trim()
        ? `Saved ${first.label} · ${second.label}.`
        : `Cleared ${first.label} · ${second.label}${old?.primaryMnemonic ? `. Previous mnemonic: ${old.primaryMnemonic}` : ""}.`,
    );
    onClose();
  };
  return (
    <Dialog title={`${first.label} · ${second.label}`} onClose={onClose}>
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
          Primary mnemonic
          <input
            autoFocus
            value={primary}
            onChange={(e) => setPrimary(e.target.value)}
            maxLength={1000}
            autoComplete="off"
          />
        </label>
        <label>
          Alternate mnemonic
          <input
            value={alternate}
            onChange={(e) => setAlternate(e.target.value)}
            maxLength={1000}
          />
        </label>
        {!!alternates.length && (
          <ul className="alias-list">
            {alternates.map((a, i) => (
              <li key={a}>
                {a}
                <button
                  type="button"
                  className="quiet"
                  onClick={() =>
                    setAlternates(alternates.filter((_, n) => n !== i))
                  }
                  aria-label={`Remove ${a}`}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
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
              setAlternates([]);
              setAlternate("");
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
