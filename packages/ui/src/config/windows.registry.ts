import type { ReactNode } from "react";

export type WindowType = "titlebar" | "sidebar" | "only-body";

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
  /** Defaults to screen-center (via DEFAULT_WINDOW_SIZE) when omitted. */
  defaultPosition?: (viewport: Viewport) => WindowPosition;
}

const SLOT_SIZE = 34;
const SLOT_GAP = 2;
const HOTBAR_WIDTH = 12 * SLOT_SIZE + 11 * SLOT_GAP;

export const WINDOW_REGISTRY: Record<string, WindowConfig> = {
  settings: { id: "settings", type: "titlebar", title: "Settings", icon: "⚙️", closable: true, draggable: true },
  character: { id: "character", type: "titlebar", title: "Character", icon: "👨", closable: true, draggable: true },
  inventory: { id: "inventory", type: "titlebar", title: "Inventory", icon: "🎒", closable: true, draggable: true },
  "skills-list": {
    id: "skills-list",
    type: "titlebar",
    title: "Skills",
    icon: "📖",
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
  clan: { id: "clan", type: "titlebar", title: "Clan", icon: "🚩", closable: true, draggable: true },
  actions: { id: "actions", type: "titlebar", title: "Actions", icon: "🤜", closable: true, draggable: true },
  macroses: {
    id: "macroses",
    type: "titlebar",
    title: "Macros panel",
    icon: "⚙️",
    closable: true,
    draggable: true,
  },
  map: { id: "map", type: "titlebar", title: "Map", icon: "🗺️", closable: true, draggable: true },
  hotbar: {
    id: "hotbar",
    type: "sidebar",
    closable: false,
    draggable: true,
    defaultOpen: true,
    defaultPosition: (viewport) => ({ x: (viewport.width - HOTBAR_WIDTH) / 2, y: viewport.height - 70 }),
  },
  chat: {
    id: "chat",
    type: "only-body",
    closable: false,
    draggable: false,
    defaultOpen: true,
    defaultPosition: (viewport) => ({ x: 10, y: viewport.height - 210 }),
  },
  battlelog: {
    id: "battlelog",
    type: "sidebar",
    closable: false,
    draggable: true,
    defaultOpen: true,
    defaultPosition: (viewport) => ({ x: 10, y: viewport.height - 410 }),
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
  "map",
  "hotbar",
  "chat",
  "battlelog",
  "effects",
  "radar",
  "char-info",
  "party-char-info",
];

export const LOGIN_WINDOW_IDS = ["settings"];
