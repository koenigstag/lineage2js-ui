import { Slot, type IconBorder } from "./slot.component";
import { getItemSlotContent, type ItemSlotParams } from "../../../config/item-mapping";

export interface ItemSlotProps extends ItemSlotParams {
  size?: number;
  pressed?: boolean;
  slotKey?: string;
  iconBorder?: IconBorder;
  onClick?: () => void;
}

/** Slot for an item icon -- shared by the inventory window, a skill's required-item preview and the hotbar (see ShortcutSlot). */
export function ItemSlot({ size, pressed, slotKey, iconBorder, onClick, ...params }: ItemSlotProps) {
  const slot = (
    <Slot type="inventory" size={size} pressed={pressed} slotKey={slotKey} iconBorder={iconBorder} content={getItemSlotContent(params)} />
  );

  return onClick ? (
    <div onClick={onClick} style={{ cursor: "pointer" }}>
      {slot}
    </div>
  ) : (
    slot
  );
}
