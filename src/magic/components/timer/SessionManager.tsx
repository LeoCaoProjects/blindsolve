import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useAppData } from "../../contexts/AppDataContext";
import { EASE_OUT } from "../../utils/keyboard";
import { IconButton } from "../common/IconButton";
import { Sheet } from "../common/Sheet";

interface SessionManagerProps {
  open: boolean;
  onClose: () => void;
  /** Preview: start with a delete confirmation showing */
  initialConfirm?: string | null;
}

/** Switch, create, rename and delete Timer sessions. Deleting a session with solves always asks first. */
export function SessionManager({
  open,
  onClose,
  initialConfirm = null,
}: SessionManagerProps) {
  const {
    sessions,
    activeSessionId,
    sessionCounts,
    setActiveSession,
    createSession,
    renameSession,
    deleteSession,
  } = useAppData();
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [confirm, setConfirm] = useState<string | null>(initialConfirm);
  const [newName, setNewName] = useState("");
  const [page, setPage] = useState(0);
  const lastPage = Math.max(0, Math.ceil(sessions.length / 40) - 1);
  const currentPage = Math.min(page, lastPage);
  React.useEffect(() => {
    if (open)
      setPage(
        Math.max(
          0,
          Math.floor(sessions.findIndex((s) => s.id === activeSessionId) / 40),
        ),
      );
  }, [open, activeSessionId]);

  const pick = (id: string) => {
    setActiveSession(id);
    onClose();
  };

  const commitRename = () => {
    if (renaming) renameSession(renaming, draftName);
    setRenaming(null);
  };

  // Every delete asks first, even for an empty session.
  const askDelete = (id: string) => setConfirm(id);

  // ⇧⌫ inside the sheet asks to delete the active session.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.shiftKey && (e.key === "Backspace" || e.key === "Delete")))
        return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
      e.preventDefault();
      setConfirm(activeSessionId);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, activeSessionId]);

  const create = () => {
    if (!newName.trim()) return;
    createSession(newName);
    setNewName("");
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={() => {
        setConfirm(null);
        onClose();
      }}
      label="Sessions"
      title="Sessions"
      width={420}
    >
      <ul className="-mx-2">
        {sessions.slice(currentPage * 40, (currentPage + 1) * 40).map((s) => {
          const active = s.id === activeSessionId;
          const count = sessionCounts[s.id] ?? 0;
          if (confirm === s.id) {
            return (
              <li
                key={s.id}
                className="rounded-[4px] bg-selected px-3 py-3"
                role="alert"
              >
                <p className="text-[13px] text-ink">
                  {count === 0
                    ? `Delete ${s.name}?`
                    : `Delete ${s.name} and its ${count} ${count === 1 ? "solve" : "solves"}?`}
                </p>
                <p className="mt-1 text-[12px] text-ink-3">
                  This can’t be undone.
                </p>
                <div className="mt-3 flex justify-end gap-1">
                  <button
                    type="button"
                    autoFocus
                    onClick={() => setConfirm(null)}
                    className="inline-flex h-8 items-center rounded-[4px] px-3 text-[12.5px] text-ink-2 transition-colors duration-150 ease-out hover:bg-hover hover:text-ink"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      deleteSession(s.id);
                      setConfirm(null);
                    }}
                    className="inline-flex h-8 items-center rounded-[4px] border border-line-strong px-3 text-[12.5px] text-accent transition-colors duration-150 ease-out hover:bg-hover"
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          }
          return (
            <li
              key={s.id}
              className="group flex items-center rounded-[4px] transition-colors duration-150 ease-out hover:bg-hover"
            >
              {renaming === s.id ? (
                <input
                  autoFocus
                  aria-label="Session name"
                  value={draftName}
                  onFocus={(e) => e.currentTarget.select()}
                  onChange={(e) => setDraftName(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitRename();
                    }
                    if (e.key === "Escape") {
                      e.preventDefault();
                      setRenaming(null);
                    }
                  }}
                  className="mx-3 my-1.5 h-8 min-w-0 flex-1 border-b border-accent bg-transparent text-[14px] text-ink outline-none"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => pick(s.id)}
                  aria-current={active ? "true" : undefined}
                  className="flex h-11 min-w-0 flex-1 items-center gap-3 px-3 text-left"
                >
                  <span
                    aria-hidden
                    className={`h-[5px] w-[5px] shrink-0 rounded-full ${active ? "bg-accent" : "bg-transparent"}`}
                  />
                  <span
                    className={`truncate text-[14px] ${active ? "text-ink" : "text-ink-2"}`}
                  >
                    {s.name}
                  </span>
                  <span className="ml-auto shrink-0 font-mono text-[11px] text-ink-3 tnum">
                    {count}
                  </span>
                </button>
              )}
              {renaming !== s.id && (
                <span className="flex shrink-0 items-center pr-1 opacity-50 transition-opacity duration-150 ease-out focus-within:opacity-100 group-hover:opacity-100">
                  <IconButton
                    size="sm"
                    label={`Rename ${s.name}`}
                    onClick={() => {
                      setDraftName(s.name);
                      setRenaming(s.id);
                    }}
                  >
                    <PencilIcon />
                  </IconButton>
                  <IconButton
                    size="sm"
                    label={`Delete ${s.name}`}
                    onClick={() => askDelete(s.id)}
                  >
                    <Trash2Icon />
                  </IconButton>
                </span>
              )}
            </li>
          );
        })}
      </ul>
      {lastPage > 0 && (
        <nav
          aria-label="Session pages"
          className="flex items-center justify-between py-3 text-[13px]"
        >
          <button
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
          >
            Previous
          </button>
          <span>
            {currentPage + 1} / {lastPage + 1}
          </span>
          <button
            disabled={currentPage === lastPage}
            onClick={() => setPage(currentPage + 1)}
          >
            Next
          </button>
        </nav>
      )}
      <AnimatePresence initial={false}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15, ease: EASE_OUT }}
          className="mt-3 flex items-center gap-3 border-t border-line pt-3"
        >
          <PlusIcon
            size={14}
            strokeWidth={1.75}
            className="shrink-0 text-ink-3"
            aria-hidden
          />
          <input
            aria-label="New session"
            value={newName}
            placeholder="New session"
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                create();
              }
            }}
            className="h-9 min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-ink-3"
          />

          {newName.trim() && (
            <button
              type="button"
              onClick={create}
              className="inline-flex h-8 shrink-0 items-center gap-2 rounded-[4px] px-2.5 text-[12.5px] text-ink-2 transition-colors duration-150 ease-out hover:bg-hover hover:text-ink"
            >
              Create <span className="font-mono text-[11px] text-ink-3">↵</span>
            </button>
          )}
        </motion.div>
      </AnimatePresence>
    </Sheet>
  );
}
