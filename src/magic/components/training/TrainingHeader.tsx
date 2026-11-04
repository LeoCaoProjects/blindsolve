import React, { useRef, useState, useSyncExternalStore } from 'react';
import { ChevronDownIcon } from 'lucide-react';
import { trainingModes } from '../../data/trainingModes';
import { TrainingSession } from '../../hooks/useTrainingSession';
import { formatTime } from '../../utils/time';
import { Sheet } from '../common/Sheet';

const desktopQuery = '(min-width: 1024px)';
const subscribe = (notify: () => void) => {
  const query = window.matchMedia(desktopQuery);
  query.addEventListener('change', notify);
  return () => query.removeEventListener('change', notify);
};
const desktopSnapshot = () => window.matchMedia(desktopQuery).matches;
const lines = {
  exec: 'Execute physically from given memo',
  guided: 'Full solve with tracing done for you',
  recall: 'Memorise targets, then type them back',
  trace: 'Read a scrambled cube into targets',
};

function SidebarChoice<T extends string>({ label, value, options, onChange, disabled }: {
  label: string; value: T; options: { value: T; label: string }[];
  onChange: (value: T) => void; disabled: boolean;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  return <div className="mt-6 px-3">
    <span className="mb-2 block text-[12px] font-medium text-ink-3">{label}</span>
    <div role="radiogroup" aria-label={label} aria-disabled={disabled || undefined}
      className="inline-flex rounded-md border border-line bg-surface p-0.5"
      onKeyDown={(event) => {
        if (disabled || !['ArrowRight', 'ArrowLeft'].includes(event.key)) return;
        event.preventDefault(); event.stopPropagation();
        const next = (options.findIndex((option) => option.value === value) + (event.key === 'ArrowRight' ? 1 : -1) + options.length) % options.length;
        onChange(options[next].value); refs.current[next]?.focus();
      }}>
      {options.map((option, i) => <button key={option.value} type="button" role="radio"
        ref={(element) => { refs.current[i] = element; }} tabIndex={option.value === value ? 0 : -1}
        aria-checked={option.value === value} disabled={disabled} onClick={() => onChange(option.value)}
        className={`h-7 whitespace-nowrap rounded px-2.5 text-[12px] font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40 ${option.value === value ? 'bg-ink text-bg' : 'text-ink-2 hover:text-ink'}`}>
        {option.label}
      </button>)}
    </div>
  </div>;
}

/** The original Magic Patterns 264px Training sidebar, using production state. */
export function TrainingHeader({ t }: { t: TrainingSession }) {
  const desktop = useSyncExternalStore(subscribe, desktopSnapshot, () => true);
  // Unmount the mobile drawer at the desktop breakpoint, including its focus trap.
  return desktop ? <aside aria-label="Training controls" className="scroll-quiet w-[264px] shrink-0 overflow-y-auto border-r border-line px-4 pb-4 pt-7 [@media(max-height:640px)]:pt-4">
    <h1 className="mb-2 px-3 text-[12px] font-medium text-ink-3">Training</h1>
    <TrainingControls t={t} />
  </aside> : <MobileTrainingControls t={t} />;
}

function MobileTrainingControls({ t }: { t: TrainingSession }) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" aria-label="Training controls" aria-haspopup="dialog" aria-expanded={open}
      onClick={() => setOpen(true)} className="flex h-12 shrink-0 items-center justify-between border-b border-line px-5 text-[14px] font-medium hover:bg-hover">
      {trainingModes.find((mode) => mode.id === t.mode)?.label}<ChevronDownIcon size={16} aria-hidden />
    </button>
    <Sheet open={open} onClose={() => setOpen(false)} label="Training controls" title="Training" width={320}>
      <TrainingControls t={t} />
    </Sheet>
  </>;
}

function TrainingControls({ t }: { t: TrainingSession }) {
  const busy = t.running || t.phase === 'report' || t.phase === 'review';
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  return <>
    <nav aria-label="Drill">
      <div role="radiogroup" aria-label="Drill" aria-disabled={busy || undefined} className="flex flex-col gap-0.5">
        {trainingModes.map((mode, i) => <button key={mode.id} type="button" role="radio" aria-label={mode.label}
          ref={(element) => { refs.current[i] = element; }} aria-checked={mode.id === t.mode} tabIndex={mode.id === t.mode ? 0 : -1}
          disabled={busy} onClick={() => t.setMode(mode.id)}
          onKeyDown={(event) => {
            if (busy || !['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(event.key)) return;
            event.preventDefault(); event.stopPropagation();
            const next = (i + (event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1) + trainingModes.length) % trainingModes.length;
            t.setMode(trainingModes[next].id); refs.current[next]?.focus();
          }}
          className={`rounded-md px-3 py-2.5 text-left transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40 ${mode.id === t.mode ? 'bg-selected' : 'hover:bg-hover'}`}>
          <span className={`block text-[14px] font-medium ${mode.id === t.mode ? 'text-ink' : 'text-ink-2'}`}>{mode.label}</span>
          <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-3">{lines[mode.id]}</span>
        </button>)}
      </div>
    </nav>
    <SidebarChoice label="Pieces" value={t.filter} onChange={t.setFilter} disabled={busy}
      options={[{value:'both',label:'Both'},{value:'edges',label:'Edges'},{value:'corners',label:'Corners'}]} />
    {t.mode === 'exec' && <SidebarChoice label="Show" value={t.display} onChange={t.setDisplay} disabled={busy}
      options={[{value:'letters',label:'Letters'},{value:'words',label:'Words'}]} />}
  </>;
}

export function TrainingClock({ t }: {t: TrainingSession;}) {
  if (t.mode === 'exec') return null;
  if (t.mode === 'guided') {
    const cells: [string, number, boolean][] = [
    ['memo', t.elapsed.memo, t.phase === 'memo'],
    ...(t.phase === 'execution' || t.phase === 'report' || t.phase === 'review' ?
    [['execution', t.elapsed.execution, t.phase === 'execution']] as [string, number, boolean][] : [])];
    return (
      <p className="flex gap-5 font-mono text-[12px] text-ink-3 tnum" role="timer">
        {cells.map(([label, ms, live]) =>
        <span key={label} className={live ? 'text-ink-2' : ''}>
            {label} <span className="ml-1">{formatTime(ms)}</span>
          </span>
        )}
      </p>);
  }
  const cells: [string, number, boolean][] =
  t.mode === 'recall' ?
  [
  ['memo', t.elapsed.memo, t.phase === 'active'],
  ...(t.phase !== 'active' ? [['recall', t.elapsed.recall, t.phase === 'recall']] as [string, number, boolean][] : [])] :

  [[t.mode === 'trace' ? 'trace' : 'memo', t.elapsed.total, t.phase === 'active']];
  return (
    <p className="flex gap-5 font-mono text-[12px] text-ink-3 tnum" role="timer">
      {cells.map(([label, ms, live]) =>
      <span key={label} className={live ? 'text-ink-2' : ''}>
          {label} <span className="ml-1">{formatTime(ms)}</span>
        </span>
      )}
    </p>);

}
