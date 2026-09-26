import React, { useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import { TrainingSession } from '../../hooks/useTrainingSession';
import { formatTime } from '../../utils/time';
import { fullPairs } from '../../utils/training';
import { ChallengeCubes } from './ChallengeCubes';
import { FullMemoReview } from './FullMemoReview';
import { Fade } from './MemoRecallWorkspace';
import { TrainingIdle } from './TrainingIdle';
import { WordChainInput } from './WordChainInput';

const LABEL = { corners: 'Corners', edges: 'Edges' } as const;

/** Trace the cube and write the memo as words. Pairs are only revealed at review. */
export function FullMemoWorkspace({ t, cubeSize }: {t: TrainingSession;cubeSize: number;}) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const multi = t.groups.length > 1;
  const pairCount = t.groups.reduce((n, g) => n + fullPairs(g.tokens).length, 0);

  if (t.phase === 'idle') {
    return (
      <Fade key="idle">
        <TrainingIdle hold={t.hold.phase} />
      </Fade>);

  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ChallengeCubes state={t.challenge.state} size={t.phase === 'review' ? Math.round(cubeSize * 0.62) : cubeSize} className="shrink-0 py-2" />
      <div className="scroll-quiet mt-4 min-h-0 flex-1 overflow-y-auto pb-4 md:pl-14">
        <AnimatePresence mode="wait" initial={false}>
          {t.phase === 'active' ?
          <Fade key={`full-${t.challenge.seed}`} className="grid max-w-[880px] gap-6">
              {t.groups.map((g, gi) =>
            <section key={g.piece}>
                  {multi && <h2 className="mb-2 text-[12px] text-ink-3">{LABEL[g.piece]}</h2>}
                  <WordChainInput
                ref={(el) => { inputRefs.current[gi] = el; }}
                autoFocus={gi === 0}
                label={`${LABEL[g.piece]} memo`}
                words={t.words[gi] ?? []}
                onChange={(w) => t.setGroupWords(gi, w)}
                onAdvance={() => gi < t.groups.length - 1 ? inputRefs.current[gi + 1]?.focus() : t.submit()} />
              
                </section>
            )}
            </Fade> :

          <Fade key="review" className="max-w-[880px]">
              <p className="flex flex-wrap items-baseline gap-x-5 gap-y-1 font-mono text-[13px] text-ink-2 tnum">
                <span className="font-timer text-[34px] font-extralight tracking-[-0.03em] text-ink">{formatTime(t.elapsed.total)}</span>
                <span className="text-ink-3">{formatTime(t.elapsed.total / Math.max(1, pairCount))} / pair</span>
                <span className="text-ink-3">{pairCount} pairs</span>
              </p>
              <div className="mt-6 grid gap-7">
                {t.groups.map((g, gi) =>
              <FullMemoReview key={g.piece} piece={g.piece} tokens={g.tokens} entered={t.words[gi] ?? []} showLabel={multi} />
              )}
              </div>
            </Fade>
          }
        </AnimatePresence>
      </div>
    </div>);

}
