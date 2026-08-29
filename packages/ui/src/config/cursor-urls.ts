const CURSOR_BASE_URL = import.meta.env.VITE_CURSOR_BASE_URL;

/**
 * Cursor URL by file name (no extension) -- matches assets-server's flat
 * assets/highfive/cursors/<name>.cur layout (see
 * assets-server/scripts/extract-cursors.ts), so a name resolves straight to
 * a file with no id -> filename index to fetch first.
 *
 * Undefined when the base URL isn't configured, so a caller can fall back to
 * a native CSS cursor keyword the same way the rest of config/icon-urls.ts's
 * getters do for their own art. Most callers want cursorStyle() below rather
 * than this directly -- it already builds that fallback in.
 */
export function getCursorUrl(name: string): string | undefined {
  if (!CURSOR_BASE_URL) {
    return undefined;
  }
  return (CURSOR_BASE_URL.endsWith("/") ? CURSOR_BASE_URL : `${CURSOR_BASE_URL}/`) + `${name}.cur`;
}

/**
 * A ready-to-assign CSS `cursor` value: the real art first, the native
 * keyword this project used before any of it existed as the required
 * fallback (both because CSS mandates a non-url last value, and because it's
 * what shows if VITE_CURSOR_BASE_URL is unset or the specific file 404s).
 */
export function cursorStyle(name: string, fallback: string): string {
  const url = getCursorUrl(name);
  return url ? `url("${url}"), ${fallback}` : fallback;
}

/**
 * The game's baseline cursor -- what a hover handler should reset to on
 * pointer-out, instead of the browser's plain arrow ("auto"), now that
 * there's real art for it too. See character-model.component.tsx and
 * gltf-character-model.component.tsx's onPointerOut.
 */
export const DEFAULT_CURSOR = cursorStyle("default", "auto");
