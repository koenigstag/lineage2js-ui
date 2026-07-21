/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_REGISTER_URL: string;
  readonly VITE_RESTORE_PASSWORD_URL: string;
  readonly VITE_WIKI_URL: string;
  /** e.g. "https://cdn.example.com/icons/skill/{id}.png" -- "{id}" gets replaced with skill.id. */
  readonly VITE_SKILL_ICON_BASE_URL: string;
  /** "{id}" gets replaced with item.id. */
  readonly VITE_ITEM_ICON_BASE_URL: string;
  /** "{id}" gets replaced with an action id (action, pet-action, pair-action, party action). */
  readonly VITE_ACTION_ICON_BASE_URL: string;
  /** "{id}" gets replaced with char.baseClassId / char.classId. */
  readonly VITE_CLASS_ICON_BASE_URL: string;
  /** e.g. "http://localhost:4000/legacy/images/titlescreens/{id}.jpg" -- "{id}" gets replaced with a random 1..N, N fetched from the server's sibling "count" endpoint. */
  readonly VITE_LOGIN_BACKGROUND_IMAGE_BASE_URL: string;
  /** e.g. "http://localhost:4000/legacy/videos/titlescreens/{id}.mp4" -- same "{id}" + "count" endpoint convention as the image variant. */
  readonly VITE_LOGIN_BACKGROUND_VIDEO_BASE_URL: string;
  /** @lineage2js/network Logger verbosity bitmask (NONE=0, INFO=1, WARNING=2, ERROR=4, DEBUG=8). Defaults to INFO. */
  readonly VITE_L2JSC_LOG_LEVEL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
