import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppData } from '../contexts/AppDataContext';
import { AuthProvider } from '../types/app';
import { supabase, supabaseUrl } from '../../lib/supabase';
import { useStore } from '../../app/Store';

export type SignInStep = 'idle' | 'redirecting' | 'merge';
export type MergeChoice = 'merge' | 'account';

/** OAuth UI backed by Supabase. Secret-bearing WCA exchange stays server-side. */
export function useSignInFlow(opts: {initial?: SignInStep;provider?: AuthProvider;onDone?: () => void;} = {}) {
  const app = useAppData();
  const store = useStore();
  const [internalStep, setStep] = useState<SignInStep>('idle');
  const [provider, setProvider] = useState<AuthProvider | null>(null);
  const [choice, setChoice] = useState<MergeChoice>('merge');
  const [error, setError] = useState<string | null>(null);
  const onDone = useRef(opts.onDone);
  onDone.current = opts.onDone;

  useEffect(() => {
    if (store.ready && app.account.provider && !store.guestMigration) onDone.current?.();
  }, [app.account.provider, store.guestMigration, store.ready]);

  useEffect(() => {
    if (!supabase) return;
    const queryError = new URLSearchParams(window.location.search).get('auth_error');
    if (queryError) {
      setError(queryError);
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const tokenHash = hash.get('wca_token_hash');
    if (!tokenHash) return;
    setProvider('wca');
    setStep('redirecting');
    window.history.replaceState({}, '', window.location.pathname);
    void supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'email' }).then(({ error: verifyError }) => {
      if (verifyError) {
        setError(verifyError.message);
        setProvider(null);
        setStep('idle');
      }
    });
  }, []);

  const start = useCallback(async (p: AuthProvider) => {
    setError(null);
    if (!supabase) {
      setError('Sign-in is not configured on this deployment. Your data remains safely on this device.');
      return;
    }
    if (p === 'wca') {
      setProvider(p);
      setStep('redirecting');
      window.location.assign(`${supabaseUrl}/functions/v1/wca-oauth`);
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

  const step: SignInStep = store.guestMigration ? 'merge' : internalStep;

  return {
    step, provider, start: (p: AuthProvider) => { void start(p); }, cancel,
    choice, setChoice, confirmMerge: () => store.resolveGuestMigration(choice), error,
    continueWithAccount: () => store.resolveGuestMigration('account'),
    localCounts: store.guestMigration ?? { pairs: 0, solves: 0 },
  };
}

export type SignInFlow = ReturnType<typeof useSignInFlow>;
