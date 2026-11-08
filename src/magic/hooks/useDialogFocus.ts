import { useEffect, useRef } from "react";

const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

/** Keeps keyboard focus in the top-most dialog and returns it when the dialog closes. */
export function useDialogFocus<T extends HTMLElement>(
  open = true,
  quietRestore = false,
) {
  const rootRef = useRef<T>(null);
  const wasOpen = useRef(false);
  const previousFocus = useRef<HTMLElement | null>(null);

  // Capture the trigger before React commits any native autofocus inside the dialog.
  if (open && !wasOpen.current) {
    previousFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    wasOpen.current = true;
  } else if (!open) {
    wasOpen.current = false;
  }

  useEffect(() => {
    if (!open) return;
    const previous = previousFocus.current;
    const frame = window.requestAnimationFrame(() => {
      const root = rootRef.current;
      if (!root || root.contains(document.activeElement)) return;
      root.querySelector<HTMLElement>("[data-dialog-autofocus]")?.focus();
      if (!root.contains(document.activeElement))
        root.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    });
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const root = rootRef.current;
      if (!root) return;
      const dialogs = document.querySelectorAll<HTMLElement>(
        '[role="dialog"], [role="alertdialog"]',
      );
      if (dialogs[dialogs.length - 1] !== root) return;
      const nodes = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (node) =>
          !node.hasAttribute("disabled") &&
          node.getAttribute("type") !== "hidden" &&
          !node.classList.contains("hidden") &&
          node.getAttribute("aria-hidden") !== "true",
      );
      if (!nodes.length) {
        event.preventDefault();
        root.focus();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", trap);
      if (previous?.isConnected) {
        if (quietRestore) {
          // Restore keyboard continuity without painting a fresh focus ring on
          // the workspace/control behind a completed deletion popup.
          previous.setAttribute("data-quiet-focus-return", "");
          previous.addEventListener(
            "blur",
            () => previous.removeAttribute("data-quiet-focus-return"),
            { once: true },
          );
        }
        previous.focus({ preventScroll: true });
      }
    };
  }, [open, quietRestore]);

  return rootRef;
}
