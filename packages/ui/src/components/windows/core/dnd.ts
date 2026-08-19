import type { DragEvent } from "react";
import { ShortcutType } from "@lineage2js/network";

/**
 * Native HTML5 drag-and-drop for hotbar shortcuts (item/skill/action/macro/
 * recipe/bookmark -- every ShortcutType). Payload is generic over
 * ShortcutType rather than a per-kind shape so that shortcuts this codebase
 * has no source panel for yet (MACRO/RECIPE/BOOKMARK, which only ever arrive
 * via ShortCutInit/Register from the server) can still be reordered or
 * cleared like any other hotbar slot.
 */
export const HOTBAR_DND_MIME = "application/x-l2js-shortcut";

export interface HotbarDragSource {
  from: "hotbar";
  slot: number;
}

export interface HotbarDragPayload {
  shortcutType: ShortcutType;
  targetId: number;
  /** SKILL shortcuts only. */
  level?: number;
  /** Set only when dragging an existing hotbar slot -- lets the drop target move/swap instead of copy. */
  source?: HotbarDragSource;
}

export function setHotbarDragPayload(
  e: DragEvent<HTMLElement>,
  shortcutType: ShortcutType,
  targetId: number,
  level?: number,
  source?: HotbarDragSource
): void {
  const payload: HotbarDragPayload = { shortcutType, targetId, level, source };
  e.dataTransfer.setData(HOTBAR_DND_MIME, JSON.stringify(payload));
  // copyMove: lets the hotbar treat inventory/skill/action drops as a copy
  // and hotbar-to-hotbar drops as a move -- browsers block the drop entirely
  // if dropEffect isn't included in effectAllowed.
  e.dataTransfer.effectAllowed = "copyMove";
}

/** Only dataTransfer.types (MIME names, not data) are readable in onDragOver -- the full payload is only available in onDrop. */
export function hasHotbarDragPayload(e: DragEvent<HTMLElement>): boolean {
  return e.dataTransfer.types.includes(HOTBAR_DND_MIME);
}

export function readHotbarDragPayload(e: DragEvent<HTMLElement>): HotbarDragPayload | null {
  const raw = e.dataTransfer.getData(HOTBAR_DND_MIME);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as HotbarDragPayload;
  } catch {
    return null;
  }
}
