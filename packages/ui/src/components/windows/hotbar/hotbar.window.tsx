import { useEffect, useState, type DragEvent, type MouseEvent } from "react";
import { observer } from "mobx-react-lite";
import { L2Shortcut, ShortcutType, type Actions } from "@lineage2js/network";
import type { IconBorder } from "../core/slot.component";
import { ShortcutSlot } from "./shortcut-slot.component";
import { hasHotbarDragPayload, readHotbarDragPayload, setHotbarDragPayload } from "../core/dnd";
import { useGameStore, useSessionStore } from "../../../stores/StoreContext";
import { resolveShortcutItem } from "../../../config/shortcut-mapping";
import { isShotItem } from "../../../config/item-mapping";
import { findActionByCode } from "../../../config/user-actions";

const ROW_1 = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "="];
const ROW_2 = ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p", "[", "]"];
const COLUMNS = 12;

const HOTBAR_ROWS: string[][] = [
  ROW_1,
  ROW_2,
  ROW_1.map((key) => `K${key}`),
  ROW_2.map((key) => `K${key}`),
];

const PRESS_FLASH_MS = 150;

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA")
  );
}

/** Physical key (lowercased, ignoring Ctrl) -> slot index within a single row set. Undefined if the key isn't mapped. */
function resolveSlotIndex(key: string, ctrlPressed: boolean): number | undefined {
  const baseRow = ROW_1.includes(key) ? 0 : ROW_2.includes(key) ? 1 : undefined;
  if (baseRow === undefined) {
    return undefined;
  }

  const column = (baseRow === 0 ? ROW_1 : ROW_2).indexOf(key);
  const rowIndex = baseRow + (ctrlPressed ? 2 : 0);
  return rowIndex * COLUMNS + column;
}

const HOTBAR_ICON_BORDER: IconBorder = { from: "#a9af7f", to: "#6f5c31" };

/**
 * Sends the network request a hotbar shortcut maps to (left-click/keyboard
 * activation). No-ops for types that have no client command yet (MACRO --
 * see TODO.md, no macro data model exists anywhere in this codebase yet --
 * and RECIPE/BOOKMARK) -- also safe to call while disconnected, no
 * IsConnected check needed (see AbstractGameCommand.requiresGameConnection).
 */
function activateShortcut(shortcut: L2Shortcut, game: ReturnType<typeof useGameStore>, client: ReturnType<typeof useSessionStore>["client"]) {
  switch (shortcut.Type) {
    case ShortcutType.SKILL:
      client.cast(shortcut.TargetId);
      break;
    case ShortcutType.ITEM: {
      // Same UseItem (0x19) call for both equip/unequip toggle and consuming
      // a potion -- the server decides which based on the item's own type,
      // there's no separate client-side branch needed (see CommandUseItem).
      const item = resolveShortcutItem(shortcut, game.inventoryItems);
      if (item) {
        client.useItem(item);
      }
      break;
    }
    case ShortcutType.ACTION: {
      // Reuses the exact same Action definitions (dispatch + guards) as
      // actions.window.tsx, so a hotbar-bound action honors the same
      // preconditions (e.g. RECOMMEND needing a target) it would there.
      const action = findActionByCode(shortcut.TargetId as Actions);
      if (action?.dispatch && game.isBasicActionAllowed(action.code) && (!action.isEnabled || action.isEnabled(game))) {
        action.dispatch(game);
      }
      break;
    }
    default:
      break;
  }
}

/**
 * Right-click activation -- currently only shots (soulshot/spiritshot ITEM
 * shortcuts) do anything here, toggling auto-use (RequestAutoSoulShot, see
 * GameStore.toggleAutoShot). Skills/macros intentionally have no RMB
 * behavior yet: real retail auto-use for those is a purely client-side
 * re-cast timer with no dedicated wire packet, deferred as a separate
 * feature rather than folded into this pass.
 */
function activateShortcutSecondary(shortcut: L2Shortcut, game: ReturnType<typeof useGameStore>) {
  if (shortcut.Type !== ShortcutType.ITEM) {
    return;
  }
  const item = resolveShortcutItem(shortcut, game.inventoryItems);
  if (item && isShotItem(item)) {
    game.toggleAutoShot(item);
  }
}

/** Builds a fresh L2Shortcut for `slot` out of a drag payload -- used both for drops from a source panel (item/skill/action) and hotbar-to-hotbar moves. */
function shortcutFromDragPayload(slot: number, shortcutType: ShortcutType, targetId: number, level?: number): L2Shortcut {
  const shortcut = new L2Shortcut();
  shortcut.Slot = slot;
  shortcut.Type = shortcutType;
  shortcut.TargetId = targetId;
  if (level !== undefined) {
    shortcut.Level = level;
  }
  return shortcut;
}

export const HotbarContent = observer(function HotbarContent() {
  const game = useGameStore();
  const session = useSessionStore();
  const [pressedSlot, setPressedSlot] = useState<number | undefined>(undefined);
  const [dragOverSlot, setDragOverSlot] = useState<number | undefined>(undefined);

  function handleSlotDragStart(e: DragEvent<HTMLDivElement>, slotIndex: number, shortcut: L2Shortcut) {
    setHotbarDragPayload(e, shortcut.Type, shortcut.TargetId, shortcut.Type === ShortcutType.SKILL ? shortcut.Level : undefined, {
      from: "hotbar",
      slot: slotIndex,
    });
  }

  function handleSlotDragOver(e: DragEvent<HTMLDivElement>, slotIndex: number) {
    if (!hasHotbarDragPayload(e)) return;
    // Without preventDefault the browser refuses the drop entirely.
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDragOverSlot(slotIndex);
  }

  function handleSlotDragLeave(slotIndex: number) {
    setDragOverSlot((current) => (current === slotIndex ? undefined : current));
  }

  function handleSlotDrop(e: DragEvent<HTMLDivElement>, slotIndex: number) {
    setDragOverSlot(undefined);
    const payload = readHotbarDragPayload(e);
    if (!payload) return;
    e.preventDefault();
    const shortcut = shortcutFromDragPayload(slotIndex, payload.shortcutType, payload.targetId, payload.level);
    game.setHotbarSlot(slotIndex, shortcut, payload.source);
  }

  function handleSlotDragEnd(e: DragEvent<HTMLDivElement>, slotIndex: number) {
    // Dropped somewhere that didn't accept it (or cancelled) -- clear the source slot.
    if (e.dataTransfer.dropEffect === "none") {
      game.clearHotbarSlot(slotIndex);
    }
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.repeat || event.altKey || event.metaKey || isTypingTarget(event.target)) {
        return;
      }

      const slotIndex = resolveSlotIndex(event.key.toLowerCase(), event.ctrlKey);
      if (slotIndex === undefined) {
        return;
      }

      event.preventDefault();
      setPressedSlot(slotIndex);
      window.setTimeout(() => setPressedSlot((current) => (current === slotIndex ? undefined : current)), PRESS_FLASH_MS);

      const shortcut = game.hotbarSlots[slotIndex];
      if (shortcut) {
        activateShortcut(shortcut, game, session.client);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [game, session]);

  function flashPressed(slotIndex: number) {
    setPressedSlot(slotIndex);
    window.setTimeout(() => setPressedSlot((current) => (current === slotIndex ? undefined : current)), PRESS_FLASH_MS);
  }

  function handleSlotClick(slotIndex: number, shortcut: L2Shortcut | undefined) {
    if (!shortcut) return;
    flashPressed(slotIndex);
    activateShortcut(shortcut, game, session.client);
  }

  function handleSlotContextMenu(e: MouseEvent<HTMLDivElement>, shortcut: L2Shortcut | undefined) {
    e.preventDefault();
    if (!shortcut) return;
    activateShortcutSecondary(shortcut, game);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column-reverse", gap: 2 }}>
      {HOTBAR_ROWS.map((row, rowIndex) => (
        <div key={rowIndex} style={{ display: "flex", gap: 2 }}>
          {row.map((slotKey, columnIndex) => {
            const slotIndex = rowIndex * COLUMNS + columnIndex;
            const shortcut = game.hotbarSlots[slotIndex];
            const isDragOver = dragOverSlot === slotIndex;
            return (
              <div
                key={slotKey}
                draggable={Boolean(shortcut)}
                onDragStart={shortcut ? (e) => handleSlotDragStart(e, slotIndex, shortcut) : undefined}
                onDragOver={(e) => handleSlotDragOver(e, slotIndex)}
                onDragLeave={() => handleSlotDragLeave(slotIndex)}
                onDrop={(e) => handleSlotDrop(e, slotIndex)}
                onDragEnd={(e) => handleSlotDragEnd(e, slotIndex)}
                onClick={() => handleSlotClick(slotIndex, shortcut)}
                onContextMenu={(e) => handleSlotContextMenu(e, shortcut)}
                style={{
                  outline: isDragOver ? "2px solid #d4af6a" : undefined,
                  outlineOffset: isDragOver ? -2 : undefined,
                }}
              >
                <ShortcutSlot
                  slotKey={slotKey}
                  shortcut={shortcut}
                  pressed={pressedSlot === slotIndex}
                  iconBorder={HOTBAR_ICON_BORDER}
                />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
});
