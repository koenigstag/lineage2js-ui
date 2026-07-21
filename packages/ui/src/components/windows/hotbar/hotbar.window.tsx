import { observer } from "mobx-react-lite";
import { ShortcutType, type L2Item, type L2Shortcut } from "@lineage2js/network";
import { Slot, type IconBorder } from "../core/slot.component";
import type { TooltipInfo } from "../../core/tooltip.component";
import { useGameStore } from "../../../stores/StoreContext";
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

export const HotbarContent = observer(function HotbarContent() {
  const game = useGameStore();

  return (
    <div style={{ display: "flex", flexDirection: "column-reverse", gap: 2 }}>
      {HOTBAR_ROWS.map((row, rowIndex) => (
        <div key={rowIndex} style={{ display: "flex", gap: 2 }}>
          {row.map((slotKey, columnIndex) => {
            const shortcut = game.hotbarSlots[rowIndex * COLUMNS + columnIndex];
            return (
              <Slot
                key={slotKey}
                type="hotbar"
                slotKey={slotKey}
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
