import { observer } from "mobx-react-lite";
import { SkillSlot } from "../core/skill-slot.component";
import { useGameStore } from "../../../stores/StoreContext";

const SLOT_SIZE = 34;
export const BUFF_ICON_SIZE = SLOT_SIZE / 2;
const SLOT_GAP = 2;

const rowStyle = { display: "flex", flexWrap: "wrap" as const, gap: SLOT_GAP, minHeight: BUFF_ICON_SIZE };

export const EffectsContent = observer(function EffectsContent() {
  const game = useGameStore();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SLOT_GAP }}>
      <div style={rowStyle}>
        {game.buffs.map((buff) => (
          <SkillSlot
            key={buff.Id}
            id={buff.Id}
            level={buff.SkillLevel}
            size={BUFF_ICON_SIZE}
            // No cost -- buffs aren't cast by the viewer, MP price isn't relevant here.
            expiresAt={Date.now() + buff.RemainingTime * 1000}
            countdownWarning
          />
        ))}
      </div>
      {game.shortBuff && (
        // Healing-potion reuse cooldown -- always its own row, separate from
        // the regular buff list (see ShortBuffStatusUpdate.ts).
        <div style={rowStyle}>
          <SkillSlot
            id={game.shortBuff.Id}
            level={game.shortBuff.SkillLevel}
            size={BUFF_ICON_SIZE}
            expiresAt={Date.now() + game.shortBuff.RemainingTime * 1000}
            countdownWarning
          />
        </div>
      )}
    </div>
  );
});
