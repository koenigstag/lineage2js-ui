import { observer } from "mobx-react-lite";
import { SkillSlot } from "../core/skill-slot.component";
import { useGameStore } from "../../../stores/StoreContext";

const SLOT_SIZE = 34;
export const BUFF_ICON_SIZE = SLOT_SIZE / 2;
const SLOT_GAP = 2;

export const EffectsContent = observer(function EffectsContent() {
  const game = useGameStore();

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: SLOT_GAP }}>
      {game.buffs.map((buff) => (
        <SkillSlot
          key={buff.Id}
          id={buff.Id}
          level={buff.SkillLevel}
          size={BUFF_ICON_SIZE}
          // No cost -- buffs aren't cast by the viewer, MP price isn't relevant here.
          expiresAt={Date.now() + buff.RemainingTime * 1000}
        />
      ))}
    </div>
  );
});
