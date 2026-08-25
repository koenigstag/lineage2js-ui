import { useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import { Slot, type IconBorder } from "./slot.component";
import { getSkillSlotContent, type SkillSlotParams } from "../../../config/skill-mapping";

export interface SkillSlotProps extends SkillSlotParams {
  size?: number;
  pressed?: boolean;
  slotKey?: string;
  iconBorder?: IconBorder;
  onClick?: () => void;
  /** Overlays a live ticking seconds count on the icon once expiresAt drops to 60s or less -- the "about to expire" warning real clients show on buff icons. Only meaningful together with expiresAt. */
  countdownWarning?: boolean;
}

const COUNTDOWN_WARNING_THRESHOLD_MS = 60_000;

/**
 * Slot for a skill/buff/learnable-skill icon -- shared by the skills-list
 * window, the skill-learn panel, buff bars and the hotbar (see
 * ShortcutSlot). observer-wrapped for the same reason as ActionSlot (see
 * its doc comment): getSkillSlotContent reads DatapackStore.skillNames,
 * which loads asynchronously, and a non-observer component's own observable
 * reads don't get tracked by an observer ancestor's reaction.
 */
export const SkillSlot = observer(function SkillSlot({ size, pressed, slotKey, iconBorder, onClick, countdownWarning, ...params }: SkillSlotProps) {
  const { expiresAt } = params;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!countdownWarning || expiresAt === undefined) {
      return;
    }
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [countdownWarning, expiresAt]);

  const remainingMs = expiresAt !== undefined ? Math.max(0, expiresAt - now) : undefined;
  const countdownSeconds =
    countdownWarning && remainingMs !== undefined && remainingMs <= COUNTDOWN_WARNING_THRESHOLD_MS
      ? Math.ceil(remainingMs / 1000)
      : undefined;

  const slot = (
    <Slot
      type="inventory"
      size={size}
      pressed={pressed}
      slotKey={slotKey}
      iconBorder={iconBorder}
      content={{ ...getSkillSlotContent(params), countdownSeconds }}
    />
  );

  return onClick ? (
    <div onClick={onClick} style={{ cursor: "pointer" }}>
      {slot}
    </div>
  ) : (
    slot
  );
});
