import React, { useState } from "react";
import { displayMemoPair } from "../../../domain/letterPairs/identity";

interface EditableWordProps {
  pair: string;
  value: string;
  isNew?: boolean;
  onCommit: (value: string) => void;
}

export function EditableWord({
  pair,
  value,
  isNew,
  onCommit,
}: EditableWordProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (editing) {
    const commit = () => {
      setEditing(false);
      if (draft.trim() !== value) onCommit(draft.trim());
    };
    return (
      <input
        autoFocus
        aria-label={`Word used for ${displayMemoPair(pair)}`}
        value={draft}
        size={Math.max(draft.length + 1, 6)}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            setDraft(value);
            setEditing(false);
          }
        }}
        className="w-full max-w-[11rem] border-b border-accent bg-transparent pb-px text-ink outline-none"
      />
    );
  }

  return (
    <button
      type="button"
      title="Edit the word you used"
      aria-label={`Edit word used for ${displayMemoPair(pair)}`}
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      className="group inline-flex max-w-full items-baseline gap-1 border-b border-transparent pb-px text-left transition-colors duration-150 ease-out hover:border-line-strong hover:text-ink"
    >
      <span className="truncate">
        {value || <span className="text-ink-3">—</span>}
      </span>
      {isNew && (
        <span className="text-[0.85em] text-accent" aria-label="new pair">
          +
        </span>
      )}
    </button>
  );
}
