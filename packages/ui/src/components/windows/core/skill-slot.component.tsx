import { Slot, type IconBorder } from "./slot.component";
import { getSkillSlotContent, type SkillSlotParams } from "../../../config/skill-mapping";

export interface SkillSlotProps extends SkillSlotParams {
  size?: number;
  pressed?: boolean;
  slotKey?: string;
  iconBorder?: IconBorder;
  onClick?: () => void;
}

/** Slot for a skill/buff/learnable-skill icon -- shared by the skills-list window, the skill-learn panel, buff bars and the hotbar (see ShortcutSlot). */
export function SkillSlot({ size, pressed, slotKey, iconBorder, onClick, ...params }: SkillSlotProps) {
  const slot = (
    <Slot type="inventory" size={size} pressed={pressed} slotKey={slotKey} iconBorder={iconBorder} content={getSkillSlotContent(params)} />
  );

  return onClick ? (
    <div onClick={onClick} style={{ cursor: "pointer" }}>
      {slot}
    </div>
  ) : (
    slot
  );
}
