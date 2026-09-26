import React from 'react';
import { Loader2Icon } from 'lucide-react';
import { AuthProvider } from '../../types/app';
import { GoogleMark, WcaMark } from './ProviderMarks';

interface ProviderButtonsProps {
  pending: AuthProvider | null;
  onStart: (p: AuthProvider) => void;
  layout?: 'stack' | 'row';
}

/** WCA first and filled; Google second and outlined. Both create an account on first use. */
export function ProviderButtons({ pending, onStart, layout = 'stack' }: ProviderButtonsProps) {
  const busy = pending !== null;
  const row = layout === 'row';
  return (
    <div className={row ? 'flex flex-wrap items-center gap-2' : 'grid gap-2'}>
      <button
        type="button"
        disabled={busy}
        onClick={() => onStart('wca')}
        className={`inline-flex items-center justify-center gap-2.5 rounded-[4px] bg-ink font-medium text-bg transition-opacity duration-150 ease-out hover:opacity-90 disabled:opacity-60 ${
        row ? 'h-8 px-3 text-[12.5px]' : 'h-11 w-full px-4 text-[13.5px]'}`
        }>
        
        {pending === 'wca' ? <Loader2Icon size={15} className="animate-spin motion-reduce:animate-none" /> : <WcaMark size={row ? 14 : 16} />}
        {pending === 'wca' ? 'Waiting for WCA…' : 'Continue with WCA'}
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => onStart('google')}
        className={`inline-flex items-center justify-center gap-2.5 rounded-[4px] border border-line-strong text-ink transition-colors duration-150 ease-out hover:bg-hover disabled:opacity-60 disabled:hover:bg-transparent ${
        row ? 'h-8 px-3 text-[12.5px]' : 'h-11 w-full px-4 text-[13.5px]'}`
        }>
        
        {pending === 'google' ? <Loader2Icon size={15} className="animate-spin motion-reduce:animate-none" /> : <GoogleMark size={row ? 14 : 16} />}
        {pending === 'google' ? 'Waiting for Google…' : 'Continue with Google'}
      </button>
    </div>);

}