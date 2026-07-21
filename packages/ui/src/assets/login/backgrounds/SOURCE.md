# Login screen backgrounds

Drop background images (`.webp`, `.png`, `.jpg`/`.jpeg`) directly in this folder — the login screen picks one at random on each load (see `index.ts`).

Suggested source: https://www.reddit.com/r/Lineage2/comments/nudtz8/c1h5_loading_screens_8k_digital_art_quality/

These are Lineage 2 (NCSoft) loading-screen artwork reposted by a community member on Reddit, not original/licensed assets. Files in this folder are `.gitignore`d and are **not** committed to this repository — you are responsible for confirming you have the right to use whatever images you place here before shipping a build with them.

This is a local dev-only override, and only covers images. In a real build,
the background comes from `VITE_LOGIN_BACKGROUND_IMAGE_BASE_URL` /
`VITE_LOGIN_BACKGROUND_VIDEO_BASE_URL` (see `.env.example`), served by
`@lineage2js/assets-server` from `assets/legacy/{images,videos}/titlescreens/`
-- the number of available variants is reported by the server's `count`
endpoint, not baked in at build time. Video takes priority over image when
both are available. If nothing resolves (this folder is empty, no env URL
configured, or the server has no files), the login screen falls back to the
r3f atmosphere scene alone (see `components/screens/login/atmosphere/`).
