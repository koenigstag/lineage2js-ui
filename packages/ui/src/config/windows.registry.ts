import type { ReactNode } from "react";

export type WindowType = "titlebar" | "sidebar" | "only-body";

export type WindowOrigin = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export interface WindowPosition {
  x: number;
  y: number;
}

export interface Viewport {
  width: number;
  height: number;
}

export interface WindowConfig {
  id: string;
  type: WindowType;
  title?: string;
  icon?: ReactNode;
  closable: boolean;
  minimizable?: boolean;
  draggable: boolean;
  /** Windows that are part of the persistent HUD (hotbar, chat, ...) rather than opened on demand. */
  defaultOpen?: boolean;
  /** Corner the persisted x/y is measured from. Defaults to "top-left". */
  origin?: WindowOrigin;
  /** x/y are distances from the origin corner. Defaults to screen-center when omitted. */
  defaultPosition?: (viewport: Viewport) => WindowPosition;
  /** Overrides the content area's background color. */
  contentBackground?: string;
  /** Overrides the content area's padding (default 8). */
  contentPadding?: number;
  /** Sidebar-type only: skip rendering the drag-handle strip. */
  hideStrip?: boolean;
  /** Skip the container's own background/border entirely; content supplies its own chrome. */
  bare?: boolean;
  windowStyle?: {
    root?: React.CSSProperties;
    content?: React.CSSProperties;
    sidebar?: React.CSSProperties;
    titlebar?: React.CSSProperties;
    titleIcon?: React.CSSProperties;
    title?: React.CSSProperties;
    closeButton?: React.CSSProperties;
  };
}

const SLOT_SIZE = 34;
const SLOT_GAP = 2;
const HOTBAR_WIDTH = 12 * SLOT_SIZE + 11 * SLOT_GAP;

export const WINDOW_REGISTRY: Record<string, WindowConfig> = {
  settings: { id: "settings", type: "titlebar", title: "Settings", closable: true, draggable: true },
  character: { id: "character", type: "titlebar", title: "Character", closable: true, draggable: true },
  inventory: {
    id: "inventory",
    type: "titlebar",
    title: "Inventory",
    closable: true,
    draggable: true,
    contentBackground: "#141313",
  },
  "skills-list": {
    id: "skills-list",
    type: "titlebar",
    title: "Skills",
    closable: true,
    draggable: true,
  },
  skill: { id: "skill", type: "titlebar", title: "Skill Info", icon: "📖", closable: true, draggable: true },
  quests: { id: "quests", type: "titlebar", title: "Quests", icon: "🗞️", closable: true, draggable: true },
  "quest-info": {
    id: "quest-info",
    type: "titlebar",
    title: "Quest Info",
    icon: "🗞️",
    closable: false,
    draggable: false,
  },
  clan: { id: "clan", type: "titlebar", title: "Clan", closable: true, draggable: true },
  actions: { id: "actions", type: "titlebar", title: "Actions", icon: "🤜", closable: true, draggable: true },
  macroses: {
    id: "macroses",
    type: "titlebar",
    title: "Macro List",
    icon: "🪄",
    closable: true,
    draggable: true,
  },
  macro: {
    id: "macro",
    type: "titlebar",
    title: "Macro",
    icon: "🪄",
    closable: true,
    draggable: true,
  },
  map: {
    id: "map",
    type: "titlebar",
    title: "Map",
    closable: true,
    draggable: true,
    origin: "top-right",
  },
  "game-menu": {
    id: "game-menu",
    type: "sidebar",
    closable: false,
    draggable: false,
    hideStrip: true,
    bare: true,
    contentPadding: 0,
    defaultOpen: true,
    origin: "bottom-right",
    defaultPosition: () => ({ x: 10, y: 10 }),
  },
  hotbar: {
    id: "hotbar",
    type: "sidebar",
    closable: false,
    draggable: true,
    defaultOpen: true,
    origin: "bottom-left",
    defaultPosition: (viewport) => ({ x: (viewport.width - HOTBAR_WIDTH) / 2, y: 10 }),
    contentBackground: "#161513",
    windowStyle: {
      content: {
        padding: '6px 20px',
      },
    },
  },
  chat: {
    id: "chat",
    type: "only-body",
    closable: false,
    draggable: false,
    defaultOpen: true,
    origin: "bottom-left",
    defaultPosition: () => ({ x: 10, y: 10 }),
  },
  battlelog: {
    id: "battlelog",
    type: "sidebar",
    closable: false,
    draggable: true,
    defaultOpen: true,
    origin: "bottom-left",
    defaultPosition: () => ({ x: 10, y: 70 }),
  },
  effects: {
    id: "effects",
    type: "sidebar",
    closable: false,
    draggable: true,
    defaultOpen: true,
    defaultPosition: () => ({ x: 220, y: 10 }),
  },
  radar: {
    id: "radar",
    type: "only-body",
    closable: false,
    draggable: true,
    defaultOpen: true,
    defaultPosition: (viewport) => ({ x: viewport.width - 170, y: 10 }),
  },
  "char-info": {
    id: "char-info",
    type: "sidebar",
    closable: false,
    draggable: true,
    minimizable: true,
    defaultOpen: true,
    defaultPosition: () => ({ x: 10, y: 10 }),
  },
  "party-char-info": {
    id: "party-char-info",
    type: "sidebar",
    closable: false,
    draggable: true,
    minimizable: true,
    defaultOpen: true,
    defaultPosition: () => ({ x: 10, y: 100 }),
  },
};

export const GAME_WINDOW_IDS = [
  "settings",
  "character",
  "inventory",
  "skills-list",
  "skill",
  "quests",
  "quest-info",
  "clan",
  "actions",
  "macroses",
  "macro",
  "map",
  "game-menu",
  "hotbar",
  "chat",
  "battlelog",
  "effects",
  "radar",
  "char-info",
  "party-char-info",
];

export const LOGIN_WINDOW_IDS = ["settings"];
