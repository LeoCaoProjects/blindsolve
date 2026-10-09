import React from 'react';
import { ChevronDownIcon } from 'lucide-react';
import { trainingModes } from '../../data/trainingModes';
import { TrainingSession } from '../../hooks/useTrainingSession';
import { formatTime } from '../../utils/time';
import { OptionGroup } from '../common/OptionGroup';
import { ScopeTabs } from '../common/ScopeTabs';
import { Segmented } from '../common/Segmented';

/**
 * Two kinds of control, styled as two kinds of thing:
 * the drill (text tabs, left) is navigation; Pieces and Show (small framed switches, right) are settings.
 * While an attempt runs the settings step aside for the clock.
 */
export function TrainingHeader({ t }: {t: TrainingSession;}) {
  const busy = t.running || t.phase === 'report' || t.phase === 'review';
  return (
    <section className="flex shrink-0 flex-wrap items-center gap-x-8 gap-y-1 border-b border-line px-5 py-1.5 md:px-10">
      <nav aria-label="Drill" className={`min-w-0 transition-opacity duration-300 ease-out ${busy ? 'opacity-40' : ''}`}>
        <div className="hidden sm:block">
          <Segmented
            label="Drill"
            value={t.mode}
            onChange={t.setMode}
            options={trainingModes.map((m) => ({ value: m.id, label: m.label, disabled: busy }))} />
          
        </div>
        <label className="relative sm:hidden">
          <span className="sr-only">Drill</span>
          <select
            value={t.mode}
            disabled={busy}
            onChange={(e) => t.setMode(e.target.value as typeof t.mode)}
            className="h-10 appearance-none bg-transparent pr-6 text-[14px] text-ink outline-none">
            
            {trainingModes.map((m) =>
            <option key={m.id} value={m.id} className="bg-raised">
                {m.label}
              </option>
            )}
          </select>
          <ChevronDownIcon size={14} className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden />
        </label>
      </nav>

      <div className="ml-auto flex min-h-[40px] items-center gap-6">
        {busy ?
        <Clock t={t} /> :

        <>
            <ScopeTabs value={t.filter} onChange={t.setFilter} />
            {t.mode === 'exec' &&
          <OptionGroup
            label="Show"
            value={t.display}
            onChange={t.setDisplay}
            options={[
            { value: 'letters', label: 'Letters' },
            { value: 'words', label: 'Words' }]
            } />

          }
          </>
        }
      </div>
    </section>);

}

function Clock({ t }: {t: TrainingSession;}) {
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
