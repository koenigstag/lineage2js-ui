import { useEffect } from "react";

/** Fires callback on Ctrl+L, preventing the browser's default "focus address bar" action. */
export function useResetShortcut(callback: () => void) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey && event.key.toLowerCase() === "l") {
        event.preventDefault();
        callback();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [callback]);
}
