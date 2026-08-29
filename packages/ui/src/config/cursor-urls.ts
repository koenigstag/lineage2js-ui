const CURSOR_BASE_URL = import.meta.env.VITE_CURSOR_BASE_URL;

/**
 * Cursor URL by file name (no extension) -- matches assets-server's flat
 * assets/highfive/cursors/<name>.cur layout (see
 * assets-server/scripts/extract-cursors.ts), so a name resolves straight to
 * a file with no id -> filename index to fetch first.
 *
 * Which cursor applies to which game state is a separate, not-yet-decided
 * mapping -- this only turns a name a caller already picked into a URL.
 * Undefined when the base URL isn't configured, so a caller can fall back to
 * a native CSS cursor keyword the same way the rest of config/icon-urls.ts's
 * getters do for their own art.
 */
export function getCursorUrl(name: string): string | undefined {
  if (!CURSOR_BASE_URL) {
    return undefined;
  }
  return (CURSOR_BASE_URL.endsWith("/") ? CURSOR_BASE_URL : `${CURSOR_BASE_URL}/`) + `${name}.cur`;
}
