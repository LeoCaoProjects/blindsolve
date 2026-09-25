import {
  CaseSensitive,
  ChevronDownIcon,
  Keyboard,
  RefreshCw,
  Settings2Icon,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { useStore } from "../app/Store";
import { RailCube3D } from "../components/RailCube3D";
import { LeaveGuard } from "../components/LeaveGuard";
import { memoPairs, pairKey } from "../domain/letterPairs";
import { ClockFace } from "../features/timer/ClockFace";
import { Reconstruction } from "../features/timer/Reconstruction";
import { formatTime, typingTarget } from "../lib/interaction";
import type { MemoPairSnapshot, SolveRecord } from "../lib/repository";

type Phase = "idle" | "armed" | "ready" | "memo" | "execution" | "running" | "stopped";
type Timing = { started: number; memoAt: number; stopped: number };

const navigation = [
  ["/", "Timer"],
  ["/pairs", "Letter Pairs"],
  ["/flashcards", "Flashcards"],
  ["/memo", "Memo Trainer"],
] as const;

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

export default function TimerPage() {
  const { data, update, setFocus, notify } = useStore();
  const [scramble, setScramble] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [timing, setTiming] = useState<Timing>({
    started: 0,
    memoAt: 0,
    stopped: 0,
  });
  const [reconstructId, setReconstructId] = useState<string | null>(() =>
    data.solves.find(
      (solve) => !solve.deleted && solve.reconstruction === "pending",
    )?.id ?? null,
  );
  const [reconstructionDelay, setReconstructionDelay] = useState(false);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [showLetters, setShowLetters] = useState(false);
  const [undo, setUndo] = useState<SolveRecord | null>(null);
  const phaseRef = useRef<Phase>("idle");
  const timeRef = useRef<Timing>(timing);
  const generation = useRef(0);
  const pendingScheme = useRef(data.scheme);
  const holdTimer = useRef<number | undefined>(undefined);
  const restPhase = useRef<Phase>("idle");
  const releaseLock = useRef(false);
  const running = phase === "memo" || phase === "execution" || phase === "running";
  const overlayOpen =
    !!reconstructId ||
    reconstructionDelay ||
    !!detailsId ||
    shortcutsOpen;

  const nextScramble = async () => {
    if (running) return;
    const sequence = ++generation.current;
    setLoading(true);
    setError("");
    try {
      const module = await import("../domain/bld/cubing");
      const algorithm = await module.generateBlindScramble();
      if (sequence !== generation.current) return;
      setScramble(algorithm);
      phaseRef.current = "idle";
      setPhase("idle");
      const reset = { started: 0, memoAt: 0, stopped: 0 };
      timeRef.current = reset;
      setTiming(reset);
    } catch (reason) {
      setError(`Scramble unavailable: ${(reason as Error).message}`);
    } finally {
      if (sequence === generation.current) setLoading(false);
    }
  };

  useEffect(() => {
    void nextScramble();
    return () => {
      generation.current += 1;
      window.clearTimeout(holdTimer.current);
      setFocus(false);
    };
    // The first scramble is intentionally generated once per Timer mount.
  }, []);

  const stopSolve = (now: number) => {
    const multiphase = phaseRef.current === "execution";
    timeRef.current = { ...timeRef.current, stopped: now };
    phaseRef.current = "stopped";
    setFocus(false);
    const totalMs = Math.round(now - timeRef.current.started);
    const memoMs = multiphase
      ? Math.round(timeRef.current.memoAt - timeRef.current.started)
      : 0;
    const stamp = new Date().toISOString();
    const solve: SolveRecord = {
      id: crypto.randomUUID(),
      scramble,
      memoMs,
      executionMs: totalMs - memoMs,
      totalMs,
      result: "success",
      edgeMemo: [],
      cornerMemo: [],
      cycleBreaks: { edges: [], corners: [] },
      createdAt: stamp,
      updatedAt: stamp,
      schemeSnapshot: pendingScheme.current,
      reconstruction: "pending",
      engineVersion: 3,
      multiphase,
    };
    update((workspace) => ({
      ...workspace,
      solves: [solve, ...workspace.solves],
    }));
    setReconstructionDelay(true);
    window.setTimeout(() => {
      setReconstructId(solve.id);
      setReconstructionDelay(false);
    }, 520);
    setTiming(timeRef.current);
    setPhase("stopped");
  };

  const press = () => {
    if (loading || !scramble || overlayOpen) return;
    const now = performance.now();
    if (phaseRef.current === "memo") {
      timeRef.current = { ...timeRef.current, memoAt: now };
      phaseRef.current = "execution";
      releaseLock.current = true;
    } else if (
      phaseRef.current === "execution" ||
      phaseRef.current === "running"
    ) {
      releaseLock.current = true;
      stopSolve(now);
      return;
    } else if (!releaseLock.current && (phaseRef.current === "idle" || phaseRef.current === "stopped")) {
      restPhase.current = phaseRef.current;
      phaseRef.current = "armed";
      window.clearTimeout(holdTimer.current);
      holdTimer.current = window.setTimeout(() => {
        phaseRef.current = "ready";
        setPhase("ready");
      }, 280);
    } else return;
    setTiming(timeRef.current);
    setPhase(phaseRef.current);
  };
  const release = () => {
    if (releaseLock.current) {
      releaseLock.current = false;
      return;
    }
    if (phaseRef.current === "armed") {
      window.clearTimeout(holdTimer.current);
      phaseRef.current = restPhase.current;
      setPhase(restPhase.current);
      return;
    }
    if (phaseRef.current !== "ready") return;
    const now = performance.now();
    pendingScheme.current = structuredClone(data.scheme);
    timeRef.current = { started: now, memoAt: 0, stopped: 0 };
    phaseRef.current = data.multiphaseTiming ? "memo" : "running";
    setFocus(true);
    setTiming(timeRef.current);
    setPhase(phaseRef.current);
  };
  const pressRef = useRef(press);
  pressRef.current = press;
  const releaseRef = useRef(release);
  releaseRef.current = release;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey)
        return;
      if (event.key === "?" && !typingTarget(event.target)) {
        event.preventDefault();
        if (!overlayOpen) setShortcutsOpen(true);
        return;
      }
      if (shortcutsOpen && event.key === "Escape") {
        event.preventDefault();
        setShortcutsOpen(false);
        return;
      }
      if ((event.key === "n" || event.key === "N") && !typingTarget(event.target)) {
        if (!overlayOpen && !running) void nextScramble();
        return;
      }
      if (event.code !== "Space" || typingTarget(event.target) || overlayOpen)
        return;
      event.preventDefault();
      if (event.repeat) return;
      pressRef.current();
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== "Space" || typingTarget(event.target) || overlayOpen) return;
      event.preventDefault();
      releaseRef.current();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [overlayOpen, running]);

  useEffect(() => {
    if (!running) return;
    const before = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, [running]);

  const solves = data.solves.filter((solve) => !solve.deleted);
  const reconstruction = data.solves.find(
    (solve) => solve.id === reconstructId && !solve.deleted,
  );
  const detail = data.solves.find(
    (solve) => solve.id === detailsId && !solve.deleted,
  );
  const latest = solves.find((solve) => solve.reconstruction === "complete");
  const stats = useMemo(() => sessionStats(solves), [solves]);
  const recede = running ? "recede-running" : phase === "ready" ? "recede-ready" : "";

  const setResult = (id: string, result: SolveRecord["result"]) =>
    update((workspace) => ({
      ...workspace,
      solves: workspace.solves.map((solve) =>
        solve.id === id
          ? { ...solve, result, updatedAt: new Date().toISOString() }
          : solve,
      ),
    }));

  const remove = (solve: SolveRecord) => {
    setUndo(solve);
    update((workspace) => ({
      ...workspace,
      solves: workspace.solves.map((item) =>
        item.id === solve.id
          ? { ...item, deleted: true, updatedAt: new Date().toISOString() }
          : item,
      ),
    }));
    setDetailsId(null);
  };

  return (
    <section className={`timer-page-v1 workspace-page ${running ? "is-running" : ""}`}>
      <LeaveGuard
        active={running}
        title="Leave this solve?"
        message="The timer is still running. Leaving now discards this unfinished solve."
      />
      <WorkspaceBar
        className={recede}
        onShortcuts={() => setShortcutsOpen(true)}
      />
      <div className="workspace-layout">
        <main className="workspace-main">
          <h1 className="sr-only">Timer</h1>
          <section className={`workspace-scramble ${running ? "is-muted" : ""}`} aria-label="Scramble" aria-busy={loading}>
            <span>#{solves.length + 1}</span>
            <p>{loading ? "Generating scramble…" : scramble.split(" ").map((move, index) => <span key={`${move}-${index}`}>{move}</span>)}</p>
            <button type="button" aria-label="New scramble" title="New scramble" disabled={running || loading} onClick={() => void nextScramble()}>
              <RefreshCw size={14} strokeWidth={1.75} /><kbd>N</kbd>
            </button>
            {error && <p className="workspace-scramble-error" role="alert">{error} <button onClick={() => void nextScramble()}>Retry</button></p>}
          </section>
          <div className="workspace-timer-zone">
            <div className={`workspace-readout phase-${phase}`}>
              <ClockFace
                started={phase === "ready" ? 0 : timing.started}
                stopped={timing.stopped}
                running={running}
                onPointerDown={press}
                onPointerUp={release}
                disabled={loading || !scramble || overlayOpen}
                label={phase === "memo" ? "Begin execution" : running ? "Stop timer" : "Start timer"}
              />
              <WorkspacePhase phase={phase} timing={timing} multiphase={data.multiphaseTiming} />
            </div>
          </div>
          {latest && <LatestMemo solve={latest} index={solves.length} onOpen={() => setDetailsId(latest.id)} className={recede} />}
        </main>
        <aside className={`workspace-aside ${recede}`}>
          <div className="workspace-cube">
            <RailCube3D scramble={scramble} scheme={data.scheme} size={272} showLetters={showLetters} />
            <button type="button" aria-label="Sticker letters" title="Sticker letters" aria-pressed={showLetters} onClick={() => setShowLetters((value) => !value)}>
              <CaseSensitive size={15} />
            </button>
          </div>
          <WorkspaceHistory solves={solves} stats={stats} onSelect={setDetailsId} />
        </aside>
        {undo && (
          <div className="timer-toast" role="status">
            Solve removed.
            <button
              onClick={() => {
                update((workspace) => ({
                  ...workspace,
                  solves: workspace.solves.map((solve) =>
                    solve.id === undo.id
                      ? { ...undo, deleted: false, updatedAt: new Date().toISOString() }
                      : solve,
                  ),
                }));
                setUndo(null);
                notify("Solve restored.");
              }}
            >
              Undo
            </button>
          </div>
        )}
      </div>
      <AnimatePresence>
        {reconstruction && (
          <Reconstruction
            key="reconstruction"
            solve={reconstruction}
            onComplete={() => {
              setReconstructId(null);
              void nextScramble();
            }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {detail && (
          <SolveDetails
            key="details"
            index={solves.length - solves.findIndex((item) => item.id === detail.id)}
            solve={detail}
            pairs={data.pairs}
            scheme={detail.schemeSnapshot ?? data.scheme}
            onClose={() => setDetailsId(null)}
            onResult={(result) => setResult(detail.id, result)}
            onDelete={() => remove(detail)}
          />
        )}
      </AnimatePresence>
      <ShortcutSheet open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </section>
  );
}

function WorkspaceBar({
  className,
  onShortcuts,
}: {
  className: string;
  onShortcuts: () => void;
}) {
  return (
    <header className={`workspace-bar ${className}`}>
      <nav aria-label="Sections"><ul>{navigation.map(([path, label]) => (
        <li key={path}><NavLink end to={path}>{label}<span aria-hidden /></NavLink></li>
      ))}</ul></nav>
      <div>
        <button type="button" className="workspace-session">3BLD · Today <ChevronDownIcon size={13} strokeWidth={1.75} /></button>
        <button type="button" className="workspace-icon-button" aria-label="Keyboard shortcuts" title="Keyboard shortcuts  ?" onClick={onShortcuts}><Keyboard size={15} strokeWidth={1.5} /></button>
        <NavLink className="workspace-icon-button" to="/settings" aria-label="Settings" title="Settings"><Settings2Icon size={15} strokeWidth={1.5} /></NavLink>
      </div>
    </header>
  );
}

type Stats = ReturnType<typeof sessionStats>;
function WorkspaceHistory({
  solves,
  stats,
  onSelect,
}: {
  solves: SolveRecord[];
  stats: Stats;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="workspace-history">
      <dl>{[["best", stats.best], ["mo3", stats.mo3], ["success", stats.success]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
      <ol aria-label="Solves">
        <AnimatePresence initial={false}>
        {solves.map((solve, index) => (
          <motion.li key={solve.id} layout="position" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease: EASE_OUT }}>
            <button onClick={() => onSelect(solve.id)} className={index === 0 ? "is-latest" : ""}>
              <span>{solves.length - index}</span>
              <SolveTime solve={solve} showRaw={false} />
            </button>
          </motion.li>
        ))}
        </AnimatePresence>
      </ol>
    </div>
  );
}

function SolveTime({ solve, large = false, showRaw = true }: { solve: SolveRecord; large?: boolean; showRaw?: boolean }) {
  const raw = formatTime(solve.totalMs);
  if (solve.result === "dnf")
    return <strong className={large ? "large" : ""}>DNF {showRaw && <small><span className="sr-only">raw </span>{raw}</small>}</strong>;
  return (
    <strong className={large ? "large" : ""}>
      {formatTime(solve.totalMs + (solve.result === "+2" ? 2000 : 0))}
      {solve.result === "+2" && <small>+2</small>}
    </strong>
  );
}

function WorkspacePhase({ phase, timing, multiphase }: { phase: Phase; timing: Timing; multiphase: boolean }) {
  const live = phase === "memo" || phase === "execution" || phase === "running";
  const memoMs = timing.memoAt ? timing.memoAt - timing.started : 0;
  const totalMs = timing.stopped ? timing.stopped - timing.started : 0;
  const done = phase === "stopped" && memoMs > 0;
  if (!multiphase || (!live && !done)) return <div className="workspace-phase" />;
  const segments = [
    { key: "memo", value: memoMs || null },
    { key: "exec", value: done ? Math.max(0, totalMs - memoMs) : null },
  ];
  return (
    <div className="workspace-phase" aria-live="polite">
      {segments.map((segment) => {
        const active = phase === segment.key || (segment.key === "exec" && phase === "execution");
        return <span key={segment.key} className={active ? "current" : ""}><i />{segment.key}{segment.value !== null && <b>{formatTime(segment.value)}</b>}</span>;
      })}
    </div>
  );
}

function LatestMemo({ solve, index, onOpen, className }: { solve: SolveRecord; index: number; onOpen: () => void; className: string }) {
  const rows = solve.memoSnapshot ?? {
    corners: memoPairs(solve.cornerMemo).map((pair, pairIndex) => ({ firstStickerId: `corner-${pairIndex}-a`, secondStickerId: pair.second ? `corner-${pairIndex}-b` : undefined, firstToken: pair.first, secondToken: pair.second, mnemonic: "" })),
    edges: memoPairs(solve.edgeMemo).map((pair, pairIndex) => ({ firstStickerId: `edge-${pairIndex}-a`, secondStickerId: pair.second ? `edge-${pairIndex}-b` : undefined, firstToken: pair.first, secondToken: pair.second, mnemonic: "" })),
  };
  return <section className={`workspace-latest ${className}`} aria-label="Last solve memo">
    <button type="button" onClick={onOpen}><span>#{index}</span><SolveTime solve={solve} showRaw={false} /></button>
    <WorkspaceMemoTrace items={rows.corners} />
    <WorkspaceMemoTrace items={rows.edges} />
  </section>;
}

function WorkspaceMemoTrace({ items }: { items: MemoPairSnapshot[] }) {
  return <ol className="workspace-memo-trace">{items.map((item, index) => <li key={index}>
    <b><span className={item.firstCycleBreak ? "cycle-break-token" : ""}>{item.firstCycleBreak && <span className="sr-only">cycle break at </span>}{item.firstToken}</span>{item.secondToken && <span className={item.secondCycleBreak ? "cycle-break-token" : ""}>{item.secondCycleBreak && <span className="sr-only">cycle break at </span>}{item.secondToken}</span>}</b>
    <span>{item.mnemonic || "\u00a0"}</span>
  </li>)}</ol>;
}

function SolveDetails({
  index,
  solve,
  pairs,
  scheme,
  onClose,
  onResult,
  onDelete,
}: {
  index: number;
  solve: SolveRecord;
  pairs: ReturnType<typeof useStore>["data"]["pairs"];
  scheme: NonNullable<SolveRecord["schemeSnapshot"]>;
  onClose: () => void;
  onResult: (result: SolveRecord["result"]) => void;
  onDelete: () => void;
}) {
  return (
    <WorkspaceDrawer label={`Solve ${index}`} onClose={onClose} className="workspace-details">
      <div className="workspace-drawer-head">
        <div className="workspace-drawer-summary">
          <p><span>#{index}</span><time dateTime={solve.createdAt}>{formatSolveDate(solve.createdAt)}</time></p>
          <SolveTime solve={solve} large />
          {solve.multiphase && <SplitMeter memo={solve.memoMs} total={solve.totalMs} showLabels className="workspace-detail-split" />}
          <InlineResult value={solve.result} onChange={onResult} />
        </div>
        <div className="workspace-drawer-cube">
          <button aria-label="Close solve details" onClick={onClose}><X size={15} /></button>
          <RailCube3D
            scramble={solve.scramble}
            scheme={scheme}
            size={250}
            label="Cube after scramble"
          />
        </div>
      </div>
      <div className="workspace-details-scroll">
        <p className="workspace-details-scramble" aria-label={`Scramble ${solve.scramble}`}>{solve.scramble.split(/\s+/).map((move, i) => <span key={`${move}-${i}`}>{move}</span>)}</p>
        <div className="workspace-details-memo"><SnapshotRows solve={solve} pairs={pairs} /></div>
      </div>
      <footer className="workspace-drawer-footer"><button onClick={onDelete}>Delete solve</button><span>esc</span></footer>
    </WorkspaceDrawer>
  );
}

function WorkspaceDrawer({ label, onClose, children, className = "" }: { label: string; onClose: () => void; children: ReactNode; className?: string }) {
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    return () => previous?.focus();
  }, []);
  return (
    <motion.div className="workspace-drawer-layer" initial={{ opacity: 1 }} exit={{ opacity: 1 }}>
      <motion.div className="workspace-drawer-scrim" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18, ease: "easeOut" }} />
      <motion.section
        ref={dialog}
        className={`workspace-drawer ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        initial={{ x: 32, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 24, opacity: 0 }}
        transition={{ duration: 0.22, ease: EASE_OUT }}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
          }
          if (event.key !== "Tab") return;
          const nodes = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter((node) => node.getClientRects().length > 0);
          const first = nodes[0], last = nodes[nodes.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }}
      >{children}</motion.section>
    </motion.div>
  );
}

function InlineResult({ value, onChange }: { value: SolveRecord["result"]; onChange: (value: SolveRecord["result"]) => void }) {
  return (
    <div className="result-picker" role="radiogroup" aria-label="Result">
      {([['success', 'OK'], ['+2', '+2'], ['dnf', 'DNF']] as Array<[SolveRecord["result"], string]>).map(([result, label]) => (
        <button key={result} role="radio" aria-checked={value === result} onClick={() => onChange(result)}>{label}</button>
      ))}
    </div>
  );
}

function SnapshotRows({ solve, pairs }: { solve: SolveRecord; pairs: ReturnType<typeof useStore>["data"]["pairs"] }) {
  const snapshot = solve.memoSnapshot;
  const fallback = {
    corners: tokenSnapshots(solve.cornerMemo),
    edges: tokenSnapshots(solve.edgeMemo),
  };
  const rows = snapshot ?? fallback;
  return <>{(["corners", "edges"] as const).map((kind) => (
    <section key={kind}><h3>{kind === "corners" ? "Corners" : "Edges"}</h3><div>{rows[kind].map((item, index) => {
      const current = item.secondStickerId ? pairs[pairKey(item.firstStickerId, item.secondStickerId)]?.primaryMnemonic : "";
      const changed = current && item.mnemonic && current.toLocaleLowerCase() !== item.mnemonic.toLocaleLowerCase();
      return <span className="snapshot-pair" key={`${kind}-${index}`}><b><span className={item.firstCycleBreak ? "cycle-break-token" : ""}>{item.firstCycleBreak && <span className="sr-only">cycle break at </span>}{item.firstToken}</span>{item.secondToken && <span className={item.secondCycleBreak ? "cycle-break-token" : ""}>{item.secondCycleBreak && <span className="sr-only">cycle break at </span>}{item.secondToken}</span>}</b><em>{item.mnemonic || (item.secondToken ? "—" : "trailing target")}</em>{changed && <small>now {current}</small>}</span>;
    })}</div></section>
  ))}</>;
}

function tokenSnapshots(tokens: string[]): MemoPairSnapshot[] {
  return memoPairs(tokens).map((pair, index) => ({ firstStickerId: `legacy-${index}-a`, ...(pair.second ? { secondStickerId: `legacy-${index}-b` } : {}), firstToken: pair.first, ...(pair.second ? { secondToken: pair.second } : {}), mnemonic: "" }));
}

function adjustedTime(solve: SolveRecord) {
  return solve.totalMs + (solve.result === "+2" ? 2000 : 0);
}

function sessionStats(solves: SolveRecord[]) {
  const successful = solves.filter((solve) => solve.result !== "dnf");
  const best = successful.length ? formatTime(Math.min(...successful.map(adjustedTime))) : "—";
  const lastThree = solves.slice(0, 3);
  const mo3 = lastThree.length < 3 ? "—" : lastThree.some((solve) => solve.result === "dnf") ? "DNF" : formatTime(Math.round(lastThree.reduce((sum, solve) => sum + adjustedTime(solve), 0) / 3));
  return { best, mo3, success: `${successful.length}/${solves.length}` };
}

function SplitMeter({ memo, total, showLabels = false, className = "phase-line" }: { memo: number; total: number; showLabels?: boolean; className?: string }) {
  const execution = Math.max(0, total - memo);
  const percent = total ? Math.min(100, Math.max(0, memo / total * 100)) : 0;
  return <div className={`${className} split-meter`}>
    <div><span>{showLabels ? <small>memo</small> : <span className="sr-only">memo </span>}{formatTime(memo)}</span><span>{showLabels ? <small>exec</small> : <span className="sr-only">execution </span>}{formatTime(execution)}</span></div>
    <i aria-hidden><b style={{ width: `${percent}%` }} /><b /></i>
  </div>;
}

const shortcutRows = [
  [["Space"], "Hold, release to start"],
  [["Space"], "End memo, then stop"],
  [["N"], "New scramble"],
  [["1", "2", "3"], "OK · +2 · DNF"],
  [["A–X"], "Pick cycle-break sticker"],
  [["↵"], "Continue / save"],
  [["Esc"], "Close · save without questions"],
  [["?"], "This sheet"],
] as const;

function ShortcutSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return <AnimatePresence>{open && <motion.div className="timer-scrim shortcut-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
    <div className="timer-scrim-backdrop" onClick={onClose} />
    <motion.div role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" className="shortcut-sheet" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} transition={{ duration: 0.18, ease: EASE_OUT }}>
      <ul>{shortcutRows.map(([keys, label], index) => <li key={index}><span>{label}</span><span>{keys.map((key) => <kbd key={key}>{key}</kbd>)}</span></li>)}</ul>
    </motion.div>
  </motion.div>}</AnimatePresence>;
}

function formatSolveDate(iso: string) {
  const date = new Date(iso);
  const parts = new Intl.DateTimeFormat("en", { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("weekday")} ${value("day")} ${value("month")} ${value("year")} · ${value("hour")}:${value("minute")}`;
}
