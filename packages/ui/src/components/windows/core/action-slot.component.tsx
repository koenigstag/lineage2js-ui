import { Slot, type IconBorder } from "./slot.component";
import { getActionSlotContent, type ActionSlotParams } from "../../../config/user-actions";

export interface ActionSlotProps extends ActionSlotParams {
  size?: number;
  pressed?: boolean;
  slotKey?: string;
  iconBorder?: IconBorder;
  onClick?: () => void;
  /** Dims the slot and blocks onClick -- only meaningful together with onClick (see actions.window.tsx). */
  disabled?: boolean;
}

/** Slot for an action icon -- shared by the actions window and the hotbar (see ShortcutSlot). */
export function ActionSlot({ size, pressed, slotKey, iconBorder, onClick, disabled, ...params }: ActionSlotProps) {
  const slot = (
    <Slot type="hotbar" size={size} pressed={pressed} slotKey={slotKey} iconBorder={iconBorder} content={getActionSlotContent(params)} />
  );

  if (!onClick) {
    return slot;
  }

  return (
    <div
      onClick={disabled ? undefined : onClick}
      style={{ opacity: disabled ? 0.5 : 1, cursor: disabled ? "not-allowed" : "pointer" }}
    >
      {slot}
    </div>
  );
}
