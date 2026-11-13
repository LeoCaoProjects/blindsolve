import { useEffect, useRef, type RefObject } from "react";
import { isTypingTarget } from "../utils/keyboard";

const SPACE_CONTROL =
  'button, a[href], summary, [role="button"], [role="radio"], [role="checkbox"], [role="switch"], [role="tab"], [role="slider"], [role="spinbutton"], [role="textbox"], [role="combobox"], [role="listbox"], [role="option"], [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"], audio, video';

/** A closing press belongs to the popup through release, even after it unmounts. */
function consumeThroughRelease() {
  const consume = (event: KeyboardEvent) => {
    if (event.code !== "Space") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.type === "keyup") cleanup();
  };
  const cleanup = () => {
    window.removeEventListener("keydown", consume, true);
    window.removeEventListener("keyup", consume, true);
    window.removeEventListener("blur", cleanup);
  };
  window.addEventListener("keydown", consume, true);
  window.addEventListener("keyup", consume, true);
  window.addEventListener("blur", cleanup);
}

/** Extra dismiss shortcut for shared popup surfaces; Escape keeps its existing handler. */
export function useDialogSpaceClose<T extends HTMLElement>(
  root: RefObject<T | null>,
  onClose: () => void,
  open = true,
) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (
        event.code !== "Space" ||
        event.defaultPrevented ||
        event.isComposing ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.shiftKey ||
        isTypingTarget(event.target)
      )
        return;
      const dialog = root.current;
      if (!dialog) return;
      const dialogs = document.querySelectorAll(
        '[role="dialog"], [role="alertdialog"]',
      );
      if (dialogs[dialogs.length - 1] !== dialog) return;
      // A focused action inside the popup keeps its native Space activation.
      if (
        event.target instanceof Element &&
        dialog.contains(event.target) &&
        event.target.closest(SPACE_CONTROL)
      )
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
      // Capture runs before timing listeners. A popup opened by their keydown
      // cannot receive that opening event here; held-key repeats must not close it.
      if (event.repeat) return;
      consumeThroughRelease();
      closeRef.current();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [root, open]);
}
