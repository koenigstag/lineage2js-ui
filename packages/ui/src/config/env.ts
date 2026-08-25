/**
 * True when GameStore should seed itself with fake placeholder data (see
 * GameStore.ts's createDemoX() factories) instead of starting empty/neutral.
 * Keeps demo data (used for UI development/screenshots with no server) from
 * ever getting mixed in with real server data during actual network testing.
 */
export const IS_DEMO_MODE = import.meta.env.VITE_IS_DEMO_MODE === "true";

/**
 * "true" to stitch geodata tiles into a continuous mesh across cell/layer
 * boundaries (buildSheets, see geo-terrain-tile.component.tsx) instead of
 * the default -- one independent flat quad per (cell, layer), no shared
 * vertices between cells at all, matching how the real G3D geodata editor
 * renders it (confirmed by decompiling G3DEditor.jar: every cell renders as
 * its own small self-contained platform, with zero connectivity/merging
 * logic between neighbors). Smoothing is opt-in rather than default because
 * "closest available match" mesh-stitching has no ground-truth reference to
 * validate against -- unlike the independent-quads mode, which is simply
 * what the authoritative tool does.
 */
export const IS_GEODATA_TERRAIN_SMOOTH = import.meta.env.VITE_GEODATA_TERRAIN_SMOOTH === "true";

/**
 * Prefills the login form's account/password from VITE_DEV_LOGIN_USERNAME/
 * VITE_DEV_LOGIN_PASSWORD, so a real test account doesn't need retyping on
 * every reload -- never auto-submits, see login.menu.tsx. Gated on
 * import.meta.env.DEV (a compile-time constant Vite folds to `false` in a
 * production build), so this whole branch -- including both env var string
 * literals -- is dead-code-eliminated out of anything built with `vite
 * build`; a real password can only ever reach a dev server's local network
 * traffic, never a shipped bundle. Undefined unless both vars are set.
 */
export const DEV_LOGIN_CREDENTIALS: { username: string; password: string } | undefined =
  import.meta.env.DEV && import.meta.env.VITE_DEV_LOGIN_USERNAME && import.meta.env.VITE_DEV_LOGIN_PASSWORD
    ? { username: import.meta.env.VITE_DEV_LOGIN_USERNAME, password: import.meta.env.VITE_DEV_LOGIN_PASSWORD }
    : undefined;
