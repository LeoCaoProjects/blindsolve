import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDownIcon } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { PrimaryButton, QuietButton } from '../components/common/PrimaryButton';
import { ShortcutSheet } from '../components/common/ShortcutSheet';
import { RadioRows, Toggle } from '../components/common/Toggle';
import { AppBar } from '../components/layout/AppBar';
import { AccountSection } from '../components/settings/AccountSection';
import { BackupSection } from '../components/settings/BackupSection';
import { CubeConfigurator } from '../components/settings/CubeConfigurator';
import { SettingsRow, SettingsSection } from '../components/settings/SettingsSection';
import { useAppData } from '../contexts/AppDataContext';
import { settingsSections } from '../data/navigation';
import { useShortcutSheet } from '../hooks/useShortcutSheet';
import { BldSetup, CubeMode, CubeViewPref } from '../types/app';
import { sameView } from '../utils/view';
import { EASE_OUT } from '../utils/keyboard';
import { isSpeffz, speffzScheme } from '../utils/scheme';
import { useScreenInit } from '../useScreenInit';

interface ScreenState {
  section?: string;
  mode?: CubeMode;
  selected?: string;
  dirty?: boolean;
  saveFails?: boolean;
  speffzConfirm?: boolean;
  leaveConfirm?: boolean;
  import?: 'valid' | 'invalid';
  conventions?: boolean;
  draftView?: 'orange';
  signin?: 'merge';
}

export function Settings() {
  const init = useScreenInit() as ScreenState;
  const app = useAppData();
  const navigate = useNavigate();
  const sheet = useShortcutSheet();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [draft, setDraft] = useState<BldSetup>(() =>
  init.dirty ? { ...app.setup, edgeBuffer: 'D1', edgeMethod: 'm2', scheme: { ...app.setup.scheme, U0: 'A', D2: 'Z' } } : app.setup
  );
  const [draftView, setDraftView] = useState<CubeViewPref>(() =>
  init.draftView === 'orange' ? { top: 'white', front: 'orange' } : app.prefs.defaultView
  );
  const [mode, setMode] = useState<CubeMode>(init.mode ?? 'view');
  const [selected, setSelected] = useState<string | null>(init.selected ?? null);
  const [active, setActive] = useState(init.section ?? 'cube');
  const [conventions, setConventions] = useState(!!init.conventions);
  const [speffzConfirm, setSpeffzConfirm] = useState(!!init.speffzConfirm);
  const [pendingNav, setPendingNav] = useState<string | null>(init.leaveConfirm ? '/flashcards' : null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'failed'>('idle');
  const failNext = useRef(!!init.saveFails);

  const dirty = JSON.stringify(draft) !== JSON.stringify(app.setup) || !sameView(draftView, app.prefs.defaultView);
  const patch = (p: Partial<BldSetup>) => setDraft((d) => ({ ...d, ...p }));

  // Guard navigation away from unsaved setup.
  useEffect(() => {
    app.setNavGuard(dirty ? (path: string) => (setPendingNav(path), false) : null);
    return () => app.setNavGuard(null);
  }, [dirty]);

  useEffect(() => {
    if (init.section) document.getElementById(init.section)?.scrollIntoView();
  }, []);

  // Track the section in view.
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive((visible.target as HTMLElement).dataset.section ?? 'cube');
      },
      { root, rootMargin: '0px 0px -65% 0px' }
    );
    root.querySelectorAll('[data-section]').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const save = useCallback(() => {
    setSaveState('saving');
    window.setTimeout(() => {
      if (failNext.current) {
        failNext.current = false;
        setSaveState('failed');
        return;
      }
      app.saveSetup(draft);
      app.setPrefs({ defaultView: draftView });
      setSaveState('idle');
    }, 450);
  }, [app, draft, draftView]);

  const discard = () => {
    setDraft(app.setup);
    setDraftView(app.prefs.defaultView);
    setSaveState('idle');
  };

  const applySpeffz = () => {
    patch({ scheme: speffzScheme(), schemeName: 'Speffz' });
    setSpeffzConfirm(false);
  };

  const leave = (andSave: boolean) => {
    const path = pendingNav;
    if (!path) return;
    if (andSave) {
      app.saveSetup(draft);
      app.setPrefs({ defaultView: draftView });
    } else {
      setDraft(app.setup);
      setDraftView(app.prefs.defaultView);
    }
    app.setNavGuard(null);
    setPendingNav(null);
    navigate(path);
  };

  return (
    <div className="flex min-h-[100dvh] w-full flex-col overflow-x-hidden bg-bg font-sans text-ink">
      <AppBar onShortcuts={sheet.openSheet} />

      <div ref={scrollRef} className="scroll-quiet relative min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto grid max-w-[1180px] gap-10 px-5 md:grid-cols-[180px_minmax(0,1fr)] md:gap-16 md:px-10">
          <nav aria-label="Settings sections" className="sticky top-0 z-10 -mx-5 border-b border-line bg-bg px-5 md:mx-0 md:self-start md:border-0 md:px-0 md:pt-10">
            <ul className="scroll-none flex gap-1 overflow-x-auto py-2 md:flex-col md:gap-0 md:py-0">
              {settingsSections.map((s) =>
              <li key={s.id}>
                  <button
                  type="button"
                  onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth' })}
                  aria-current={active === s.id ? 'true' : undefined}
                  className={`relative whitespace-nowrap rounded-[4px] px-3 py-2 text-left text-[13px] transition-colors duration-150 ease-out md:w-full md:rounded-none md:py-1.5 md:pl-4 ${
                  active === s.id ? 'text-ink' : 'text-ink-3 hover:text-ink-2'}`
                  }>
                  
                    {active === s.id && <span aria-hidden className="absolute bottom-0 left-3 right-3 h-px bg-ink md:inset-y-1.5 md:left-0 md:right-auto md:h-auto md:w-px" />}
                    {s.label}
                  </button>
                </li>
              )}
            </ul>
            <Link to="/setup" className="mt-8 hidden pl-4 text-[12.5px] text-ink-3 transition-colors duration-150 hover:text-ink-2 md:block">
              Run first-use setup
            </Link>
          </nav>

          <div className="min-w-0 pb-28 pt-2 md:pt-10">
            <SettingsSection id="cube" title="Cube & lettering">
              <CubeConfigurator
                setup={draft}
                onChange={patch}
                view={draftView}
                onViewChange={setDraftView}
                mode={mode}
                onModeChange={(m) => {
                  setMode(m);
                  if (m === 'lettering' && !selected) setSelected('U0');
                }}
                selected={selected}
                onSelect={setSelected}
                onUseSpeffz={() => isSpeffz(draft.scheme) ? undefined : setSpeffzConfirm(true)} />
              
            </SettingsSection>

            <SettingsSection id="methods" title="Methods">
              <div className="grid gap-10 md:grid-cols-2">
                <div>
                  <h3 className="text-[12px] text-ink-3">Edges</h3>
                  <RadioRows
                    className="mt-2"
                    name="Edge method"
                    value={draft.edgeMethod}
                    onChange={(edgeMethod) => patch({ edgeMethod })}
                    options={[
                    { value: 'm2', label: 'M2' },
                    { value: 'op', label: 'Old Pochmann' },
                    { value: '3style', label: '3-style' }]
                    } />
                  
                </div>
                <div>
                  <h3 className="text-[12px] text-ink-3">Corners</h3>
                  <RadioRows
                    className="mt-2"
                    name="Corner method"
                    value={draft.cornerMethod}
                    onChange={(cornerMethod) => patch({ cornerMethod })}
                    options={[
                    { value: 'op', label: 'Old Pochmann' },
                    { value: '3style', label: '3-style' }]
                    } />
                  
                </div>
              </div>

              <button
                type="button"
                aria-expanded={conventions}
                onClick={() => setConventions((v) => !v)}
                className="mt-8 flex items-center gap-1.5 text-[13px] text-ink-2 transition-colors duration-150 hover:text-ink">
                
                Memo conventions
                <ChevronDownIcon size={14} strokeWidth={1.75} className={`transition-transform duration-150 ease-out ${conventions ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence initial={false}>
                {conventions &&
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, ease: EASE_OUT }}
                  className="overflow-hidden">
                  
                    <div className="grid gap-10 pt-5 md:grid-cols-2">
                      <div>
                        <h3 className="text-[12px] text-ink-3">Flipped edges</h3>
                        <RadioRows
                        className="mt-2"
                        name="Flipped edges"
                        value={draft.flippedEdges}
                        onChange={(flippedEdges) => patch({ flippedEdges })}
                        options={[
                        { value: 'cycle', label: 'Solve within cycles' },
                        { value: 'separate', label: 'Memo separately, at the end' }]
                        } />
                      
                      </div>
                      <div>
                        <h3 className="text-[12px] text-ink-3">Twisted corners</h3>
                        <RadioRows
                        className="mt-2"
                        name="Twisted corners"
                        value={draft.twistedCorners}
                        onChange={(twistedCorners) => patch({ twistedCorners })}
                        options={[
                        { value: 'cycle', label: 'Solve within cycles' },
                        { value: 'separate', label: 'Memo separately, at the end' }]
                        } />
                      
                      </div>
                    </div>
                  </motion.div>
                }
              </AnimatePresence>
            </SettingsSection>

            <SettingsSection id="pairs" title="Letter pairs">
              <RadioRows
                name="Edge and corner vocabulary"
                value={app.prefs.sharing}
                onChange={(sharing) => app.setPrefs({ sharing })}
                options={[
                { value: 'shared', label: 'One vocabulary for edges and corners', hint: 'Override a pair for either when you need to' },
                { value: 'separate', label: 'Separate vocabularies' }]
                } />
              
            </SettingsSection>

            <SettingsSection id="timer" title="Timer">
              <SettingsRow label="Multiphase timing" hint="Record memo and execution separately">
                <Toggle label="Multiphase timing" checked={app.prefs.multiphase} onChange={(multiphase) => app.setPrefs({ multiphase })} />
              </SettingsRow>
            </SettingsSection>

            <SettingsSection id="account" title="Account & sync">
              <AccountSection initialStep={init.signin} />
            </SettingsSection>

            <SettingsSection id="backup" title="Backup">
              <BackupSection preview={init.import} />
            </SettingsSection>
          </div>
        </div>

        <AnimatePresence>
          {dirty &&
          <motion.div
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 16, opacity: 0 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
            className="sticky bottom-0 z-20 border-t border-line bg-raised"
            role="region"
            aria-label="Unsaved changes">
            
              <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4 px-5 py-3 md:px-10 md:pl-[276px]">
                <span className="flex items-center gap-2.5 text-[13px] text-ink-2" role="status">
                  <span aria-hidden className={`h-[6px] w-[6px] rounded-full ${saveState === 'failed' ? 'bg-accent' : 'bg-ink-2'}`} />
                  {saveState === 'failed' ? 'Couldn’t save — nothing was lost' : 'Unsaved changes'}
                </span>
                <div className="flex items-center gap-2">
                  <QuietButton onClick={discard}>Discard</QuietButton>
                  <PrimaryButton onClick={save} hint="" disabled={saveState === 'saving'}>
                    {saveState === 'saving' ? 'Saving' : saveState === 'failed' ? 'Retry' : 'Save'}
                  </PrimaryButton>
                </div>
              </div>
            </motion.div>
          }
        </AnimatePresence>
      </div>

      <ConfirmDialog
        open={speffzConfirm}
        title="Replace your lettering with Speffz?"
        body="Your custom tokens will be overwritten. Letter pairs are kept."
        onCancel={() => setSpeffzConfirm(false)}
        confirm={{ label: 'Use Speffz', onClick: applySpeffz }} />
      
      <ConfirmDialog
        open={pendingNav !== null}
        title="Save setup changes?"
        body="You changed your lettering or buffers."
        onCancel={() => setPendingNav(null)}
        cancelLabel="Stay"
        secondary={{ label: 'Discard', onClick: () => leave(false) }}
        confirm={{ label: 'Save and leave', onClick: () => leave(true) }} />
      
      <ShortcutSheet open={sheet.open} onClose={sheet.closeSheet} page="timer" />
    </div>);

}
