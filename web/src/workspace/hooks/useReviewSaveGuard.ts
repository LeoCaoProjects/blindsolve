import { useCallback, useEffect, useRef, useState } from "react";

export const REVIEW_SAVE_PAUSE_MS = 650;

/** Require a quiet moment after Continue becomes Save, including repeated attempts. */
export function useReviewSaveGuard(active: boolean) {
  const [ready, setReady] = useState(false);
  const readyRef = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const wait = useCallback(() => {
    clearTimeout(timer.current);
    readyRef.current = false;
    setReady(false);
    timer.current = setTimeout(() => {
      readyRef.current = true;
      setReady(true);
    }, REVIEW_SAVE_PAUSE_MS);
  }, []);

  useEffect(() => {
    if (active) wait();
    else {
      readyRef.current = false;
      setReady(false);
    }
    return () => clearTimeout(timer.current);
  }, [active, wait]);

  const confirm = useCallback(() => {
    if (!active) return false;
    if (!readyRef.current) {
      wait();
      return false;
    }
    readyRef.current = false;
    setReady(false);
    return true;
  }, [active, wait]);

  return { ready: active && ready, confirm, wait };
}
