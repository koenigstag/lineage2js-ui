import { observer } from "mobx-react-lite";
import { ShortcutType, type Actions, type L2Shortcut } from "@lineage2js/network";
import { Slot, type IconBorder } from "../core/slot.component";
import { SkillSlot } from "../core/skill-slot.component";
import { ItemSlot } from "../core/item-slot.component";
import { ActionSlot } from "../core/action-slot.component";
import { useGameStore } from "../../../stores/StoreContext";
import { resolveShortcutItem, getShortcutFallbackContent } from "../../../config/shortcut-mapping";
import { getItemSlotType } from "../../../config/item-mapping";

interface ShortcutSlotProps {
  slotKey?: string;
  shortcut: L2Shortcut | undefined;
  pressed?: boolean;
  iconBorder?: IconBorder;
}

/**
 * Dispatches a hotbar shortcut to the matching domain slot component,
 * explicitly passing detail="short" (hotbar is never the item/skill's own
 * domain window, see TooltipDetail) -- not left to SkillSlot/ItemSlot's own
 * default, so this invariant doesn't silently break if that default ever
 * changes. MACRO/RECIPE/BOOKMARK and an unresolved ITEM (target no longer in
 * inventory) have no dedicated component, so those fall back to a plain
 * category-labelled Slot.
 */
export const ShortcutSlot = observer(function ShortcutSlot({ slotKey, shortcut, pressed, iconBorder }: ShortcutSlotProps) {
  const game = useGameStore();

  if (!shortcut) {
    return <Slot type="hotbar" slotKey={slotKey} pressed={pressed} iconBorder={iconBorder} />;
  }

  switch (shortcut.Type) {
    case ShortcutType.SKILL:
      return (
        <SkillSlot
          id={shortcut.TargetId}
          level={shortcut.Level}
          detail="short"
          slotKey={slotKey}
          pressed={pressed}
          iconBorder={iconBorder}
        />
      );

    case ShortcutType.ITEM: {
      const item = resolveShortcutItem(shortcut, game.inventoryItems);
      if (!item) {
        return (
          <Slot type="hotbar" slotKey={slotKey} pressed={pressed} iconBorder={iconBorder} content={getShortcutFallbackContent("item-misc")} />
        );
      }
      return (
        <ItemSlot
          id={item.Id}
          slotType={getItemSlotType(item)}
          count={item.Count}
          detail="short"
          slotKey={slotKey}
          pressed={pressed}
          iconBorder={iconBorder}
        />
      );
    }

    case ShortcutType.ACTION:
      return <ActionSlot code={shortcut.TargetId as Actions} slotKey={slotKey} pressed={pressed} iconBorder={iconBorder} />;

    case ShortcutType.MACRO:
      return <Slot type="hotbar" slotKey={slotKey} pressed={pressed} iconBorder={iconBorder} content={getShortcutFallbackContent("macro")} />;

    default:
      // RECIPE/BOOKMARK/NONE -- no dedicated window/component yet either.
      return <Slot type="hotbar" slotKey={slotKey} pressed={pressed} iconBorder={iconBorder} content={getShortcutFallbackContent("action")} />;
  }
});
