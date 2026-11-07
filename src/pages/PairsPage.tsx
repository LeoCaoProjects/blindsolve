import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useStore } from "../app/Store";
import { stickersFor } from "../domain/bld/speffz";
import type { PieceType } from "../domain/bld/types";
import { pairKey } from "../domain/letterPairs";
import { PairEditor, type PairSelection } from "../components/PairEditor";

export default function PairsPage() {
  const { data } = useStore();
  const [type, setType] = useState<PieceType>("edge"),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [selected, setSelected] = useState<PairSelection | null>(null),
    [cell, setCell] = useState([0, 0]);
  const grid = useRef<HTMLTableElement>(null),
    stickers = useMemo(
      () => stickersFor(data.scheme, type),
      [data.scheme, type],
    );
  const items = useMemo(
    () =>
      stickers.flatMap((second, row) =>
        stickers.map((first, col) => ({
          first,
          second,
          row,
          col,
          pair: data.pairs[pairKey(first.id, second.id)],
        })),
      ),
    [stickers, data.pairs],
  );
  const filled = items.filter((i) => i.pair?.primaryMnemonic).length;
  const filtered = items.filter(
    (i) =>
      (filter === "all" ||
        (filter === "filled"
          ? !!i.pair?.primaryMnemonic
          : !i.pair?.primaryMnemonic)) &&
      `${i.first.label}${i.second.label} ${i.first.label} ${i.second.label} ${i.pair?.primaryMnemonic ?? ""} ${i.pair?.alternates.join(" ") ?? ""}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  const keyboard = (e: KeyboardEvent, row: number, col: number) => {
    const move: Record<string, [number, number]> = {
      ArrowUp: [row - 1, col],
      ArrowDown: [row + 1, col],
      ArrowLeft: [row, col - 1],
      ArrowRight: [row, col + 1],
      Home: [row, 0],
      End: [row, 23],
    };
    const next = move[e.key];
    if (!next) return;
    e.preventDefault();
    const r = Math.max(0, Math.min(23, next[0])),
      c = Math.max(0, Math.min(23, next[1]));
    setCell([r, c]);
    grid.current
      ?.querySelector<HTMLButtonElement>(`[data-cell="${r}-${c}"]`)
      ?.focus();
  };
  const listing = query.trim() !== "" || filter !== "all";
  return (
    <section className="pairs-page">
      <div className="page-heading">
        <div>
          <h1>Letter pairs</h1>
          <p>Your words, indexed by two stickers.</p>
        </div>
        <span className="coverage">
          <strong>{filled}</strong> / 576 filled{" "}
          <span>({Math.round((filled / 576) * 100)}%)</span>
        </span>
      </div>
      <div className="toolbar">
        <div className="tabs" aria-label="Piece type">
          {(["edge", "corner"] as const).map((t) => (
            <button
              key={t}
              aria-pressed={t === type}
              onClick={() => {
                setType(t);
                setCell([0, 0]);
              }}
            >
              {t === "edge" ? "Edges" : "Corners"}
            </button>
          ))}
        </div>
        <label className="search-field">
          <span className="sr-only">Search pairs</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Pair or word…"
          />
        </label>
        <label className="filter-field">
          <span className="sr-only">Pair coverage filter</span>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All pairs</option>
            <option value="filled">Filled only</option>
            <option value="empty">Empty only</option>
          </select>
        </label>
      </div>
      <div className="grid-caption">
        <span>Column = first token · Row = second token</span>
        <span>
          <kbd>↑ ↓ ← →</kbd> move <kbd>Enter</kbd> edit
        </span>
      </div>
      {listing ? (
        <div className="search-results">
          <p className="subtle">{filtered.length} matching pairs</p>
          {filtered.length ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Pair</th>
                  <th>Word</th>
                  <th>Alternates</th>
                  <th>
                    <span className="sr-only">Action</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 576).map((i) => (
                  <tr key={pairKey(i.first.id, i.second.id)}>
                    <th className="mono">
                      {i.first.label} · {i.second.label}
                    </th>
                    <td>
                      {i.pair?.primaryMnemonic || (
                        <span className="subtle">No word saved</span>
                      )}
                    </td>
                    <td className="subtle">{i.pair?.alternates.join(", ")}</td>
                    <td>
                      <button
                        className="quiet"
                        onClick={() => setSelected([i.first.id, i.second.id])}
                      >
                        Edit
                        <span className="sr-only">
                          {" "}
                          {i.first.label} {i.second.label}
                        </span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-inline">
              No matching pairs.{" "}
              <button
                className="text-button"
                onClick={() => {
                  setQuery("");
                  setFilter("all");
                }}
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="matrix-wrap">
          <table
            className="pair-matrix"
            ref={grid}
            aria-label={`${type} letter pair matrix`}
          >
            <thead>
              <tr>
                <th
                  className="corner-header"
                  aria-label="Second token by first token"
                >
                  ↓ / →
                </th>
                {stickers.map((s, c) => (
                  <th
                    scope="col"
                    className={cell[1] === c ? "crosshair" : ""}
                    key={s.id}
                  >
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stickers.map((row, r) => (
                <tr key={row.id}>
                  <th scope="row" className={cell[0] === r ? "crosshair" : ""}>
                    {row.label}
                  </th>
                  {stickers.map((col, c) => {
                    const pair = data.pairs[pairKey(col.id, row.id)],
                      active = cell[0] === r && cell[1] === c;
                    return (
                      <td key={col.id} className={active ? "selected" : ""}>
                        <button
                          data-cell={`${r}-${c}`}
                          tabIndex={active ? 0 : -1}
                          aria-label={`${col.label} ${row.label}: ${pair?.primaryMnemonic || "empty"}`}
                          onFocus={() => setCell([r, c])}
                          onKeyDown={(e) => keyboard(e, r, c)}
                          onClick={() => setSelected([col.id, row.id])}
                          title={pair?.primaryMnemonic}
                        >
                          <span>{pair?.primaryMnemonic}</span>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {selected && (
        <PairEditor
          key={pairKey(...selected)}
          ids={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
}
