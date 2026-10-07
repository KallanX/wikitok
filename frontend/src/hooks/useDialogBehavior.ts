import { useEffect, useRef, type RefObject } from "react";

const FEED_KEYS = new Set([
  "ArrowDown",
  "ArrowUp",
  "ArrowLeft",
  "ArrowRight",
  "j",
  "J",
  "k",
  "K",
  "l",
  "L",
]);

function focusable(dialog: HTMLElement): HTMLElement[] {
  return Array.from(
    dialog.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ).filter((element) => element.tabIndex !== -1 || element === dialog);
}

/**
 * Locks feed scrolling, moves focus into the dialog, and traps Tab and feed shortcuts.
 */
export function useDialogBehavior(
  active: boolean,
  onClose: () => void,
  dialogRef: RefObject<HTMLElement | null>
) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!active) return;
    const feed = document.getElementById("feed");
    if (feed) feed.style.overflow = "hidden";

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    dialog?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }

      const target = event.target;
      const typing =
        target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
      if (!typing && FEED_KEYS.has(event.key)) {
        event.preventDefault();
        event.stopPropagation();
      }

      if (event.key !== "Tab" || !dialog) return;
      const items = focusable(dialog);
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKey, true);
    return () => {
      if (feed) feed.style.overflow = "";
      window.removeEventListener("keydown", onKey, true);
      previouslyFocused?.focus?.();
    };
  }, [active, dialogRef]);
}
