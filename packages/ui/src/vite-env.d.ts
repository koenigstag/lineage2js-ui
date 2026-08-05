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
  /** e.g. "http://localhost:4000/geodata/{regionX}_{regionY}.l2j" -- raw L2J geodata region file, "{regionX}"/"{regionY}" get replaced with the region's coordinates. Sliced into the smaller streaming tile unit in memory, see l2j-region-parser.ts. */
  readonly VITE_GEODATA_REGION_BASE_URL: string;
  /** @lineage2js/network Logger verbosity bitmask (NONE=0, INFO=1, WARNING=2, ERROR=4, DEBUG=8). Defaults to INFO. */
  readonly VITE_L2JSC_LOG_LEVEL: string;
  /** L2 login server host, e.g. "127.0.0.1". Defaults to 127.0.0.1 if unset. */
  readonly VITE_LOGIN_SERVER_IP: string;
  /** L2 login server port, e.g. "2106". Defaults to 2106 if unset. */
  readonly VITE_LOGIN_SERVER_PORT: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
