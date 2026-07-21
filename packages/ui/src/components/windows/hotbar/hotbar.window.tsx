import { useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import { ShortcutType, type L2Item, type L2Shortcut } from "@lineage2js/network";
import { Slot, type IconBorder } from "../core/slot.component";
import type { TooltipInfo } from "../../core/tooltip.component";
import { useGameStore, useSessionStore } from "../../../stores/StoreContext";
import { getShortcutSlotType, getShortcutIconUrl, getShortcutName } from "../../../config/shortcut-mapping";
import { t } from "../../../lang/lang";

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

function getShortcutTooltip(shortcut: L2Shortcut, inventoryItems: L2Item[]): TooltipInfo {
  const name = getShortcutName(shortcut, inventoryItems);

  switch (shortcut.Type) {
    case ShortcutType.ITEM:
      return { kind: "item", name, type: getShortcutSlotType(shortcut, inventoryItems), id: shortcut.TargetId };
    case ShortcutType.SKILL:
      return { kind: "skill", name, stats: t("tooltip.levelLabel", { level: shortcut.Level }), id: shortcut.TargetId };
    default:
      return { kind: "simple", name };
  }
}

/** Sends the network request a hotbar shortcut maps to. No-ops for types that have no client command yet (ACTION/MACRO/RECIPE/BOOKMARK). */
function activateShortcut(shortcut: L2Shortcut, client: ReturnType<typeof useSessionStore>["client"], inventoryItems: L2Item[]) {
  if (!client.GameClient.IsConnected) {
    return;
  }

  switch (shortcut.Type) {
    case ShortcutType.SKILL:
      client.cast(shortcut.TargetId);
      break;
    case ShortcutType.ITEM: {
      const item = inventoryItems.find((candidate) => candidate.Id === shortcut.TargetId);
      if (item) {
        client.useItem(item);
      }
      break;
    }
    default:
      break;
  }
}

export const HotbarContent = observer(function HotbarContent() {
  const game = useGameStore();
  const session = useSessionStore();
  const [pressedSlot, setPressedSlot] = useState<number | undefined>(undefined);

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
        activateShortcut(shortcut, session.client, game.inventoryItems);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [game, session]);

  return (
    <div style={{ display: "flex", flexDirection: "column-reverse", gap: 2 }}>
      {HOTBAR_ROWS.map((row, rowIndex) => (
        <div key={rowIndex} style={{ display: "flex", gap: 2 }}>
          {row.map((slotKey, columnIndex) => {
            const slotIndex = rowIndex * COLUMNS + columnIndex;
            const shortcut = game.hotbarSlots[slotIndex];
            return (
              <Slot
                key={slotKey}
                type="hotbar"
                slotKey={slotKey}
                pressed={pressedSlot === slotIndex}
                content={
                  shortcut
                    ? {
                        type: getShortcutSlotType(shortcut, game.inventoryItems),
                        data: shortcut,
                        iconUrl: getShortcutIconUrl(shortcut),
                        tooltip: getShortcutTooltip(shortcut, game.inventoryItems),
                      }
                    : undefined
                }
                iconBorder={HOTBAR_ICON_BORDER}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
});
