import { observer } from "mobx-react-lite";
import type { CSSProperties } from "react";
import { ShortcutType, type Actions, type L2Shortcut } from "@lineage2js/network";
import { Slot, type IconBorder } from "../core/slot.component";
import { SkillSlot } from "../core/skill-slot.component";
import { ItemSlot } from "../core/item-slot.component";
import { ActionSlot } from "../core/action-slot.component";
import { useGameStore } from "../../../stores/StoreContext";
import { resolveShortcutItem, resolveShortcutSkill, getShortcutFallbackContent } from "../../../config/shortcut-mapping";
import { getItemSlotType, getItemGradeLabel, isShotItem } from "../../../config/item-mapping";

/** Border shown on a shot's icon while its auto-use (RequestAutoSoulShot) is toggled on -- see GameStore.toggleAutoShot, hotbar's RMB handler. */
const AUTO_SHOT_ICON_BORDER: IconBorder = { from: "#9a9a9a", to: "#9a9a9a" };

/**
 * "Glass" overlay for a shot slot with auto-use active -- a flat white
 * layer at 20% opacity composited on top of the icon, not a CSS filter:
 * filter operates on the whole element (icon, count badge, border)
 * uniformly, whereas a separate absolutely-positioned layer composites
 * cleanly over everything already drawn and stays out of the slot's own
 * click/drag handlers via pointer-events: none.
 */
const AUTO_SHOT_GLASS_STYLE: CSSProperties = {
  position: "absolute",
  inset: 0,
  zIndex: 3,
  pointerEvents: "none",
  backgroundColor: "rgba(255, 255, 255, 0.2)",
};

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
          cost={resolveShortcutSkill(shortcut, game.skills)?.Mp}
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
      const autoActive = isShotItem(item) && game.isAutoShotEnabled(item.Id);
      const slot = (
        <ItemSlot
          id={item.Id}
          slotType={getItemSlotType(item)}
          count={item.Count}
          grade={getItemGradeLabel(item)}
          detail="short"
          slotKey={slotKey}
          pressed={pressed}
          iconBorder={autoActive ? AUTO_SHOT_ICON_BORDER : iconBorder}
        />
      );
      if (!autoActive) {
        return slot;
      }
      return (
        <div style={{ position: "relative" }}>
          {slot}
          <div style={AUTO_SHOT_GLASS_STYLE} />
        </div>
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
