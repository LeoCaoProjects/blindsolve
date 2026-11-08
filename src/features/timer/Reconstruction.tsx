import { writeDefaultWords } from "../../magic/utils/pairPersistence";
import { pairKey as logicalPairKey } from "../../magic/utils/pairs";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "../../app/Store";
import { RailCube3D } from "../../components/RailCube3D";
import { targetPairs } from "../../components/MemoStrip";
import type {
  CubeOrbitState,
  LetteringScheme,
  MemoTrace,
  TraceTarget,
} from "../../domain/bld/types";
import { traceMemo } from "../../domain/bld/trace";
import {
  mnemonicMatches,
  pairKey,
  type LetterPair,
} from "../../domain/letterPairs";
import { formatTime, typingTarget } from "../../lib/interaction";
import type { MemoPairSnapshot, SolveRecord } from "../../lib/repository";

type Decision = "keep" | "replace";
type Result = SolveRecord["result"];

export function Reconstruction({
  solve,
  onComplete,
}: {
  solve: SolveRecord;
  onComplete: () => void;
}) {
  const { data, update } = useStore();
  const scheme = solve.schemeSnapshot ?? data.scheme;
  const [state, setState] = useState<CubeOrbitState | null>(null);
  const [trace, setTrace] = useState<MemoTrace | null>(null);
  const [error, setError] = useState("");
  const [choices, setChoices] = useState(solve.cycleBreaks);
  const [result, setResult] = useState<Result>(solve.result);
  const [words, setWords] = useState<Record<string, string>>({});
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [wordIndex, setWordIndex] = useState(0);
  const [optionFocus, setOptionFocus] = useState(0);
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    return () => previous?.focus();
  }, []);

  useEffect(() => {
    let active = true;
    import("../../domain/bld/cubing")
      .then((module) =>
        module.scrambleToState(solve.scramble),
      )
      .then((cube) => {
        if (!active) return;
        setState(cube);
        setTrace(traceMemo(cube, scheme, choices));
      })
      .catch((reason) => active && setError((reason as Error).message));
    return () => {
      active = false;
    };
  }, [choices, scheme, solve.scramble]);

  const pending = trace
    ? trace.corners.status === "cycle-break"
      ? "corners"
      : trace.edges.status === "cycle-break"
        ? "edges"
        : null
    : null;
  const groupedPairs = useMemo(
    () => ({
      corners: trace ? targetPairs(trace.corners.targets) : [],
      edges: trace ? targetPairs(trace.edges.targets) : [],
    }),
    [trace],
  );
  const completePairs = useMemo(
    () =>
      [...groupedPairs.corners, ...groupedPairs.edges].filter(
        (pair) => pair.second,
      ),
    [groupedPairs],
  );
  const unknownPairs = useMemo(() => {
    const seen = new Set<string>();
    return (["corners", "edges"] as const).flatMap((kind) => groupedPairs[kind].flatMap((item) => {
      if (!item.second) return [];
      const key = pairKey(item.first.stickerId, item.second.stickerId);
      if (seen.has(key) || data.pairs[key]) return [];
      seen.add(key);
      return [{ item, kind }];
    }));
  }, [data.pairs, groupedPairs]);
  const activeUnknown = !pending ? unknownPairs[wordIndex] : undefined;
  const reviewing = !pending && !activeUnknown && !!trace;
  const breakCount = choices.corners.length + choices.edges.length;
  const totalSteps = Math.max(1, breakCount + (pending ? 1 : 0) + unknownPairs.length + 1);
  const stepIndex = Math.min(totalSteps - 1, breakCount + Math.min(wordIndex, unknownPairs.length));

  useEffect(() => {
    if (pending || !trace) return;
    setWords((current) => {
      const next = { ...current };
      for (const item of completePairs) {
        const second = item.second!;
        const key = pairKey(item.first.stickerId, second.stickerId);
        if (!(key in next))
          next[key] = data.pairs[key]?.primaryMnemonic ?? "";
      }
      return next;
    });
  }, [completePairs, data.pairs, pending, trace]);

  useEffect(() => setOptionFocus(0), [pending]);

  const chooseBreak = (kind: "edges" | "corners", id: string) => {
    if (!state) return;
    const nextChoices = { ...choices, [kind]: [...choices[kind], id] };
    setChoices(nextChoices);
    setTrace(traceMemo(state, scheme, nextChoices));
    update((workspace) => ({
      ...workspace,
      solves: workspace.solves.map((item) =>
        item.id === solve.id
          ? {
              ...item,
              cycleBreaks: nextChoices,
              updatedAt: new Date().toISOString(),
            }
          : item,
      ),
    }));
  };

  const save = () => {
    if (!trace || pending) return;
    const snapshots = {
      corners: snapshotPairs(groupedPairs.corners, words),
      edges: snapshotPairs(groupedPairs.edges, words),
    };
    const now = new Date().toISOString();
    update((workspace) => {
      const defaultWords: Record<string,string> = {};
      const visited = new Set<string>();
      for (const item of completePairs) {
        const second = item.second!;
        const key = pairKey(item.first.stickerId, second.stickerId);
        if (visited.has(key)) continue;
        visited.add(key);
        const used = words[key]?.trim() ?? "";
        const existing = workspace.pairs[key];
        if (used && (!existing || (!mnemonicMatches(used, existing) && decisions[key] === "replace"))) {
          defaultWords[logicalPairKey(item.first.token, second.token)] = used;
        }
      }
      return {
        ...writeDefaultWords(workspace,defaultWords,now),
        solves: workspace.solves.map((item) =>
          item.id === solve.id
            ? {
                ...item,
                result,
                edgeMemo: trace.edges.targets.map((target) => target.token),
                cornerMemo: trace.corners.targets.map(
                  (target) => target.token,
                ),
                cycleBreaks: choices,
                memoSnapshot: snapshots,
                reconstruction: "complete",
                engineVersion: 3,
                updatedAt: now,
              }
            : item,
        ),
      };
    });
    onComplete();
  };

  const advanceWord = () => setWordIndex((index) => Math.min(index + 1, unknownPairs.length));
  const back = () => setWordIndex((index) => Math.max(0, index - 1));
  const focusedBreak = pending ? trace?.[pending].validCycleBreaks[optionFocus] : undefined;
  const primary = () => {
    if (pending && focusedBreak) chooseBreak(pending, focusedBreak);
    else if (activeUnknown) advanceWord();
    else save();
  };

  const keyHandler = (event: React.KeyboardEvent) => {
    event.stopPropagation();
    if (!typingTarget(event.target)) {
      if (event.key === "1") setResult("success");
      if (event.key === "2") setResult("+2");
      if (event.key === "3") setResult("dnf");
      if (pending && trace) {
        const options = trace[pending].validCycleBreaks;
        if (event.key === "ArrowRight" || event.key === "ArrowDown") {
          event.preventDefault();
          setOptionFocus((index) => (index + 1) % options.length);
        } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
          event.preventDefault();
          setOptionFocus((index) => (index - 1 + options.length) % options.length);
        } else {
          const byToken = options.find((id) => scheme.stickers[id].label.toLocaleLowerCase() === event.key.toLocaleLowerCase());
          if (byToken) chooseBreak(pending, byToken);
        }
      }
    }
    if (event.key === "Escape") {
      event.preventDefault();
      if (!pending && trace) save();
    }
    if (event.key === "Enter" && !typingTarget(event.target)) {
      event.preventDefault();
      primary();
    }
    if (event.key !== "Tab") return;
    const nodes = [
      ...event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])',
      ),
    ].filter((node) => node.getClientRects().length > 0);
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };

  return (
    <motion.div className="workspace-drawer-layer" initial={{ opacity: 1 }} exit={{ opacity: 1 }}>
      <motion.div className="workspace-drawer-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease: "easeOut" }} />
      <motion.section
        ref={dialog}
        className="workspace-drawer workspace-reconstruction"
        role="dialog"
        aria-modal="true"
        aria-label="Memo reconstruction"
        tabIndex={-1}
        onKeyDown={keyHandler}
        initial={{ x: 32, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 24, opacity: 0 }}
        transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
      >
        <div className="workspace-recon-head">
          <div className="workspace-recon-summary">
            <p>{formatTime(solve.totalMs)}</p>
            {solve.multiphase && result !== "dnf" && <ReconSplit memo={solve.memoMs} total={solve.totalMs} />}
            <ResultPicker value={result} onChange={setResult} />
          </div>
          <div className="workspace-recon-cube">
            <RailCube3D
              scramble={solve.scramble}
              scheme={scheme}
              size={260}
              label="Cube at the start of memo"
              highlight={pending && trace ? {
                type: pending === "corners" ? "corner" : "edge",
                stickerIds: trace[pending].validCycleBreaks,
                focused: focusedBreak,
                onPick: (id) => chooseBreak(pending, id),
              } : undefined}
            />
          </div>
        </div>
        <section className="workspace-recon-work">
          <div className="recon-progress" aria-hidden="true">
            {Array.from({ length: totalSteps }).map((_, index) => <span key={index} className={index < stepIndex ? "done" : index === stepIndex ? "current" : ""} />)}
          </div>
          <div className="recon-scroll">
            <AnimatePresence mode="wait" initial={false}>
            <motion.div key={error ? "error" : !trace ? "loading" : pending ? `break-${pending}-${breakCount}` : activeUnknown ? `word-${wordIndex}` : "review"} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -6 }} transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}>
            {error ? (
              <div role="alert" className="inline-error">
                <p>Memo reconstruction failed: {error}</p>
                <button
                  onClick={() => {
                    setError("");
                    setChoices({ edges: [], corners: [] });
                  }}
                >
                  Retry tracing
                </button>
              </div>
            ) : !trace ? (
              <p role="status" className="recon-loading">
                Tracing stickers…
              </p>
            ) : pending ? (
              <CycleBreakStep
                kind={pending}
                trace={trace}
                scheme={scheme}
                focused={focusedBreak}
                onChoose={(id) => chooseBreak(pending, id)}
              />
            ) : activeUnknown ? (
              <WordStep
                item={activeUnknown.item}
                targets={trace[activeUnknown.kind].targets}
                value={words[pairKey(activeUnknown.item.first.stickerId, activeUnknown.item.second!.stickerId)] ?? ""}
                onChange={(value) => setWords((current) => ({ ...current, [pairKey(activeUnknown.item.first.stickerId, activeUnknown.item.second!.stickerId)]: value }))}
                onContinue={advanceWord}
              />
            ) : (
              <MemoReview
                groups={groupedPairs}
                pairs={data.pairs}
                words={words}
                decisions={decisions}
                setWord={(key, value) =>
                  setWords((current) => ({ ...current, [key]: value }))
                }
                setDecision={(key, value) =>
                  setDecisions((current) => ({ ...current, [key]: value }))
                }
              />
            )}
            </motion.div>
            </AnimatePresence>
          </div>
          <footer className="recon-footer">
            {!reviewing ? <button className="rail-quiet" onClick={save} disabled={!!pending}>Skip to save</button> : <span />}
            <div>
              {wordIndex > 0 && !pending && <button className="rail-quiet" onClick={back}>Back</button>}
              {trace && <button className="rail-primary" disabled={pending ? !focusedBreak : false} onClick={primary}>{reviewing ? "Save solve" : "Continue"}<small>↵</small></button>}
            </div>
          </footer>
        </section>
      </motion.section>
    </motion.div>
  );
}

function ReconSplit({ memo, total }: { memo: number; total: number }) {
  const execution = Math.max(0, total - memo);
  const percent = total ? Math.min(100, Math.max(0, (memo / total) * 100)) : 0;
  return <div className="workspace-recon-split">
    <div><span>{formatTime(memo)}</span><span>{formatTime(execution)}</span></div>
    <i aria-hidden><b style={{ width: `${percent}%` }} /><b /></i>
  </div>;
}

function ResultPicker({
  value,
  onChange,
}: {
  value: Result;
  onChange: (value: Result) => void;
}) {
  const id = useId();
  const options: Array<[Result, string]> = [
    ["success", "OK"],
    ["+2", "+2"],
    ["dnf", "DNF"],
  ];
  return (
    <div className="result-picker" role="radiogroup" aria-label="Result">
      {options.map(([option, label], index) => (
        <button
          type="button"
          role="radio"
          aria-checked={value === option}
          key={option}
          onClick={() => onChange(option)}
        >
          {value === option && <motion.span className="result-active" layoutId={`result-${id}`} transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }} />}
          <span className="result-label">{label}</span>
          <span className="sr-only">, key {index + 1}</span>
        </button>
      ))}
    </div>
  );
}

function CycleBreakStep({
  kind,
  trace,
  scheme,
  focused,
  onChoose,
}: {
  kind: "edges" | "corners";
  trace: MemoTrace;
  scheme: LetteringScheme;
  focused?: string;
  onChoose: (id: string) => void;
}) {
  const current = trace[kind];
  return (
    <div className="cycle-break-step">
      <h2>{kind === "corners" ? "Corner" : "Edge"} cycle break</h2>
      <p>Which sticker did you start the new cycle on?</p>
      <MemoSequence targets={current.targets} pending />
      <div
        className="cycle-token-list"
        role="group"
        aria-label="Cycle break stickers"
      >
        {current.validCycleBreaks.map((id) => (
          <button key={id} role="radio" aria-checked={false} className={focused === id ? "focused" : ""} onClick={() => onChoose(id)}>
            {scheme.stickers[id].label}
          </button>
        ))}
      </div>
    </div>
  );
}

function WordStep({ item, targets, value, onChange, onContinue }: { item: ReturnType<typeof targetPairs>[number]; targets: TraceTarget[]; value: string; onChange: (value: string) => void; onContinue: () => void }) {
  const pair = `${item.first.token}${item.second!.token}`;
  return <div className="word-step">
    <MemoSequence targets={targets} activeKey={pairKey(item.first.stickerId, item.second!.stickerId)} />
    <form onSubmit={(event) => { event.preventDefault(); onContinue(); }}>
      <strong>{pair}</strong>
      <input autoFocus aria-label={`Word you used for ${pair}`} value={value} onChange={(event) => onChange(event.target.value)} placeholder="the image you used" />
      <div><span>Not in your letter pairs yet</span><button type="button" onClick={onContinue}>Skip</button></div>
    </form>
  </div>;
}

function MemoReview({
  groups,
  pairs,
  words,
  decisions,
  setWord,
  setDecision,
}: {
  groups: Record<"corners" | "edges", ReturnType<typeof targetPairs>>;
  pairs: Record<string, LetterPair>;
  words: Record<string, string>;
  decisions: Record<string, Decision>;
  setWord: (key: string, value: string) => void;
  setDecision: (key: string, value: Decision) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <div className="memo-review">
      {(["corners", "edges"] as const).map((kind) => (
        <section className="memo-review-row" key={kind}>
          <h3>{kind === "corners" ? "Corners" : "Edges"}</h3>
          <ol className="memo-trace">
            {groups[kind].map((item, index) => {
              if (!item.second)
                return (
                  <li
                    className="memo-trace-pair trailing-target"
                    key={`${kind}-${index}`}
                  >
                    <strong>{item.first.token}</strong>
                    <span>trailing target</span>
                  </li>
                );
              const key = pairKey(
                item.first.stickerId,
                item.second.stickerId,
              );
              const stored = pairs[key];
              const used = words[key] ?? "";
              const changed =
                !!stored?.primaryMnemonic &&
                !!used.trim() &&
                !mnemonicMatches(used, stored);
              return (
                <li className="memo-trace-pair" key={`${kind}-${key}-${index}`}>
                  <strong>{item.first.token}{item.second.token}</strong>
                  {editing === key ? <input autoFocus aria-label={`${item.first.token} ${item.second.token} word used`} value={used} placeholder="add word" onFocus={(event) => event.currentTarget.select()} onChange={(event) => setWord(key, event.target.value)} onBlur={() => setEditing(null)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); setEditing(null); } if (event.key === "Escape") { event.preventDefault(); setEditing(null); } }} /> : <button type="button" title="Edit the word you used" onClick={() => setEditing(key)}>{used || <span>add word</span>}{!stored && used.trim() && <small aria-label="new pair">+</small>}</button>}
                  {changed && (
                    <div className="mnemonic-decision">
                      <span>{stored.primaryMnemonic} <i>→</i> <b>{used}</b></span>
                      <div
                        role="radiogroup"
                        aria-label={`${item.first.token} ${item.second.token} database action`}
                      >
                        {(
                          [
                            ["keep", `Keep ${stored.primaryMnemonic}`],
                            ["replace", `Use ${used}`],
                          ] as Array<[Decision, string]>
                        ).map(([choice, label]) => (
                          <button
                            type="button"
                            role="radio"
                            aria-checked={
                              (decisions[key] ?? "keep") === choice
                            }
                            key={choice}
                            onClick={() => setDecision(key, choice)}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      ))}
      {groups.corners.concat(groups.edges).some((item) => item.second && !pairs[pairKey(item.first.stickerId, item.second.stickerId)] && words[pairKey(item.first.stickerId, item.second.stickerId)]?.trim()) && <p className="new-pairs-note"><span>+</span> New words join your letter pairs</p>}
    </div>
  );
}

function MemoSequence({ targets, pending = false, activeKey }: { targets: TraceTarget[]; pending?: boolean; activeKey?: string }) {
  const pairs = targetPairs(targets);
  return (
    <div
      className="target-token-line"
      aria-label={targets.map((target) => target.token).join(" ")}
    >
      {pairs.map((item, index) => {
        const key = item.second ? pairKey(item.first.stickerId, item.second.stickerId) : item.first.stickerId;
        return <span className={key === activeKey ? "active" : ""} key={`${key}-${index}`}>{item.first.token}{item.second?.token ?? ""}</span>;
      })}
      {pending && <><span className="pending-pair" aria-label="cycle break pending"><i />·</span><span className="future-pair">··</span><span className="future-pair">··</span></>}
    </div>
  );
}

function snapshotPairs(
  items: ReturnType<typeof targetPairs>,
  words: Record<string, string>,
): MemoPairSnapshot[] {
  return items.map((item) => {
    const second = item.second;
    return {
      firstStickerId: item.first.stickerId,
      ...(second ? { secondStickerId: second.stickerId } : {}),
      firstToken: item.first.token,
      ...(second ? { secondToken: second.token } : {}),
      ...(item.first.cycleBreak ? { firstCycleBreak: true } : {}),
      ...(second?.cycleBreak ? { secondCycleBreak: true } : {}),
      mnemonic: second
        ? (words[
            pairKey(item.first.stickerId, second.stickerId)
          ]?.trim() ?? "")
        : "",
    };
  });
}
