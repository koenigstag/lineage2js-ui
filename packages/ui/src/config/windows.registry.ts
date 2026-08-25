import type { ReactNode } from "react";
import { CONFIRM_WINDOW_Z_INDEX } from "./z-index";

export type WindowType = "titlebar" | "sidebar" | "only-body";

export type WindowOrigin = "top-left" | "top-right" | "bottom-left" | "bottom-right" | "top-center";

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
  /** Corner (or "top-center" for horizontal centering) the persisted x/y is measured from. Defaults to "top-left". */
  origin?: WindowOrigin;
  /** x/y are distances from the origin corner ("top-center": x is the horizontal offset from screen-center). Defaults to screen-center when omitted. */
  defaultPosition?: (viewport: Viewport) => WindowPosition;
  /** Fixed z-index that overrides WindowManagerStore's normal per-window focus-order counter (which never leaves the low hundreds) -- for windows that must sit above/below other overlay tiers regardless of focus history, see config/z-index.ts. */
  zIndex?: number;
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
  settings: { id: "settings", type: "titlebar", title: "windows.settings", closable: true, draggable: true },
  character: { id: "character", type: "titlebar", title: "windows.character", closable: true, draggable: true },
  inventory: {
    id: "inventory",
    type: "titlebar",
    title: "windows.inventory",
    closable: true,
    draggable: true,
    contentBackground: "#141313",
  },
  "skills-list": {
    id: "skills-list",
    type: "titlebar",
    title: "windows.skillsList",
    closable: true,
    draggable: true,
  },
  skill: { id: "skill", type: "titlebar", title: "windows.skill", closable: true, draggable: true },
  quests: { id: "quests", type: "titlebar", title: "windows.quests", icon: "🗞️", closable: true, draggable: true },
  "quest-info": {
    id: "quest-info",
    type: "titlebar",
    title: "windows.questInfo",
    icon: "🗞️",
    closable: false,
    draggable: false,
  },
  clan: { id: "clan", type: "titlebar", title: "windows.clan", closable: true, draggable: true },
  actions: { id: "actions", type: "titlebar", title: "windows.actions", closable: true, draggable: true },
  macroses: {
    id: "macroses",
    type: "titlebar",
    title: "windows.macroList",
    closable: true,
    draggable: true,
  },
  macro: {
    id: "macro",
    type: "titlebar",
    title: "windows.macro",
    icon: "🪄",
    closable: true,
    draggable: true,
  },
  map: {
    id: "map",
    type: "titlebar",
    title: "windows.map",
    closable: true,
    draggable: true,
    origin: "top-right",
  },
  "game-menu": {
    id: "game-menu",
    type: "sidebar",
    closable: false,
    draggable: true,
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
  "system-messages": {
    id: "system-messages",
    type: "sidebar",
    closable: false,
    draggable: true,
    defaultOpen: true,
    origin: "bottom-left",
    // Stacked above the chat window's default box (bottom-left, ~210px tall
    // with its log + send row) so the two don't overlap on first launch.
    defaultPosition: () => ({ x: 10, y: 230 }),
  },
  effects: {
    id: "effects",
    type: "sidebar",
    closable: false,
    draggable: true,
    defaultOpen: true,
    defaultPosition: () => ({ x: 220, y: 10 }),
    bare: true,
    contentPadding: 0,
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
  "target-select": {
    id: "target-select",
    type: "sidebar",
    closable: false,
    draggable: true,
    minimizable: true,
    defaultOpen: true,
    origin: "top-center",
    defaultPosition: () => ({ x: 0, y: 10 }),
  },
  resurrect: {
    id: "resurrect",
    type: "titlebar",
    title: "resurrect.title",
    // No close button -- accept/decline (see resurrect.window.tsx) are the
    // only ways out, same "answer, don't dismiss" rule as death/disconnect.
    closable: false,
    draggable: true,
    // Always "open" -- windows-root.tsx collapses it via GameStore.resurrectRequest
    // instead, same hide-when-empty treatment as party-char-info/target-select.
    defaultOpen: true,
    origin: "top-center",
    defaultPosition: () => ({ x: 0, y: 80 }),
    zIndex: CONFIRM_WINDOW_Z_INDEX,
  },
  "party-invite": {
    id: "party-invite",
    type: "titlebar",
    title: "partyInvite.title",
    closable: false,
    draggable: true,
    defaultOpen: true,
    origin: "top-center",
    // Stacked below resurrect's default box so the two don't overlap if
    // both happen to be pending at once.
    defaultPosition: () => ({ x: 0, y: 190 }),
    zIndex: CONFIRM_WINDOW_Z_INDEX,
  },
  "trade-request": {
    id: "trade-request",
    type: "titlebar",
    title: "tradeRequest.title",
    closable: false,
    draggable: true,
    defaultOpen: true,
    origin: "top-center",
    defaultPosition: () => ({ x: 0, y: 300 }),
    zIndex: CONFIRM_WINDOW_Z_INDEX,
  },
  "duel-request": {
    id: "duel-request",
    type: "titlebar",
    title: "duelRequest.title",
    closable: false,
    draggable: true,
    defaultOpen: true,
    origin: "top-center",
    defaultPosition: () => ({ x: 0, y: 410 }),
    zIndex: CONFIRM_WINDOW_Z_INDEX,
  },
  "pair-action-request": {
    id: "pair-action-request",
    type: "titlebar",
    title: "pairActionRequest.title",
    closable: false,
    draggable: true,
    defaultOpen: true,
    origin: "top-center",
    defaultPosition: () => ({ x: 0, y: 520 }),
    zIndex: CONFIRM_WINDOW_Z_INDEX,
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
  "system-messages",
  "effects",
  "radar",
  "char-info",
  "party-char-info",
  "target-select",
  "resurrect",
  "party-invite",
  "trade-request",
  "duel-request",
  "pair-action-request",
];

export const LOGIN_WINDOW_IDS = ["settings"];
