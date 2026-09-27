import React, { useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { ArrowLeftIcon, ChevronDownIcon, SearchIcon } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { Segmented } from '../components/common/Segmented';
import { ShortcutSheet } from '../components/common/ShortcutSheet';
import { FeedbackDetail } from '../components/feedback/FeedbackDetail';
import { FeedbackList } from '../components/feedback/FeedbackList';
import { AppBar } from '../components/layout/AppBar';
import { useAppData } from '../contexts/AppDataContext';
import { useShortcutSheet } from '../hooks/useShortcutSheet';
import { FeedbackCategory, FeedbackStatus, STATUS_LABEL, STATUS_ORDER } from '../types/feedback';
import { useScreenInit } from '../useScreenInit.js';

type CategoryFilter = 'all' | FeedbackCategory;
type StatusFilter = 'active' | 'all' | FeedbackStatus;

interface ScreenState {
  open?: string;
  category?: CategoryFilter;
  status?: StatusFilter;
}

const CATEGORY_NOUN: Record<CategoryFilter, string> = { all: 'feedback', bug: 'bugs', feature: 'feature requests', general: 'general feedback' };

/**
 * Admin-only feedback inbox. Not in the navigation; reached from Settings when the account has
 * the admin role. The redirect below is presentation only: the server is what refuses
 * non-admins access to feedback data.
 */
export function FeedbackInbox() {
  const init = useScreenInit() as ScreenState;
  const { account, feedback } = useAppData();
  const sheet = useShortcutSheet();
  const [category, setCategory] = useState<CategoryFilter>(init.category ?? 'all');
  const [status, setStatus] = useState<StatusFilter>(init.status ?? 'active');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(init.open ?? null);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return feedback.filter((f) => {
      if (category !== 'all' && f.category !== category) return false;
      if (status === 'active' ? f.status === 'archived' : status !== 'all' && f.status !== status) return false;
      if (!q) return true;
      return [f.message, f.contact, f.user?.name, f.user?.detail, f.source].some((v) => v?.toLowerCase().includes(q));
    });
  }, [feedback, category, status, query]);

  if (account.role !== 'admin') return <Navigate to="/settings" replace />;

  const newCount = feedback.filter((f) => f.status === 'new').length;
  const open = feedback.find((f) => f.id === openId);
  const emptyLabel = query.trim() ?
  'Nothing matches that search.' :
  `No ${status === 'active' || status === 'all' ? '' : `${STATUS_LABEL[status].toLowerCase()} `}${CATEGORY_NOUN[category]}.`;

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-bg font-sans text-ink">
      <AppBar onShortcuts={sheet.openSheet} />

      <main className="flex min-h-0 flex-1 flex-col">
        <header className="shrink-0 px-5 pt-[clamp(14px,3vh,28px)] md:px-10">
          <Link to="/settings" className="inline-flex items-center gap-1.5 text-[12px] text-ink-3 transition-colors duration-150 hover:text-ink-2">
            <ArrowLeftIcon size={12} aria-hidden />
            Settings
          </Link>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h1 className="text-[20px] text-ink">Feedback</h1>
            <span className="text-[12.5px] text-ink-3">
              {newCount > 0 ? `${newCount} new` : 'Nothing new'} · Admin
            </span>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-line pb-2">
            <Segmented
              label="Type"
              size="sm"
              value={category}
              onChange={setCategory}
              options={[
              { value: 'all', label: 'All' },
              { value: 'bug', label: 'Bugs' },
              { value: 'feature', label: 'Feature requests' },
              { value: 'general', label: 'General' }]
              } />
            
            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center">
                <span className="sr-only">Status</span>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as StatusFilter)}
                  className="h-8 appearance-none rounded-[4px] border border-line bg-transparent pl-2.5 pr-7 text-[12.5px] text-ink-2 outline-none transition-colors duration-150 hover:bg-hover focus:border-ink-3">
                  
                  <option value="active">Open (not archived)</option>
                  {STATUS_ORDER.map((s) =>
                  <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  )}
                  <option value="all">Everything</option>
                </select>
                <ChevronDownIcon size={13} className="pointer-events-none absolute right-2 text-ink-3" aria-hidden />
              </label>
              <label className="relative inline-flex items-center">
                <SearchIcon size={13} className="pointer-events-none absolute left-2 text-ink-3" aria-hidden />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search"
                  aria-label="Search feedback"
                  className="h-8 w-[clamp(120px,16vw,200px)] rounded-[4px] border border-line bg-transparent pl-7 pr-2 text-[12.5px] text-ink outline-none transition-colors duration-150 placeholder:text-ink-3 focus:border-ink-3" />
                
              </label>
            </div>
          </div>
        </header>

        <div className="scroll-quiet min-h-0 flex-1 overflow-y-auto px-2 pb-10 pt-2 md:px-7">
          {feedback.length === 0 ?
          <p className="px-3 py-6 text-[13px] text-ink-3">No feedback yet.</p> :
          shown.length === 0 ?
          <p className="px-3 py-6 text-[13px] text-ink-3">{emptyLabel}</p> :

          <FeedbackList items={shown} onOpen={setOpenId} />
          }
        </div>
      </main>

      <AnimatePresence>{open && <FeedbackDetail key={open.id} item={open} onClose={() => setOpenId(null)} />}</AnimatePresence>
      <ShortcutSheet open={sheet.open} onClose={sheet.closeSheet} page="timer" />
    </div>);

}