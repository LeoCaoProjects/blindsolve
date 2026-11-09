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
import { useWorkspaceLocation } from "../../navigation/workspaces";
import { Sheet } from "../common/Sheet";
import { designRem } from "../../hooks/useDesignPixels";
import {
  isViewportSizingActive,
  viewportSizingEnabled,
  subscribeViewportLayout,
  hasViewportLayout,
} from "../../utils/viewportSizing";

export const SUB_NAV_WIDTH = 224;
export const SUB_NAV_EASE = [0.22, 1, 0.36, 1] as const;
export const SUB_NAV_ITEM =
  "flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-[13px] transition-colors duration-150 hover:bg-hover focus-visible:outline-offset-[-2px]";
const SUB_NAV_TITLE = "text-[14px] font-bold text-ink";
const pages: Record<
  string,
  { title: string; label: string; scrollContent?: boolean }
> = {
  "/training": { title: "Training", label: "Training controls" },
  "/settings": { title: "Settings", label: "Settings sections" },
  "/pairs": {
    title: "Letter Pairs",
    label: "Letter Pairs navigation",
    scrollContent: false,
  },
};
const query = "(min-width: 1024px)";
const subscribe = (notify: () => void) => {
  const media = window.matchMedia(query);
  media.addEventListener("change", notify);
  const unsubscribe = viewportSizingEnabled
    ? subscribeViewportLayout(notify)
    : () => {};
  return () => {
    media.removeEventListener("change", notify);
    unsubscribe();
  };
};
const snapshot = () =>
  isViewportSizingActive()
    ? hasViewportLayout("context")
    : window.matchMedia(query).matches;
const Context = createContext<{
  desktop: boolean;
  target: HTMLDivElement | null;
  subnavClassName?: string;
  scrollContent: boolean;
}>({ desktop: false, target: null, scrollContent: true });

/** Persistent layout column; only the workspace translation animates on width changes. */
export function SubNavFrame({
  children,
  header,
  reference,
  layoutClassName,
  subnavClassName = "",
}: {
  children: React.ReactNode;
  header?: React.ReactNode;
  reference?: React.ReactNode;
  layoutClassName?: string;
  subnavClassName?: string;
}) {
  const { pathname } = useWorkspaceLocation();
  const desktop = useSyncExternalStore(subscribe, snapshot, () => true);
  const reduced = useReducedMotion();
  const page = pages[pathname];
  const [target, setTarget] = useState<HTMLDivElement | null>(null);
  const value = useMemo(
    () => ({
      desktop,
      target,
      subnavClassName,
      scrollContent: page?.scrollContent ?? true,
    }),
    [desktop, target, subnavClassName, page],
  );
  const workspace = useRef<HTMLDivElement>(null);
  const previousInset = useRef<number | null>(null);
  const animation = useRef<Animation | null>(null);
  // A root-font change must not restart the workspace slide.
  const inset = desktop && page ? SUB_NAV_WIDTH : 0;
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
        {
          transform: `translateX(${((previous - inset) * parseFloat(getComputedStyle(document.documentElement).fontSize)) / 16 + interruptedOffset}px)`,
        },
        { transform: "translateX(0)" },
      ],
      { duration: 180, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
    );
  }, [inset, reduced]);
  useLayoutEffect(() => () => animation.current?.cancel(), []);
  return (
    <Context.Provider value={value}>
      <div
        className={layoutClassName ?? "h-full"}
        data-session-workspace={reference ? "" : undefined}
      >
        <div
          data-workspace-main
          className="flex h-full min-h-0 min-w-0 flex-col font-sans text-ink"
        >
          <div
            className="flex min-h-0 min-w-0 flex-1 overflow-hidden font-sans text-ink"
            data-subnav-shell
          >
            {desktop && (
              <aside
                aria-label={page?.label ?? "Contextual navigation"}
                aria-hidden={!page}
                data-subnav-column
                style={{ width: designRem(inset) }}
                className={`min-h-0 shrink-0 overflow-hidden bg-bg transition-opacity duration-200 ${subnavClassName}`}
              >
                <motion.div
                  key={pathname}
                  initial={{ opacity: reduced ? 1 : 0 }}
                  animate={{ opacity: 1 }}
                  transition={{
                    duration: reduced ? 0 : 0.16,
                    ease: SUB_NAV_EASE,
                  }}
                  style={{ width: designRem(SUB_NAV_WIDTH) }}
                  className="flex h-full min-h-0 flex-col border-r border-line px-3 pb-4 pt-6"
                >
                  <h1 className={`mb-3 shrink-0 px-3 ${SUB_NAV_TITLE}`}>
                    {page?.title}
                  </h1>
                  <div
                    ref={setTarget}
                    className={`min-h-0 flex-1 ${page?.scrollContent === false ? "flex flex-col overflow-hidden" : "scroll-quiet overflow-y-auto"}`}
                  />
                </motion.div>
              </aside>
            )}
            <div
              ref={workspace}
              className="flex min-h-0 min-w-0 flex-1 flex-col"
              data-page-workspace
            >
              {header}
              <div className="min-h-0 flex-1">{children}</div>
            </div>
          </div>
        </div>
        {reference}
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
  const { desktop, target, subnavClassName, scrollContent } =
    useContext(Context);
  if (desktop)
    return target
      ? createPortal(
          typeof children === "function" ? children(() => {}) : children,
          target,
        )
      : null;
  return (
    <MobileSubNavigation
      label={label}
      title={title}
      trigger={trigger}
      className={subnavClassName}
      scrollContent={scrollContent}
    >
      {children}
    </MobileSubNavigation>
  );
}
function MobileSubNavigation({
  className = "",
  label,
  title,
  trigger,
  children,
  scrollContent,
}: {
  className?: string;
  label: string;
  title: string;
  trigger: React.ReactNode;
  children: React.ReactNode | ((close: () => void) => React.ReactNode);
  scrollContent: boolean;
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
        className={`flex h-12 shrink-0 items-center justify-between border-b border-line px-5 text-[14px] font-medium transition-opacity duration-200 hover:bg-hover ${className}`}
      >
        {trigger}
        <ChevronDownIcon size={16} aria-hidden />
      </button>
      <Sheet
        open={open}
        onClose={close}
        label={label}
        title={<span className={SUB_NAV_TITLE}>{title}</span>}
        width={320}
        scrollContent={scrollContent}
      >
        {typeof children === "function" ? children(close) : children}
      </Sheet>
    </>
  );
}
