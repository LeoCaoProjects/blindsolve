import React, {
  createContext,
  useContext,
  useMemo,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ChevronDownIcon } from "lucide-react";
import { useLocation } from "react-router-dom";
import { Sheet } from "../common/Sheet";
import { useDesignPixels } from "../../hooks/useDesignPixels";

export const SUB_NAV_WIDTH = 224;
export const SUB_NAV_EASE = [0.22, 1, 0.36, 1] as const;
export const SUB_NAV_ITEM =
  "flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-[13px] transition-colors duration-150 hover:bg-hover focus-visible:outline-offset-[-2px]";
const pages: Record<string, { title: string; label: string }> = {
  "/training": { title: "Training", label: "Training controls" },
  "/settings": { title: "Settings", label: "Settings sections" },
  "/pairs": { title: "Letter Pairs", label: "Letter Pairs navigation" },
};
const query = "(min-width: 1024px)";
const subscribe = (notify: () => void) => {
  const media = window.matchMedia(query);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};
const snapshot = () => window.matchMedia(query).matches;
const Context = createContext<{
  desktop: boolean;
  target: HTMLDivElement | null;
}>({ desktop: false, target: null });

/** Persistent layout column; only the workspace translation animates on width changes. */
export function SubNavFrame({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const desktop = useSyncExternalStore(subscribe, snapshot, () => true);
  const reduced = useReducedMotion();
  const page = pages[pathname];
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  const value = useMemo(() => ({ desktop, target }), [desktop, target]);
  const workspace = useRef<HTMLDivElement>(null);
  const previousInset = useRef<number | null>(null);
  const animation = useRef<Animation | null>(null);
  const designPixels = useDesignPixels();
  const inset = desktop && page ? designPixels(SUB_NAV_WIDTH) : 0;
  useLayoutEffect(() => {
    const previous = previousInset.current;
    previousInset.current = inset;
    if (reduced) {
      animation.current?.cancel();
      return;
    }
    if (previous === null || previous === inset || !workspace.current) return;
    const transform = getComputedStyle(workspace.current).transform;
    const interruptedOffset =
      transform === "none" ? 0 : new DOMMatrixReadOnly(transform).m41;
    animation.current?.cancel();
    // Commit the final column once; animate only the visual displacement.
    animation.current = workspace.current.animate(
      [
        { transform: `translateX(${previous - inset + interruptedOffset}px)` },
        { transform: "translateX(0)" },
      ],
      { duration: 180, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
    );
  }, [inset, reduced]);
  useLayoutEffect(() => () => animation.current?.cancel(), []);
  return (
    <Context.Provider value={value}>
      <div
        className="flex h-full min-w-0 overflow-hidden font-sans text-ink"
        data-subnav-shell
      >
        {desktop && (
          <aside
            aria-label={page?.label ?? "Contextual navigation"}
            aria-hidden={!page}
            data-subnav-column
            style={{ width: inset }}
            className="min-h-0 shrink-0 overflow-hidden bg-bg"
          >
            <motion.div
              key={pathname}
              initial={{ opacity: reduced ? 1 : 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: reduced ? 0 : 0.16, ease: SUB_NAV_EASE }}
              style={{ width: designPixels(SUB_NAV_WIDTH) }}
              className="flex h-full min-h-0 flex-col border-r border-line px-3 pb-4 pt-6"
            >
              <h1 className="mb-3 shrink-0 px-3 text-[12px] font-medium text-ink-3">
                {page?.title}
              </h1>
              <div
                ref={setTarget}
                className="scroll-quiet min-h-0 flex-1 overflow-y-auto"
              />
            </motion.div>
          </aside>
        )}
        <div
          ref={workspace}
          className="min-h-0 min-w-0 flex-1"
          data-page-workspace
        >
          {children}
        </div>
      </div>
    </Context.Provider>
  );
}

export function SubNavigation({
  label,
  title,
  trigger,
  children,
}: {
  label: string;
  title: string;
  trigger: React.ReactNode;
  children: React.ReactNode | ((close: () => void) => React.ReactNode);
}) {
  const { desktop, target } = useContext(Context);
  if (desktop)
    return target
      ? createPortal(
          typeof children === "function" ? children(() => {}) : children,
          target,
        )
      : null;
  return (
    <MobileSubNavigation label={label} title={title} trigger={trigger}>
      {children}
    </MobileSubNavigation>
  );
}
function MobileSubNavigation({
  label,
  title,
  trigger,
  children,
}: {
  label: string;
  title: string;
  trigger: React.ReactNode;
  children: React.ReactNode | ((close: () => void) => React.ReactNode);
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="flex h-12 shrink-0 items-center justify-between border-b border-line px-5 text-[14px] font-medium hover:bg-hover"
      >
        {trigger}
        <ChevronDownIcon size={16} aria-hidden />
      </button>
      <Sheet
        open={open}
        onClose={close}
        label={label}
        title={title}
        width={320}
      >
        {typeof children === "function" ? children(close) : children}
      </Sheet>
    </>
  );
}
