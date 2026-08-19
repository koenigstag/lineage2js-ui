import { useEffect, useRef } from "react";

const DEFAULT_DELAY_MS = 250;

/**
 * Resolves whether a click was a single click or the first half of a
 * double-click, using only the click event's own timestamp rather than the
 * browser's native dblclick -- one handler to wire up (just onClick), and
 * more consistent across touch and mouse than dblclick, which doesn't map
 * reliably from a double-tap on every platform.
 *
 * onClick/onDoubleClick are read via refs (updated every render), so
 * passing a fresh inline function each render is fine -- it won't reset the
 * pending single-click timer the way a useEffect dependency would.
 */
export function useClickOrDoubleClick(onClick: () => void, onDoubleClick: () => void, delay = DEFAULT_DELAY_MS) {
  const lastClickAt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const onClickRef = useRef(onClick);
  const onDoubleClickRef = useRef(onDoubleClick);
  onClickRef.current = onClick;
  onDoubleClickRef.current = onDoubleClick;

  useEffect(() => () => clearTimeout(timer.current), []);

  return {
    onClick: () => {
      const now = Date.now();
      if (now - lastClickAt.current < delay) {
        clearTimeout(timer.current);
        lastClickAt.current = 0;
        onDoubleClickRef.current();
        return;
      }
      lastClickAt.current = now;
      timer.current = setTimeout(() => {
        onClickRef.current();
        lastClickAt.current = 0;
      }, delay);
    },
  };
}
