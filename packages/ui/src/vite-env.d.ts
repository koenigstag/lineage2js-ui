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
  /** e.g. "http://localhost:4000/legacy/images/titlescreens/{id}.jpg" -- "{id}" gets replaced with a random 1..N, N fetched from the server's sibling "count" endpoint. */
  readonly VITE_LOGIN_BACKGROUND_IMAGE_BASE_URL: string;
  /** e.g. "http://localhost:4000/legacy/videos/titlescreens/{id}.mp4" -- same "{id}" + "count" endpoint convention as the image variant. */
  readonly VITE_LOGIN_BACKGROUND_VIDEO_BASE_URL: string;
  /** e.g. "http://localhost:4000/highfive/geodata-tiles/{tileX}_{tileY}.bin" -- pre-baked geodata tile (see assets-server/scripts/convert-l2j-geodata.ts), "{tileX}"/"{tileY}" get replaced with the tile's coordinates. Deserialized directly, see geo-tile-parser.ts. */
  readonly VITE_GEODATA_TILE_BASE_URL: string;
  /** @lineage2js/network Logger verbosity bitmask (NONE=0, INFO=1, WARNING=2, ERROR=4, DEBUG=8). Defaults to INFO. */
  readonly VITE_L2JSC_LOG_LEVEL: string;
  /** L2 login server host, e.g. "127.0.0.1". Defaults to 127.0.0.1 if unset. */
  readonly VITE_LOGIN_SERVER_IP: string;
  /** L2 login server port, e.g. "2106". Defaults to 2106 if unset. */
  readonly VITE_LOGIN_SERVER_PORT: string;
  /** "true" connects via wss:// instead of ws://. Required when this app itself is served over https (e.g. GitHub Pages) -- browsers block a plain ws:// connection from an https page as mixed content. The login server (and whatever game server it hands off to, see MMOConfig.Secure) must actually terminate TLS for this to work, e.g. via a reverse proxy in front of it. */
  readonly VITE_LOGIN_SERVER_SECURE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
