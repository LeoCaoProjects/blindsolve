import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { isTypingTarget } from "../utils/keyboard";

export type TimerPhase =
  "idle" | "armed" | "ready" | "memo" | "exec" | "running" | "stopped";

export interface TimerResult {
  total: number;
  memo?: number;
}

export const isRunning = (p: TimerPhase) =>
  p === "memo" || p === "exec" || p === "running";

interface UseTimerOptions {
  multiphase: boolean;
  disabled: boolean;
  onStop: (result: TimerResult) => void;
  holdMs?: number;
}

export function useTimer({
  multiphase,
  disabled,
  onStop,
  holdMs = 280,
}: UseTimerOptions) {
  const [phase, setPhaseState] = useState<TimerPhase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [split, setSplit] = useState<number | null>(null);

  const phaseRef = useRef<TimerPhase>("idle");
  const startRef = useRef(0);
  const rafRef = useRef(0);
  const holdRef = useRef<number | undefined>(undefined);
  const lockRef = useRef(false);
  const restRef = useRef<TimerPhase>("idle");
  const splitRef = useRef<number | null>(null);
  const onStopRef = useRef(onStop);
  const multiRef = useRef(multiphase);
  onStopRef.current = onStop;
  multiRef.current = multiphase;

  const setPhase = useCallback((p: TimerPhase) => {
    phaseRef.current = p;
    setPhaseState(p);
  }, []);

  const tick = useCallback(() => {
    setElapsed(performance.now() - startRef.current);
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const startLoop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    const total = performance.now() - startRef.current;
    setElapsed(total);
    setPhase("stopped");
    onStopRef.current({ total, memo: splitRef.current ?? undefined });
  }, [setPhase]);

  const press = useCallback(() => {
    const p = phaseRef.current;
    if (p === "memo") {
      const s = performance.now() - startRef.current;
      splitRef.current = s;
      setSplit(s);
      setPhase("exec");
      lockRef.current = true;
      return;
    }
    if (p === "exec" || p === "running") {
      stop();
      lockRef.current = true;
      return;
    }
    if (lockRef.current) return;
    if (p === "idle" || p === "stopped") {
      restRef.current = p;
      setPhase("armed");
      holdRef.current = window.setTimeout(() => setPhase("ready"), holdMs);
    }
  }, [holdMs, setPhase, stop]);

  const release = useCallback(() => {
    if (lockRef.current) {
      lockRef.current = false;
      return;
    }
    const p = phaseRef.current;
    if (p === "armed") {
      window.clearTimeout(holdRef.current);
      setPhase(restRef.current);
      return;
    }
    if (p === "ready") {
      startRef.current = performance.now();
      splitRef.current = null;
      setSplit(null);
      setElapsed(0);
      setPhase(multiRef.current ? "memo" : "running");
      startLoop();
    }
  }, [setPhase, startLoop]);

  useEffect(() => {
    const cancelHold = () => {
      lockRef.current = false;
      window.clearTimeout(holdRef.current);
      if (phaseRef.current === "armed" || phaseRef.current === "ready")
        setPhase(restRef.current);
    };
    if (disabled) {
      cancelHold();
      return;
    }
    const ignored = (e: KeyboardEvent) =>
      isTypingTarget(e.target) || e.isComposing || e.metaKey || e.ctrlKey ||
      e.altKey || e.shiftKey || e.defaultPrevented ||
      !!document.querySelector('[role="dialog"], [role="alertdialog"]');
    const down = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      if (ignored(e)) { cancelHold(); return; }
      e.preventDefault();
      if (e.repeat) return;
      press();
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      if (ignored(e)) { cancelHold(); return; }
      e.preventDefault();
      release();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", cancelHold);
    document.addEventListener("visibilitychange", cancelHold);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", cancelHold);
      document.removeEventListener("visibilitychange", cancelHold);
      window.clearTimeout(holdRef.current);
    };
  }, [disabled, press, release, setPhase]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const forceRunning = useCallback(
    (ms: number, memo?: number) => {
      startRef.current = performance.now() - ms;
      if (memo !== undefined) {
        splitRef.current = memo;
        setSplit(memo);
        setPhase("exec");
      } else {
        setPhase(multiRef.current ? "memo" : "running");
      }
      startLoop();
    },
    [setPhase, startLoop],
  );

  const forceStopped = useCallback(
    (total: number, memo?: number) => {
      setElapsed(total);
      splitRef.current = memo ?? null;
      setSplit(memo ?? null);
      setPhase("stopped");
    },
    [setPhase],
  );

  const pointerHandlers = {
    onPointerDown: (e: ReactPointerEvent) => {
      if (disabled || e.button !== 0) return;
      press();
    },
    onPointerUp: () => {
      if (!disabled) release();
    },
  };

  return {
    phase,
    display: phase === "ready" ? 0 : elapsed,
    elapsed,
    split,
    pointerHandlers,
    forceRunning,
    forceStopped,
    reset: () => {
      cancelAnimationFrame(rafRef.current);
      window.clearTimeout(holdRef.current);
      lockRef.current = false;
      restRef.current = "idle";
      splitRef.current = null;
      setSplit(null);
      setElapsed(0);
      setPhase("idle");
    },
  };
}

export type TimerApi = ReturnType<typeof useTimer>;
