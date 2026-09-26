import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { PrimaryButton, QuietButton } from '../components/common/PrimaryButton';
import { RadioRows } from '../components/common/Toggle';
import { SchemeCube } from '../components/cube/SchemeCube';
import { StepTicks } from '../components/reconstruction/StepTicks';
import { BufferPanel } from '../components/settings/BufferPanel';
import { StickerEditor } from '../components/settings/StickerEditor';
import { defaultSetup, useAppData } from '../contexts/AppDataContext';
import { useElementWidth } from '../hooks/useElementWidth';
import { BldSetup, CubeMode } from '../types/app';
import { EASE_OUT } from '../utils/keyboard';
import { REFERENCE_COLORS, isSpeffz, speffzScheme, stickerById } from '../utils/scheme';
import { useScreenInit } from '../useScreenInit';

type Step = 'lettering' | 'edge' | 'corner' | 'done';
const STEPS: Step[] = ['lettering', 'edge', 'corner', 'done'];
const TITLES: Record<Step, string> = {
  lettering: 'Lettering',
  edge: 'Edge buffer',
  corner: 'Corner buffer',
  done: 'Ready'
};

/** First use: lettering and buffers only. Scrambles are fixed to white top, green front. */
export function Setup() {
  const init = useScreenInit() as {step?: Step;custom?: boolean;};
  const app = useAppData();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>(init.step && STEPS.includes(init.step) ? init.step : 'lettering');
  const [custom, setCustom] = useState(!!init.custom);
  const [draft, setDraft] = useState<BldSetup>(defaultSetup());
  const [selected, setSelected] = useState<string>('U0');
  const [stageRef, stageWidth] = useElementWidth<HTMLDivElement>(700);

  const index = STEPS.indexOf(step);
  const colors = REFERENCE_COLORS;
  const patch = (p: Partial<BldSetup>) => setDraft((d) => ({ ...d, ...p }));
  const mode: CubeMode =
  step === 'lettering' ? custom ? 'lettering' : 'view' : step === 'edge' ? 'edge-buffer' : step === 'corner' ? 'corner-buffer' : 'view';

  const finish = (setup: BldSetup) => {
    app.saveSetup(setup);
    navigate('/');
  };

  const next = () => step === 'done' ? finish(draft) : setStep(STEPS[index + 1]);

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-bg font-sans text-ink">
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-line pl-5 pr-3 md:pl-8">
        <div className="flex items-center gap-6">
          <span className="text-[12.5px] text-ink">Setup</span>
          <StepTicks total={STEPS.length} index={index} />
        </div>
        <div className="flex items-center gap-1">
          <Link
            to="/signin"
            className="inline-flex h-7 items-center rounded-[4px] px-2.5 text-[12.5px] text-ink-3 transition-colors duration-150 ease-out hover:bg-hover hover:text-ink-2">
            
            Sign in
          </Link>
          <button
            type="button"
            onClick={() => finish(defaultSetup())}
            className="inline-flex h-7 items-center rounded-[4px] px-2.5 text-[12.5px] text-ink-2 transition-colors duration-150 ease-out hover:bg-hover hover:text-ink">
            
            Use defaults
          </button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1fr)_440px] lg:grid-rows-1">
        <div ref={stageRef} className="flex min-h-0 items-center justify-center">
          <SchemeCube
            scheme={draft.scheme}
            colors={colors}
            size={Math.max(220, Math.min(460, stageWidth - 64))}
            mode={mode}
            selected={mode === 'lettering' ? selected : null}
            edgeBuffer={draft.edgeBuffer}
            cornerBuffer={draft.cornerBuffer}
            showBuffers={step !== 'lettering'}
            onPick={(id) => {
              if (mode === 'lettering') setSelected(id);
              if (mode === 'edge-buffer') patch({ edgeBuffer: id });
              if (mode === 'corner-buffer') patch({ cornerBuffer: id });
            }}
            label="Your cube" />
          
        </div>

        <aside className="flex min-h-0 flex-col border-t border-line bg-surface lg:border-l lg:border-t-0">
          <div className="scroll-quiet min-h-0 flex-1 overflow-y-auto px-6 py-7 md:px-8 md:py-9">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={{ duration: 0.16, ease: EASE_OUT }}>
                
                <h1 className="text-[19px] font-medium text-ink">{TITLES[step]}</h1>

                {step === 'lettering' &&
                <div className="mt-6">
                    <RadioRows
                    name="Lettering"
                    value={custom ? 'custom' : 'speffz'}
                    onChange={(v) => {
                      setCustom(v === 'custom');
                      if (v === 'speffz') patch({ scheme: speffzScheme(), schemeName: 'Speffz' });
                    }}
                    options={[
                    { value: 'speffz', label: 'Speffz', hint: 'A–X, the standard scheme' },
                    { value: 'custom', label: 'Custom', hint: 'Label stickers yourself' }]
                    } />
                  
                    {custom &&
                  <div className="mt-8 border-t border-line pt-6">
                        <StickerEditor
                      scheme={draft.scheme}
                      colors={colors}
                      selected={selected}
                      onSelect={setSelected}
                      onChange={(id, token) => patch({ scheme: { ...draft.scheme, [id]: token }, schemeName: 'Custom' })} />
                    
                      </div>
                  }
                  </div>
                }
                {step === 'edge' &&
                <div className="mt-6">
                    <BufferPanel type="edge" setup={draft} colors={colors} onSet={(id) => patch({ edgeBuffer: id })} />
                  </div>
                }
                {step === 'corner' &&
                <div className="mt-6">
                    <BufferPanel type="corner" setup={draft} colors={colors} onSet={(id) => patch({ cornerBuffer: id })} />
                  </div>
                }
                {step === 'done' &&
                <dl className="mt-6 grid grid-cols-[1fr_auto] gap-y-3 text-[13.5px]">
                    <dt className="text-ink-3">Lettering</dt>
                    <dd className="text-right text-ink">{isSpeffz(draft.scheme) ? 'Speffz' : 'Custom'}</dd>
                    <dt className="text-ink-3">Buffers</dt>
                    <dd className="text-right font-mono text-ink">
                      {stickerById(draft.edgeBuffer).piece} · {stickerById(draft.cornerBuffer).piece}
                    </dd>
                    <dt className="text-ink-3">Scrambles</dt>
                    <dd className="text-right text-ink">White top · Green front</dd>
                    <dd className="col-span-2 mt-4 text-[12.5px] text-ink-3">Change any of this, and how cubes face you, in Settings.</dd>
                  </dl>
                }
              </motion.div>
            </AnimatePresence>
          </div>
          <footer className="flex shrink-0 items-center justify-between border-t border-line px-6 py-3.5">
            {index > 0 ? <QuietButton onClick={() => setStep(STEPS[index - 1])}>Back</QuietButton> : <span />}
            <PrimaryButton onClick={next}>{step === 'done' ? 'Start timing' : 'Continue'}</PrimaryButton>
          </footer>
        </aside>
      </div>
    </div>);

}
