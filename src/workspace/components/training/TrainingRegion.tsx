import { useLayoutEffect, useRef, type ReactNode } from "react";
import { useAnimate, useReducedMotion } from "framer-motion";
import { SUB_NAV_EASE } from "../layout/SubNavigation";

/** Keep one real region in flow. Only Training tab changes animate; timing/route
 * changes settle immediately, preserving the established active timer anchors. */
export function TrainingRegion({
  expanded,
  mode,
  name,
  children,
}: {
  expanded: boolean;
  mode: string | null;
  name: string;
  children: ReactNode;
}) {
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const reduced = useReducedMotion();
  const initial = useRef(expanded);
  const previous = useRef(mode);
  useLayoutEffect(() => {
    const switchMode =
      previous.current !== null && mode !== null && previous.current !== mode;
    previous.current = mode;
    if (!scope.current) return;
    const node = scope.current;
    if (!switchMode || reduced) {
      delete node.dataset.transitioning;
      scope.current.style.height = expanded ? "auto" : "0px";
      return;
    }
    node.dataset.transitioning = "true";
    let cancelled = false;
    const playback = animate(
      scope.current,
      { height: expanded ? "auto" : 0 },
      { type: "tween", duration: 0.18, ease: SUB_NAV_EASE },
    );
    playback.then(() => {
      if (!cancelled) delete node.dataset.transitioning;
    });
    return () => {
      cancelled = true;
      playback.stop();
      delete node.dataset.transitioning;
    };
  }, [expanded, mode, reduced, animate, scope]);
  return (
    <div
      ref={scope}
      data-training-region={name}
      aria-hidden={!expanded || undefined}
      inert={!expanded}
      className="min-h-0 shrink-0 overflow-hidden"
      style={{ height: initial.current ? "auto" : 0 }}
    >
      {children}
    </div>
  );
}
