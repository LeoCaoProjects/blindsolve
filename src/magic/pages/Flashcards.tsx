import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRightIcon, CheckIcon, XIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Kbd } from '../components/common/Kbd';
import { Segmented } from '../components/common/Segmented';
import { ShortcutSheet } from '../components/common/ShortcutSheet';
import { SchemeCube } from '../components/cube/SchemeCube';
import { AppBar } from '../components/layout/AppBar';
import { PairTokens } from '../components/pairs/PairTokens';
import { SessionReadout } from '../components/practice/SessionReadout';
import { useAppData } from '../contexts/AppDataContext';
import { CardPhase, CardScope, useFlashcards } from '../hooks/useFlashcards';
import { useShortcutSheet } from '../hooks/useShortcutSheet';
import { EASE_OUT } from '../utils/keyboard';
import { splitKey } from '../utils/pairs';
import { REFERENCE_COLORS } from '../utils/scheme';
import { useScreenInit } from '../useScreenInit';

interface ScreenState {
  scope?: CardScope;
  card?: string;
  phase?: CardPhase;
}

export function Flashcards() {
  const init = useScreenInit() as ScreenState;
  const { setup } = useAppData();
  const sheet = useShortcutSheet();
  const f = useFlashcards(init);
  const colors = REFERENCE_COLORS;
  const revealed = f.phase !== 'question';

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-bg font-sans text-ink">
      <AppBar onShortcuts={sheet.openSheet} />

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_392px]">
        <main className="flex min-w-0 flex-col">
          <section className="flex items-center gap-6 border-b border-line px-5 py-5 md:px-10">
            <span className="hidden w-8 shrink-0 font-mono text-[11px] text-ink-3 tnum md:block">#{f.stats.seen + 1}</span>
            <Segmented
              label="Practise"
              value={f.scope}
              onChange={f.setScope}
              options={[
              { value: 'all', label: 'All' },
              { value: 'edges', label: 'Edges' },
              { value: 'corners', label: 'Corners' }]
              } />
            
            <span className="ml-auto font-mono text-[11.5px] text-ink-3 tnum">{f.eligibleCount} pairs</span>
          </section>

          {!f.card || !f.cardTokens ?
          <EmptyState scope={f.scope} /> :

          <>
              <div className="flex min-h-0 flex-1 flex-col justify-center px-5 md:px-10">
                <div className="md:pl-14">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                    key={f.card}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.14, ease: EASE_OUT }}>
                    
                      <PairTokens
                      first={f.cardTokens[0]}
                      second={f.cardTokens[1]}
                      className="block font-timer text-[112px] font-extralight leading-[0.9] tracking-[0.02em] text-ink md:text-[176px]" />
                    
                    </motion.div>
                  </AnimatePresence>

                  <div className="mt-8 min-h-[112px]">
                    {f.phase === 'question' &&
                  <button
                    type="button"
                    onClick={f.reveal}
                    className="inline-flex h-11 items-center gap-3 rounded-[4px] border border-line-strong px-4 text-[14px] text-ink-2 transition-colors duration-150 ease-out hover:bg-hover hover:text-ink">
                    
                        Reveal
                        <Kbd>Space</Kbd>
                      </button>
                  }
                    {f.phase === 'revealed' &&
                  <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.16, ease: EASE_OUT }}>
                        <p className="text-[40px] leading-tight text-ink md:text-[52px]">{f.words[0]}</p>
                        {f.words.length > 1 && <p className="mt-2 text-[15px] text-ink-3">{f.words.slice(1).join(' · ')}</p>}
                      </motion.div>
                  }
                    {(f.phase === 'editing' || f.phase === 'adding') &&
                  <InlineWordInput
                    key={f.phase}
                    initial={f.phase === 'editing' ? f.words[0] ?? '' : ''}
                    placeholder={f.phase === 'editing' ? 'Mnemonic' : 'Add alternate'}
                    large={f.phase === 'editing'}
                    above={f.phase === 'adding' ? f.words[0] : undefined}
                    onSubmit={f.phase === 'editing' ? f.editPrimary : f.addAlternate}
                    onCancel={() => f.setPhase('revealed')} />

                  }
                  </div>
                </div>
              </div>

              <section className="flex shrink-0 flex-wrap items-center gap-2 border-t border-line px-5 py-4 md:px-10 md:pl-24">
                {revealed ?
              <>
                    <button
                  type="button"
                  onClick={() => f.next('remembered')}
                  disabled={f.phase !== 'revealed'}
                  className="inline-flex h-11 items-center gap-3 rounded-[4px] bg-ink px-4 text-[13.5px] font-medium text-bg transition-opacity duration-150 ease-out hover:opacity-90 disabled:opacity-30">
                  
                      Remembered
                      <span className="font-mono text-[11px] opacity-50">↵</span>
                    </button>
                    <button
                  type="button"
                  onClick={() => f.next('forgot')}
                  disabled={f.phase !== 'revealed'}
                  className="inline-flex h-11 items-center gap-3 rounded-[4px] border border-line-strong px-4 text-[13.5px] text-ink transition-colors duration-150 ease-out hover:bg-hover disabled:opacity-30">
                  
                      Forgot
                      <span className="font-mono text-[11px] text-ink-3">F</span>
                    </button>
                    <span className="mx-2 hidden h-5 w-px bg-line md:block" />
                    <button
                  type="button"
                  onClick={() => f.setPhase('editing')}
                  className="inline-flex h-11 items-center gap-2 rounded-[4px] px-3 text-[13px] text-ink-3 transition-colors duration-150 ease-out hover:bg-hover hover:text-ink-2">
                  
                      Edit <span className="font-mono text-[11px]">E</span>
                    </button>
                    <button
                  type="button"
                  onClick={() => f.setPhase('adding')}
                  className="inline-flex h-11 items-center gap-2 rounded-[4px] px-3 text-[13px] text-ink-3 transition-colors duration-150 ease-out hover:bg-hover hover:text-ink-2">
                  
                      Add alternate <span className="font-mono text-[11px]">A</span>
                    </button>
                  </> :

              <span className="h-11" />
              }
              </section>
            </>
          }
        </main>

        <aside className="hidden min-h-0 flex-col border-l border-line bg-surface lg:flex">
          <div className="flex h-[330px] shrink-0 items-center justify-center border-b border-line">
            <SchemeCube
              scheme={setup.scheme}
              colors={colors}
              size={260}
              mode="static"
              highlightTokens={f.cardTokens ?? []}
              highlightType={f.scope === 'edges' ? 'edge' : f.scope === 'corners' ? 'corner' : null}
              label="Where the pair sits on the cube" />
            
          </div>
          <SessionReadout
            cells={[
            ['cards', String(f.stats.seen)],
            ['remembered', String(f.stats.remembered)],
            ['forgot', String(f.stats.forgot)]]
            } />
          
          <ol aria-label="Recent cards" className="scroll-quiet grid min-h-0 flex-1 auto-rows-min grid-cols-2 overflow-y-auto py-2">
            <AnimatePresence initial={false}>
              {f.log.map((entry) => {
                const [a, b] = splitKey(entry.key);
                const forgot = entry.result === 'forgot';
                return (
                  <motion.li key={entry.id} layout="position" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2, ease: EASE_OUT }}>
                    <button
                      type="button"
                      onClick={() => f.review(entry.key)}
                      className="grid w-full grid-cols-[34px_1fr_auto] items-center gap-2 px-5 py-[7px] text-left transition-colors duration-150 ease-out hover:bg-hover">
                      
                      <PairTokens first={a} second={b} className={`text-[13.5px] tracking-[0.08em] ${forgot ? 'text-ink' : 'text-ink-2'}`} />
                      <span className="truncate text-[12px] text-ink-3">{f.wordsForKey(entry.key)[0]}</span>
                      {forgot ?
                      <XIcon size={13} className="text-accent" aria-label="forgot" /> :

                      <CheckIcon size={13} className="text-ink-3" aria-label="remembered" />
                      }
                    </button>
                  </motion.li>);

              })}
            </AnimatePresence>
          </ol>
        </aside>
      </div>
      <ShortcutSheet open={sheet.open} onClose={sheet.closeSheet} page="flashcards" />
    </div>);

}

function InlineWordInput({
  initial,
  placeholder,
  large,
  above,
  onSubmit,
  onCancel







}: {initial: string;placeholder: string;large: boolean;above?: string;onSubmit: (w: string) => void;onCancel: () => void;}) {
  const [value, setValue] = useState(initial);
  return (
    <div>
      {above && <p className="mb-3 text-[40px] leading-tight text-ink-2 md:text-[52px]">{above}</p>}
      <input
        autoFocus
        aria-label={placeholder}
        value={value}
        placeholder={placeholder}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onSubmit(value);
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
          }
        }}
        className={`w-full max-w-[640px] border-b border-accent bg-transparent pb-1 text-ink outline-none placeholder:text-ink-3 ${
        large ? 'text-[40px] md:text-[52px]' : 'text-[20px]'}`
        } />
      
      <p className="mt-3 flex gap-4 text-[12.5px] text-ink-3">
        <button type="button" onClick={() => onSubmit(value)} className="transition-colors duration-150 hover:text-ink-2">
          Save
        </button>
        <button type="button" onClick={onCancel} className="transition-colors duration-150 hover:text-ink-2">
          Cancel
        </button>
      </p>
    </div>);

}

function EmptyState({ scope }: {scope: CardScope;}) {
  return (
    <div className="flex flex-1 flex-col justify-center px-5 md:px-10 md:pl-24">
      <p className="text-[22px] text-ink">{scope === 'all' ? 'No pairs yet' : `No ${scope === 'edges' ? 'edge' : 'corner'} pairs yet`}</p>
      <Link
        to="/pairs"
        className="mt-3 inline-flex w-fit items-center gap-2 text-[14px] text-ink-2 transition-colors duration-150 ease-out hover:text-ink">
        
        Add your first mnemonic
        <ArrowRightIcon size={14} strokeWidth={1.75} />
      </Link>
    </div>);

}
