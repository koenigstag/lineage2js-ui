/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_REGISTER_URL: string;
  readonly VITE_RESTORE_PASSWORD_URL: string;
  readonly VITE_WIKI_URL: string;
  readonly VITE_SKILL_ICON_BASE_URL: string;
  readonly VITE_ITEM_ICON_BASE_URL: string;
  readonly VITE_SLOT_ICON_BASE_URL: string;
  readonly VITE_ACTION_ICON_BASE_URL: string;
  readonly VITE_CLASS_ICON_BASE_URL: string;
  readonly VITE_RACE_ICON_BASE_URL: string;
  /** e.g. "http://localhost:4000/highfive/icons/game-menu/" -- folder of the game menu's own button icons ("character@64.png", ...), see config/icon-urls.ts's getGameMenuIconUrl. The menu falls back to plain glyphs when unset. */
  readonly VITE_GAME_MENU_ICON_BASE_URL: string;
  /** e.g. "http://localhost:4000/highfive/geodata-tiles/{tileX}_{tileY}.bin" -- pre-baked geodata tile (see assets-server/scripts/convert-l2j-geodata.ts), "{tileX}"/"{tileY}" get replaced with the tile's coordinates. Deserialized directly, see geo-tile-parser.ts. */
  readonly VITE_GEODATA_TILE_BASE_URL: string;
  /** e.g. "http://localhost:4000/highfive/cursors/" -- folder of real cursor art (.cur files, see assets-server/scripts/extract-cursors.ts and config/cursor-urls.ts's getCursorUrl). Unset/unresolved leaves the browser's native cursor in place. */
  readonly VITE_CURSOR_BASE_URL: string;
  /** e.g. "http://localhost:4000/highfive/models/" -- folder of converted character bodies (see assets-server/scripts/convert-client-rigs.ts), one `<rig>.glb` per race/sex. Unset (or a body that fails to load) leaves that character on the placeholder capsule, see config/character-models.ts. */
  readonly VITE_CHARACTER_MODEL_BASE_URL: string;
  /** e.g. "http://localhost:4000/highfive/textures/" -- folder of converted character textures (see assets-server/scripts/convert-client-rigs.ts), laid out as `<rig>/<part>-<variant>.png` beside an index.json saying how many variants each rig ships. Unset leaves every body on the flat per-part tints, see config/character-textures.ts. */
  readonly VITE_CHARACTER_TEXTURE_BASE_URL: string;
  /** e.g. "http://localhost:4000/highfive/data/" -- folder of tables converted out of the client's own `system/*.dat` (see assets-server/scripts/convert-npcstring.ts and config/client-data-urls.ts). Currently just npcstring, which resolves the `<fstring>` ids npc dialogue is written in; unset leaves those showing as bare numbers. */
  readonly VITE_CLIENT_DATA_BASE_URL: string;
  /** e.g. "http://localhost:4000/highfive/datapack/" -- folder of the reference tables that turn ids into words: item and npc names, skill descriptions, system messages, the stat tables tooltips read (see config/datapack-urls.ts and lib/datapack-cache.ts). These shipped in the bundle out of public/ until they moved to the assets server to keep third-party data out of the repository; unset leaves every one of them empty, so the UI shows raw ids. */
  readonly VITE_DATAPACK_BASE_URL: string;
  /** @lineage2js/network Logger verbosity bitmask (NONE=0, INFO=1, WARNING=2, ERROR=4, DEBUG=8). Defaults to INFO. */
  readonly VITE_L2JSC_LOG_LEVEL: string;
  /**
   * "true" to seed GameStore with fake placeholder data (inventory, skills,
   * party, char stats, hotbar, ...) so every window has something to show
   * with no server connection -- useful for UI development/screenshots.
   * Unset/anything else: GameStore starts empty/neutral, so real network
   * testing never shows demo data mixed in with real server data. See
   * config/env.ts's IS_DEMO_MODE.
   */
  readonly VITE_IS_DEMO_MODE: string;
  /**
   * "true" to stitch geodata tiles into a continuous mesh across cell/layer
   * boundaries instead of independent per-cell flat quads (the default --
   * matches how the real G3D geodata editor renders it, see config/env.ts's
   * IS_GEODATA_TERRAIN_SMOOTH).
   */
  readonly VITE_GEODATA_TERRAIN_SMOOTH: string;
  /**
   * Local dev convenience only -- prefills the login form (never
   * auto-submits) so a test account doesn't need retyping on every reload.
   * Only read in dev (import.meta.env.DEV) -- see config/env.ts's
   * DEV_LOGIN_CREDENTIALS, stripped entirely from a production build. Never
   * set a real password in a committed file; both .env and .env.local are
   * gitignored, but keep this in .env.local specifically so it can't ever
   * accidentally end up in a shared .env someone copies around.
   */
  readonly VITE_DEV_LOGIN_USERNAME: string;
  readonly VITE_DEV_LOGIN_PASSWORD: string;
  /** L2 login server host, e.g. "127.0.0.1". Defaults to 127.0.0.1 if unset. */
  readonly VITE_LOGIN_SERVER_IP: string;
  /** L2 login server port, e.g. "2106". Defaults to 2106 if unset. */
  readonly VITE_LOGIN_SERVER_PORT: string;
  /** "true" connects via wss:// instead of ws://. Required when this app itself is served over https, which any real deploy is -- browsers block a plain ws:// connection from an https page as mixed content. The login server (and whatever game server it hands off to, see MMOConfig.Secure) must actually terminate TLS for this to work, e.g. via a reverse proxy in front of it. */
  readonly VITE_LOGIN_SERVER_SECURE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
