import { observer } from "mobx-react-lite";
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

/**
 * Slot for an action icon -- shared by the actions window and the hotbar
 * (see ShortcutSlot). observer-wrapped (not just its callers) because
 * getActionSlotContent's name resolution reads DatapackStore.actionNames,
 * which loads asynchronously after mount -- a non-observer component's own
 * observable reads are invisible to MobX (only an observer's own render
 * establishes a tracked scope; a child function component's reads, even
 * nested synchronously under an observer parent, don't get swept into the
 * parent's reaction -- React calls child components in a separate pass of
 * its own work loop, not literally inside the parent's call frame). Without
 * this, a slot whose parent doesn't ALSO happen to re-render for some other
 * observable reason (actions window: only game.isBasicActionAllowed, which
 * may or may not still be pending) is frozen at whatever content it first
 * rendered with -- if that was before actionNames finished loading, the
 * tooltip shows the raw "action.name.<code>" key forever, even after the
 * table loads and the slot gets hovered again (confirmed live: re-hovering
 * after DatapackStore.actionNames populated did not update the tooltip
 * without this fix).
 */
export const ActionSlot = observer(function ActionSlot({ size, pressed, slotKey, iconBorder, onClick, disabled, ...params }: ActionSlotProps) {
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
});
