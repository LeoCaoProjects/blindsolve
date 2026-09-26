import React, { useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import { TrainingSession } from '../../hooks/useTrainingSession';
import { formatTime } from '../../utils/time';
import { RecallInput } from '../memo/RecallInput';
import { ChallengeCubes } from './ChallengeCubes';
import { Fade } from './MemoRecallWorkspace';
import { ResultHeadline } from './ResultHeadline';
import { SequenceDiff } from './SequenceDiff';
import { TrainingIdle } from './TrainingIdle';

const LABEL = { corners: 'Corners', edges: 'Edges' } as const;

/** Read the cube, type the targets. Speed of recognition and tracing, not memory. */
export function TraceSprintWorkspace({ t, cubeSize }: {t: TrainingSession;cubeSize: number;}) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const multi = t.groups.length > 1;
  const typedCorrect = t.results.reduce((n, g) => n + g.actual.length - Math.min(g.wrong, g.actual.length), 0);

  if (t.phase === 'idle') {
    return (
      <Fade key="idle">
        <TrainingIdle hold={t.hold.phase} />
      </Fade>);

  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ChallengeCubes state={t.challenge.state} size={t.phase === 'review' ? Math.round(cubeSize * 0.72) : cubeSize} className="shrink-0 py-2" />
      <div className="scroll-quiet mt-4 min-h-0 flex-1 overflow-y-auto md:pl-14">
        <AnimatePresence mode="wait" initial={false}>
          {t.phase === 'active' ?
          <Fade key={`trace-${t.challenge.seed}`} className="grid max-w-[880px] gap-6">
              {t.groups.map((g, gi) =>
            <section key={g.piece}>
                  {multi && <h2 className="mb-2 text-[12px] text-ink-3">{LABEL[g.piece]}</h2>}
                  <RecallInput
                ref={(el) => { inputRefs.current[gi] = el; }}
                compact
                autoFocus={gi === 0}
                label={`${LABEL[g.piece]} targets`}
                tokens={t.vocabulary}
                value={t.inputs[gi] ?? ''}
                onChange={(v) => t.setInput(gi, v)}
                onEnter={() => gi < t.groups.length - 1 ? inputRefs.current[gi + 1]?.focus() : t.submit()} />
              
                </section>
            )}
            </Fade> :

          <Fade key="review">
              <ResultHeadline results={t.results}>
                <span className="font-mono text-[13px] text-ink-2 tnum">
                  {formatTime(t.elapsed.total)}
                  <span className="ml-3 text-ink-3">{formatTime(t.elapsed.total / Math.max(1, t.targets))} / target</span>
                  <span className="ml-3 text-ink-3">
                    {typedCorrect}/{t.targets}
                  </span>
                </span>
              </ResultHeadline>
              <div className="mt-7 grid gap-7">
                {t.results.map((g) =>
              <section key={g.piece} className="grid gap-3 md:grid-cols-[72px_minmax(0,1fr)]">
                    <h2 className="pt-1 text-[12px] text-ink-3">{LABEL[g.piece]}</h2>
                    <SequenceDiff result={g} />
                  </section>
              )}
              </div>
            </Fade>
          }
        </AnimatePresence>
      </div>
    </div>);

}
