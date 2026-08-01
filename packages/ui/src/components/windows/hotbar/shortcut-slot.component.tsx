import { observer } from "mobx-react-lite";
import type { L2Shortcut } from "@lineage2js/network";
import { Slot, type IconBorder } from "../core/slot.component";
import { useGameStore } from "../../../stores/StoreContext";
import { getShortcutSlotContent } from "../../../config/shortcut-mapping";

interface ShortcutSlotProps {
  slotKey?: string;
  shortcut: L2Shortcut | undefined;
  pressed?: boolean;
  iconBorder?: IconBorder;
}

/** Wraps the generic Slot with hotbar-shortcut-specific content resolution (icon/name/tooltip against the live inventory -- see shortcut-mapping.ts). */
export const ShortcutSlot = observer(function ShortcutSlot({ slotKey, shortcut, pressed, iconBorder }: ShortcutSlotProps) {
  const game = useGameStore();

  return (
    <Slot
      type="hotbar"
      slotKey={slotKey}
      pressed={pressed}
      content={shortcut ? getShortcutSlotContent(shortcut, game.inventoryItems) : undefined}
      iconBorder={iconBorder}
    />
  );
});
