import { useCallback, useEffect, useRef, useState } from "react";
import { useAppData } from "../contexts/AppDataContext";
import { AuthProvider } from "../types/app";
import { supabase, supabaseUrl } from "../../lib/supabase";
import { useStore } from "../../app/Store";

export type SignInStep = "idle" | "redirecting" | "merge";
export type MergeChoice = "merge" | "account";

/** OAuth UI backed by Supabase. Secret-bearing WCA exchange stays server-side. */
export function useSignInFlow(
  opts: {
    initial?: SignInStep;
    provider?: AuthProvider;
    onDone?: () => void;
  } = {},
) {
  const app = useAppData();
  const store = useStore();
  const [internalStep, setStep] = useState<SignInStep>("idle");
  const [provider, setProvider] = useState<AuthProvider | null>(null);
  const [choice, setChoice] = useState<MergeChoice>("merge");
  const [error, setError] = useState<string | null>(null);
  const onDone = useRef(opts.onDone);
  onDone.current = opts.onDone;
  const request = useRef(0);
  const callback = useRef<Promise<{
    error: { message: string } | null;
  }> | null>(null);
  const owner = store.user?.id;
  useEffect(() => {
    request.current++;
    setStep("idle");
    setProvider(null);
    setError(null);
    return () => {
      request.current++;
    };
  }, [owner]);

  useEffect(() => {
    if (store.ready && app.account.provider && !store.guestMigration)
      onDone.current?.();
  }, [app.account.provider, store.guestMigration, store.ready]);

  useEffect(() => {
    if (!supabase) return;
    const queryError = new URLSearchParams(window.location.search).get(
      "auth_error",
    );
    if (queryError) {
      setError(queryError);
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const tokenHash = hash.get("wca_token_hash");
    if (!tokenHash && !callback.current) return;
    const ticket = ++request.current;
    setProvider("wca");
    setStep("redirecting");
    window.history.replaceState({}, "", window.location.pathname);
    callback.current ??= supabase.auth.verifyOtp({
      token_hash: tokenHash!,
      type: "email",
    });
    void callback.current
      .then(({ error: verifyError }) => {
        if (ticket !== request.current) return;
        if (verifyError) {
          setError(verifyError.message);
          setProvider(null);
          setStep("idle");
        }
      })
      .catch(() => {
        if (ticket !== request.current) return;
        setError("Sign-in could not be completed. Please try again.");
        setProvider(null);
        setStep("idle");
      });
  }, []);

  const start = useCallback(async (p: AuthProvider) => {
    const ticket = ++request.current;
    setError(null);
    if (!supabase) {
      setError(
        "Sign-in is not configured on this deployment. Your data remains safely on this device.",
      );
      return;
    }
    if (p === "wca") {
      setProvider(p);
      setStep("redirecting");
      window.location.assign(`${supabaseUrl}/functions/v1/wca-oauth`);
      return;
    }
    setProvider(p);
    setStep("redirecting");
    try {
      const { data, error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
          skipBrowserRedirect: true,
        },
      });
      if (ticket !== request.current) return;
      if (authError) {
        setError(authError.message);
        setProvider(null);
        setStep("idle");
      } else if (data.url) {
        window.location.assign(data.url);
      }
    } catch {
      if (ticket !== request.current) return;
      setError("Sign-in could not be started. Please try again.");
      setProvider(null);
      setStep("idle");
    }
  }, []);

  const cancel = useCallback(() => {
    request.current++;
    setError(null);
    setStep("idle");
    setProvider(null);
  }, []);

  const step: SignInStep = store.guestMigration ? "merge" : internalStep;

  return {
    step,
    provider,
    start: (p: AuthProvider) => {
      void start(p);
    },
    cancel,
    choice,
    setChoice,
    confirmMerge: () => store.resolveGuestMigration(choice),
    error,
    continueWithAccount: () => store.resolveGuestMigration("account"),
    localCounts: store.guestMigration ?? { pairs: 0, solves: 0 },
  };
}

export type SignInFlow = ReturnType<typeof useSignInFlow>;
