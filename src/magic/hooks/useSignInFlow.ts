import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppData } from '../contexts/AppDataContext';
import { AuthProvider } from '../types/app';
import { supabase } from '../../lib/supabase';

export type SignInStep = 'idle' | 'redirecting' | 'merge';
export type MergeChoice = 'merge' | 'account';

/** OAuth UI backed by Supabase. Secret-bearing WCA exchange stays server-side. */
export function useSignInFlow(opts: {initial?: SignInStep;provider?: AuthProvider;onDone?: () => void;} = {}) {
  const app = useAppData();
  const [step, setStep] = useState<SignInStep>('idle');
  const [provider, setProvider] = useState<AuthProvider | null>(null);
  const [choice, setChoice] = useState<MergeChoice>('merge');
  const [error, setError] = useState<string | null>(null);
  const onDone = useRef(opts.onDone);
  onDone.current = opts.onDone;

  useEffect(() => {
    if (app.account.provider) onDone.current?.();
  }, [app.account.provider]);

  const start = useCallback(async (p: AuthProvider) => {
    setError(null);
    if (!supabase) {
      setError('Sign-in is not configured on this deployment. Your data remains safely on this device.');
      return;
    }
    if (p === 'wca') {
      setError('WCA sign-in needs the server-side OAuth exchange to be configured. No client secret is stored in this app.');
      return;
    }
    setProvider(p);
    setStep('redirecting');
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (authError) {
      setError(authError.message);
      setProvider(null);
      setStep('idle');
    }
  }, []);

  const cancel = useCallback(() => {
    setStep('idle');
    setProvider(null);
  }, []);

  return {
    step, provider, start: (p: AuthProvider) => { void start(p); }, cancel,
    choice, setChoice, confirmMerge: cancel, error,
    localCounts: { pairs: Object.keys(app.pairs).length, solves: app.solves.length },
  };
}

export type SignInFlow = ReturnType<typeof useSignInFlow>;
