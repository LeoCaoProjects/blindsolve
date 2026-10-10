import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { PrimaryButton, QuietButton } from '../components/common/PrimaryButton';
import { ShortcutSheet } from '../components/common/ShortcutSheet';
import { RadioRows, Toggle } from '../components/common/Toggle';
import { AppBar } from '../components/layout/AppBar';
import { AccountSection } from '../components/settings/AccountSection';
import { BackupSection } from '../components/settings/BackupSection';
import { CubeConfigurator } from '../components/settings/CubeConfigurator';
import { SecondaryButton, SettingsRow, SettingsSection } from '../components/settings/SettingsSection';
import { FeedbackSheet } from '../components/feedback/FeedbackSheet';
import { FeedbackCategory } from '../types/feedback';
import { magicStickerForPhysical, useAppData } from '../contexts/AppDataContext';
import { settingsSections } from '../data/navigation';
import { useShortcutSheet } from '../hooks/useShortcutSheet';
import { BldSetup, CubeMode, CubeViewPref } from '../types/app';
import { sameView } from '../utils/view';
import { EASE_OUT } from '../utils/keyboard';
import { isSpeffz, speffzScheme } from '../utils/scheme';
import { useScreenInit } from '../useScreenInit.js';
import { useStore } from '../../app/Store';
import { conventionalPhysicalEdgeBuffer } from '../utils/methodBuffers';

interface ScreenState {
  section?: string;
  mode?: CubeMode;
  selected?: string;
  dirty?: boolean;
  saveFails?: boolean;
  speffzConfirm?: boolean;
  leaveConfirm?: boolean;
  import?: 'valid' | 'invalid';
  draftView?: 'orange';
  signin?: 'merge';
  feedback?: FeedbackCategory;
  feedbackFails?: boolean;
  clearAll?: boolean;
}

export function Settings() {
  const init = useScreenInit() as ScreenState;
  const app = useAppData();
  const store = useStore();
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
  const [speffzConfirm, setSpeffzConfirm] = useState(!!init.speffzConfirm);
  const [pendingNav, setPendingNav] = useState<string | null>(init.leaveConfirm ? '/flashcards' : null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'failed'>('idle');
  const saveInFlight = useRef(false);
  const failNext = useRef(!!init.saveFails);
  const [feedbackOpen, setFeedbackOpen] = useState(!!init.feedback);

  const ownerKey = store.user?.id ?? 'guest';
  const dirty = store.ready && (JSON.stringify(draft) !== JSON.stringify(app.setup) || !sameView(draftView, app.prefs.defaultView));
  const patch = (p: Partial<BldSetup>) => setDraft((d) => ({ ...d, ...p }));
  const changeEdgeMethod = (edgeMethod: BldSetup['edgeMethod']) => {
    if (edgeMethod === draft.edgeMethod) return;
    const edgeBuffer = magicStickerForPhysical(conventionalPhysicalEdgeBuffer(edgeMethod, draftView));
    if (!edgeBuffer) throw new Error('Conventional physical buffer has no cube slot');
    patch({ edgeMethod, edgeBuffer });
  };

  // Guard navigation away from unsaved setup.
  useEffect(() => {
    app.setNavGuard(dirty ? (path: string) => (setPendingNav(path), false) : null);
    return () => app.setNavGuard(null);
  }, [dirty]);

  // Reset the editable draft only after the new guest/account workspace is hydrated.
  useEffect(() => {
    if (!store.ready) return;
    setDraft(app.setup);
    setDraftView(app.prefs.defaultView);
    setSaveState('idle');
    setPendingNav(null);
  }, [ownerKey, store.ready]);

  useEffect(() => {
    if (init.section) document.getElementById(init.section)?.scrollIntoView();
  }, []);

  // Track the section in view. The last section wins at the bottom of the page, since a short
  // final section (Support) can never scroll up to the activation line. A nav click holds its
  // choice until the smooth scroll settles, so it isn't overridden on the way.
  const clickLock = useRef<string | null>(null);
  const settleTimer = useRef<number | undefined>(undefined);
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      if (clickLock.current) return;
      const sections = Array.from(root.querySelectorAll<HTMLElement>('[data-section]'));
      if (!sections.length) return;
      if (root.scrollTop + root.clientHeight >= root.scrollHeight - 4) {
        setActive(sections[sections.length - 1].dataset.section ?? 'cube');
        return;
      }
      const line = root.getBoundingClientRect().top + Math.min(160, root.clientHeight * 0.3);
      let current = sections[0];
      sections.forEach((s) => {
        if (s.getBoundingClientRect().top <= line) current = s;
      });
      setActive(current.dataset.section ?? 'cube');
    };
    const onScroll = () => {
      if (clickLock.current) {
        window.clearTimeout(settleTimer.current);
        settleTimer.current = window.setTimeout(() => clickLock.current = null, 160);
        return;
      }
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    root.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.clearTimeout(settleTimer.current);
      root.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  const goToSection = (id: string) => {
    clickLock.current = id;
    setActive(id);
    window.clearTimeout(settleTimer.current);
    // Released after the scroll settles, or straight away if there was nothing to scroll.
    settleTimer.current = window.setTimeout(() => clickLock.current = null, 700);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const save = useCallback(() => {
    if (saveInFlight.current) return;
    saveInFlight.current = true;
    setSaveState('saving');
    if (failNext.current) {
      failNext.current = false;
      saveInFlight.current = false;
      setSaveState('failed');
      return;
    }
    app.saveSetup(draft);
    app.setPrefs({ defaultView: draftView });
    saveInFlight.current = false;
    setSaveState('idle');
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
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-bg font-sans text-ink">
      <AppBar onShortcuts={sheet.openSheet} />

      {!store.ready ?
      <main className="flex min-h-0 flex-1 items-center justify-center px-5" aria-busy="true">
        <p className="text-[13px] text-ink-3" role="status">Loading account settings…</p>
      </main> :

      <div ref={scrollRef} className="scroll-quiet relative min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto grid max-w-[1180px] gap-10 px-5 md:grid-cols-[180px_minmax(0,1fr)] md:gap-16 md:px-10">
          <nav aria-label="Settings sections" className="sticky top-0 z-10 -mx-5 border-b border-line bg-bg px-5 md:mx-0 md:self-start md:border-0 md:px-0 md:pt-10">
            <ul className="scroll-none flex gap-1 overflow-x-auto py-2 md:flex-col md:gap-0 md:py-0">
              {settingsSections.map((s) =>
              <li key={s.id}>
                  <button
                  type="button"
                  onClick={() => goToSection(s.id)}
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
                    onChange={changeEdgeMethod}
                    options={[
                    { value: 'op', label: 'OP' },
                    { value: 'm2', label: 'M2' }]
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
                    { value: 'op', label: 'OP' }]
                    } />
                  
                </div>
              </div>

              <SettingsRow label="Automatically swap M2 targets" hint="Apply M2 target swaps automatically during execution practice and reconstruction">
                <Toggle label="Automatically swap M2 targets" checked={app.prefs.m2SecondTargetSwap} onChange={(m2SecondTargetSwap) => app.setPrefs({ m2SecondTargetSwap })} />
              </SettingsRow>
              <div className="mt-8">
                <RadioRows
                  name="Memo order"
                  value={app.prefs.memoOrder}
                  onChange={(memoOrder) => app.setPrefs({ memoOrder })}
                  options={[
                    { value: 'corners-first', label: 'Corners first' },
                    { value: 'edges-first', label: 'Edges first' }]
                  } />
              </div>
            </SettingsSection>

            <SettingsSection id="timer" title="Timer">
              <SettingsRow label="Show live timer" hint="Show elapsed time while solving">
                <Toggle label="Show live timer" checked={app.prefs.showLiveTimer} onChange={(showLiveTimer) => app.setPrefs({ showLiveTimer })} />
              </SettingsRow>
              <SettingsRow label="Multiphase timing" hint="Record memo and execution separately">
                <Toggle label="Multiphase timing" checked={app.prefs.multiphase} onChange={(multiphase) => app.setPrefs({ multiphase })} />
              </SettingsRow>
            </SettingsSection>

            <SettingsSection id="account" title="Account & sync">
              <AccountSection initialStep={init.signin} />
            </SettingsSection>

            <SettingsSection id="backup" title="Data">
              <BackupSection preview={init.import} />
              <ClearAllPairs openInitially={!!init.clearAll} />
            </SettingsSection>

            <SettingsSection id="support" title="Support">
              <SettingsRow label="Give feedback" hint="Report a bug, suggest a feature, or tell us what you think">
                <SecondaryButton onClick={() => setFeedbackOpen(true)}>Give feedback</SecondaryButton>
              </SettingsRow>
              {app.account.role === 'admin' &&
              <SettingsRow label="Feedback inbox" hint={`${app.feedback.filter((f) => f.status === 'new').length} new · admins only`}>
                  <Link
                  to="/admin/feedback"
                  className="inline-flex h-8 items-center rounded-[4px] border border-line-strong px-3 text-[12.5px] text-ink transition-colors duration-150 ease-out hover:bg-hover">

                    Open inbox
                  </Link>
                </SettingsRow>
              }
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
      </div>}

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
      
      <FeedbackSheet
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        failFirst={!!init.feedbackFails}
        initialCategory={init.feedback ?? 'bug'} />

      <ShortcutSheet open={sheet.open} onClose={sheet.closeSheet} page="timer" />
    </div>);

}

/** Deliberately tucked under Data, away from normal editing. */
function ClearAllPairs({ openInitially }: {openInitially: boolean;}) {
  const app = useAppData();
  const [open, setOpen] = useState(openInitially);
  const [notice, setNotice] = useState<string | null>(null);
  const count = Object.keys(app.pairs).length;
  return (
    <div className="mt-8 border-t border-line pt-5">
      <SettingsRow label="Clear all letter pairs" hint="Removes every saved mnemonic. Export a backup first if you might want them back.">
        <button
          type="button"
          disabled={count === 0}
          onClick={() => setOpen(true)}
          className="inline-flex h-8 items-center rounded-[4px] px-2.5 text-[12.5px] text-ink-3 transition-colors duration-150 ease-out hover:bg-hover hover:text-ink-2 disabled:opacity-40">

          Clear all…
        </button>
      </SettingsRow>
      <p className="h-5 pt-1 text-[12.5px] text-ink-2" role="status">
        {notice}
      </p>
      <ConfirmDialog
        open={open}
        title={`Clear all ${count} saved mnemonic ${count === 1 ? 'entry' : 'entries'}?`}
        body="Every letter pair, alternate and edge or corner override will be removed. This can’t be undone."
        onCancel={() => setOpen(false)}
        confirm={{
          label: 'Clear all',
          tone: 'danger',
          onClick: () => {
            app.replacePairs({});
            setOpen(false);
            setNotice('All letter pairs cleared');
          }
        }} />

    </div>);

}
