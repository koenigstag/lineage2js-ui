import { Slot, type IconBorder } from "./slot.component";
import { getActionSlotContent, type ActionSlotParams } from "../../../config/user-actions";

export interface ActionSlotProps extends ActionSlotParams {
  size?: number;
  pressed?: boolean;
  slotKey?: string;
  iconBorder?: IconBorder;
  onClick?: () => void;
  /** Dims the slot and (if there's an onClick) blocks it -- also applies with no onClick, so e.g. a server-disallowed action still visibly dims even though this codebase hasn't wired a dispatch for it yet (see actions.window.tsx). */
  disabled?: boolean;
}

/** Slot for an action icon -- shared by the actions window and the hotbar (see ShortcutSlot). */
export function ActionSlot({ size, pressed, slotKey, iconBorder, onClick, disabled, ...params }: ActionSlotProps) {
  const slot = (
    <Slot type="hotbar" size={size} pressed={pressed} slotKey={slotKey} iconBorder={iconBorder} content={getActionSlotContent(params)} />
  );

  if (!onClick && !disabled) {
    return slot;
  }

  return (
    <div
      onClick={disabled ? undefined : onClick}
      style={{ opacity: disabled ? 0.5 : 1, cursor: !onClick ? "default" : disabled ? "not-allowed" : "pointer" }}
    >
      {slot}
    </div>
  );
}
