import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { ownsTrainingSpace } from "../utils/keyboard";

export type HoldPhase = "idle" | "armed" | "ready";

interface Options {
  enabled: boolean;
  onStart: () => void;
  holdMs?: number;
}

/** Same gesture as the Timer: hold Space (or press and hold) until ready, release to start. */
export function useHoldStart({ enabled, onStart, holdMs = 280 }: Options) {
  const [phase, setPhaseState] = useState<HoldPhase>("idle");
  const phaseRef = useRef<HoldPhase>("idle");
  const timer = useRef<number | undefined>(undefined);
  const onStartRef = useRef(onStart);
  onStartRef.current = onStart;

  const setPhase = useCallback((p: HoldPhase) => {
    phaseRef.current = p;
    setPhaseState(p);
  }, []);

  const press = useCallback(() => {
    if (phaseRef.current !== "idle") return;
    setPhase("armed");
    timer.current = window.setTimeout(() => setPhase("ready"), holdMs);
  }, [holdMs, setPhase]);

  const release = useCallback(() => {
    window.clearTimeout(timer.current);
    const p = phaseRef.current;
    if (p === "idle") return;
    setPhase("idle");
    if (p === "ready") onStartRef.current();
  }, [setPhase]);

  const cancel = useCallback(() => {
    window.clearTimeout(timer.current);
    if (phaseRef.current !== "idle") setPhase("idle");
  }, [setPhase]);

  useEffect(() => {
    if (!enabled) {
      cancel();
      return;
    }
    const down = (e: KeyboardEvent) => {
      if (
        e.code !== "Space" ||
        !ownsTrainingSpace(e.target) ||
        e.metaKey ||
        e.ctrlKey ||
        e.defaultPrevented
      )
        return;
      if (document.querySelector('[role="dialog"], [role="alertdialog"]'))
        return;
      e.preventDefault();
      if (e.repeat) return;
      press();
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== "Space" || phaseRef.current === "idle") return;
      if (
        !ownsTrainingSpace(e.target) ||
        document.querySelector('[role="dialog"], [role="alertdialog"]')
      ) {
        cancel();
        return;
      }
      e.preventDefault();
      release();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", cancel);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", cancel);
      cancel();
    };
  }, [enabled, press, release, cancel]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const pointerHandlers = {
    onPointerDown: (e: ReactPointerEvent) => {
      if (!enabled || e.button !== 0) return;
      if ((e.target as HTMLElement).closest("button, a, input")) return;
      press();
    },
    onPointerUp: () => enabled && release(),
    onPointerCancel: cancel,
    onPointerLeave: cancel,
  };

  return { phase, pointerHandlers };
}
