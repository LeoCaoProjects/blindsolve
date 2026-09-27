import React, { useEffect, useId } from 'react';
import { motion } from 'framer-motion';
import { clamp, useElementSize } from '../../../hooks/useElementSize';
import { TrainingSession } from '../../../hooks/useTrainingSession';
import { EASE_OUT, isTypingTarget } from '../../../utils/keyboard';
import { formatTime } from '../../../utils/time';
import { chunkPairs } from '../../../utils/pairs';
import { Cube3D } from '../../cube/Cube3D';
import { ScrambleText } from '../../solve/ScrambleText';
import { SolveTime } from '../../solve/SolveTime';
import { ReviewPanel } from './ReviewPanel';

const LABEL = { corners: 'Corners', edges: 'Edges' } as const;

/**
 * Execution Sprint result, laid out like the Timer's solve details: time and result with the
 * cube beside it, then the scramble and the memo that was on screen. Solved / DNF is self-reported.
 */
export function ExecReview({ t }: {t: TrainingSession;}) {
  const [cubeRef, box] = useElementSize<HTMLDivElement>({ width: 280, height: 280 });
  const cubeSize = clamp(Math.min(box.width, box.height) - 36, 130, 240);
  const dnf = t.report === 'dnf';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.repeat) return;
      if (e.key === 's' || e.key === 'S') t.setExecResult('solved');
      if (e.key === 'd' || e.key === 'D') t.setExecResult('dnf');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [t]);

  return (
    <ReviewPanel
      label="Execution Sprint result"
      onNext={t.next}
      width={780}
      header={
      <div className="grid h-[clamp(200px,34vh,290px)] shrink-0 grid-cols-[minmax(0,1fr)_clamp(150px,32vh,280px)] border-b border-line bg-surface">
          <div className="flex min-w-0 flex-col px-5 py-[clamp(16px,3.5vh,30px)] md:px-9">
            <SolveTime
            time={t.elapsed.total}
            penalty={dnf ? 'dnf' : 'ok'}
            className="mt-1 font-timer text-[clamp(38px,6.5vh,60px)] font-extralight leading-none tracking-[-0.05em] text-ink" />
          
            <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1">
              {[
            ['targets', String(t.targets)],
            ['pairs', String(t.pairCount)],
            ['per target', formatTime(t.elapsed.total / Math.max(1, t.targets))]].
            map(([k, v]) =>
            <div key={k} className="flex items-baseline gap-2">
                  <dt className="text-[11.5px] text-ink-3">{k}</dt>
                  <dd className="font-mono text-[13px] text-ink-2 tnum">{v}</dd>
                </div>
            )}
            </dl>
            <SolvedControl value={t.report} onChange={t.setExecResult} />
          </div>
          <div ref={cubeRef} className="flex min-h-0 items-center justify-center overflow-hidden border-l border-line">
            <Cube3D state={t.challenge.state} size={cubeSize} label="Cube after scramble" />
          </div>
        </div>
      }>
      
      <ScrambleText scramble={t.scramble} animate={false} className="text-[15px] leading-[1.75] text-ink" />
      <div className="mt-8 grid gap-7 border-t border-line pt-7">
        {t.groups.map((g) =>
        <section key={g.piece} className="grid gap-x-6 gap-y-3 md:grid-cols-[72px_minmax(0,1fr)]">
            <h3 className="pt-0.5 text-[12px] text-ink-3">{LABEL[g.piece]}</h3>
            <ExecMemo
            tokens={g.tokens}
            breaks={g.piece === 'corners' ? t.challenge.cornerBreaks : t.challenge.edgeBreaks}
            wordFor={(a, b) => t.wordFor(a, b, g.piece)} />
          
          </section>
        )}
      </div>
    </ReviewPanel>);

}

/** The memo as it was on screen: pairs with their words, cycle breaks marked where they start. */
function ExecMemo({ tokens, breaks, wordFor }: {tokens: string[];breaks: number[];wordFor: (a: string, b: string) => string | undefined;}) {
  if (!tokens.length) return <p className="text-[13px] text-ink-3">Solved</p>;
  return (
    <ol className="flex flex-wrap gap-x-7 gap-y-4">
      {chunkPairs(tokens).map((pair, pi) => {
        const start = pi * 2;
        const breakHere = pair.findIndex((_, j) => breaks.includes(start + j));
        const word = pair.length === 2 ? wordFor(pair[0], pair[1]) : undefined;
        return (
          <li key={pi} className="flex min-w-[2.6ch] flex-col">
            <span className="flex gap-[0.25em] font-mono text-[17px] leading-none tracking-[0.1em] text-ink">
              {pair.map((tok, j) =>
              <span key={j} className="relative">
                  {breakHere === j && <span aria-hidden className="absolute -left-[0.18em] top-[-12%] h-[124%] w-px bg-accent" />}
                  {tok}
                </span>
              )}
            </span>
            <span className="mt-1.5 max-w-[11rem] truncate text-[12.5px] leading-snug text-ink-2">{word ?? '\u00a0'}</span>
            {breakHere !== -1 && <span className="text-[11px] text-accent">cycle break</span>}
          </li>);

      })}
    </ol>);

}

function SolvedControl({ value, onChange }: {value: 'solved' | 'dnf';onChange: (v: 'solved' | 'dnf') => void;}) {
  const id = useId();
  return (
    <div role="radiogroup" aria-label="Result" className="mt-auto inline-flex self-start rounded-[5px] border border-line p-[3px]">
      {(['solved', 'dnf'] as const).map((v) => {
        const active = value === v;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(v)}
            className={`relative h-7 min-w-[64px] rounded-[3px] px-3 font-mono text-[12.5px] transition-colors duration-150 ease-out ${
            active ? 'text-ink' : 'text-ink-3 hover:text-ink-2'}`
            }>
            
            {active &&
            <motion.span layoutId={`exec-${id}`} className="absolute inset-0 rounded-[3px] bg-selected" transition={{ duration: 0.18, ease: EASE_OUT }} />
            }
            <span className="relative">{v === 'solved' ? 'Solved' : 'DNF'}</span>
          </button>);

      })}
    </div>);

}