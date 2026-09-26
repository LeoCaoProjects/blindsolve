import React, { useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppData } from '../../contexts/AppDataContext';
import { TrainingSession } from '../../hooks/useTrainingSession';
import { EASE_OUT } from '../../utils/keyboard';
import { pairKey, resolveWords } from '../../utils/pairs';
import { PairWords } from '../memo/PairWords';
import { RecallInput } from '../memo/RecallInput';
import { SequenceView } from '../memo/SequenceView';
import { ResultHeadline } from './ResultHeadline';
import { SequenceDiff } from './SequenceDiff';
import { TrainingIdle } from './TrainingIdle';

const LABEL = { corners: 'Corners', edges: 'Edges' } as const;

/** Study the memo traced from the cube at right, then recall it. */
export function MemoRecallWorkspace({ t }: {t: TrainingSession;}) {
  const { pairs, prefs, addWord } = useAppData();
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const wordFor = (piece: 'corners' | 'edges') => (a: string, b: string) => resolveWords(pairs[pairKey(a, b)], piece, prefs.sharing).words[0];
  const multi = t.groups.length > 1;

  return (
    <AnimatePresence mode="wait" initial={false}>
      {t.phase === 'idle' &&
      <Fade key="idle">
          <TrainingIdle hold={t.hold.phase} />
        </Fade>
      }

      {t.phase === 'active' &&
      <Fade key={`study-${t.challenge.seed}`} className="grid gap-10 md:pl-14">
          {t.groups.map((g) =>
        <section key={g.piece}>
              {multi && <h2 className="mb-3 text-[12px] text-ink-3">{LABEL[g.piece]}</h2>}
              <SequenceView tokens={g.tokens} size="xl" />
            </section>
        )}
        </Fade>
      }

      {t.phase === 'recall' &&
      <Fade key="recall" className="grid max-w-[880px] gap-10 md:pl-14">
          {t.groups.map((g, gi) =>
        <section key={g.piece}>
              {multi && <h2 className="mb-3 text-[12px] text-ink-3">{LABEL[g.piece]}</h2>}
              <RecallInput
            ref={(el) => { inputRefs.current[gi] = el; }}
            autoFocus={gi === 0}
            label={`Recall ${LABEL[g.piece].toLowerCase()}`}
            tokens={t.vocabulary}
            value={t.inputs[gi] ?? ''}
            onChange={(v) => t.setInput(gi, v)}
            onEnter={() => gi < t.groups.length - 1 ? inputRefs.current[gi + 1]?.focus() : t.submit()} />
          
            </section>
        )}
        </Fade>
      }

      {t.phase === 'review' &&
      <Fade key="review" className="md:pl-14">
          <ResultHeadline results={t.results} />
          <div className="mt-9 grid gap-9">
            {t.results.map((g) =>
          <section key={g.piece} className="grid gap-4 md:grid-cols-[72px_minmax(0,1fr)]">
                <h2 className="pt-1 text-[12px] text-ink-3">{LABEL[g.piece]}</h2>
                <div>
                  {!g.correct &&
              <div className="mb-5">
                      <SequenceDiff result={g} />
                    </div>
              }
                  <PairWords tokens={g.actual} wordFor={wordFor(g.piece)} onAdd={(a, b, w) => addWord(pairKey(a, b), g.piece, w)} />
                </div>
              </section>
          )}
          </div>
        </Fade>
      }
    </AnimatePresence>);

}

export function Fade({ children, className = '' }: {children: React.ReactNode;className?: string;}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.14, ease: EASE_OUT }}
      className={className}>
      
      {children}
    </motion.div>);

}
