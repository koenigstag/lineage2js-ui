import { useEffect, useState } from "react";

const MOBILE_BREAKPOINT_QUERY = "(max-width: 768px)";

/** True while the viewport matches the mobile breakpoint, reactive to resize/orientation changes. */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(MOBILE_BREAKPOINT_QUERY).matches);

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_BREAKPOINT_QUERY);
    const onChange = () => setIsMobile(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isMobile;
}

/** Non-reactive one-off check, for code that only needs the value once (e.g. store construction). */
export function isMobileViewport(): boolean {
  return window.matchMedia(MOBILE_BREAKPOINT_QUERY).matches;
}
