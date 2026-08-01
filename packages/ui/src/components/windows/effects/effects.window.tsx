import { observer } from "mobx-react-lite";
import { Slot } from "../core/slot.component";
import { useGameStore } from "../../../stores/StoreContext";
import { getSkillSlotContent } from "../../../config/skill-mapping";

const SLOT_SIZE = 34;
export const BUFF_ICON_SIZE = SLOT_SIZE / 2;
const SLOT_GAP = 2;

export const EffectsContent = observer(function EffectsContent() {
  const game = useGameStore();

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: SLOT_GAP }}>
      {game.buffs.map((buff) => (
        <Slot
          key={buff.Id}
          type="inventory"
          size={BUFF_ICON_SIZE}
          content={getSkillSlotContent({
            id: buff.Id,
            level: buff.SkillLevel,
            // No cost -- buffs aren't cast by the viewer, MP price isn't relevant here.
            expiresAt: Date.now() + buff.RemainingTime * 1000,
          })}
        />
      ))}
    </div>
  );
});
