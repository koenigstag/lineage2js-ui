import { observer } from "mobx-react-lite";
import { EffectCategory, type L2Buff } from "@lineage2js/network";
import { SkillSlot } from "../core/skill-slot.component";
import { useGameStore } from "../../../stores/StoreContext";
import { getSkillEffectCategory } from "../../../config/skill-effect-mapping";

const SLOT_SIZE = 34;
export const BUFF_ICON_SIZE = SLOT_SIZE / 2;
const SLOT_GAP = 2;

const rowStyle = { display: "flex", flexWrap: "wrap" as const, gap: SLOT_GAP, minHeight: BUFF_ICON_SIZE };

// Debuffs/Passives are unlikely to ever actually show up here (debuffs
// render on the target, not the viewer -- see target-select.window.tsx;
// passives are never sent as a timed buff at all), kept only so a stray
// entry still has a row instead of silently landing nowhere.
const ROW_ORDER: EffectCategory[] = [
  EffectCategory.Buff,
  EffectCategory.Dance,
  EffectCategory.Toggle,
  EffectCategory.Trigger,
  EffectCategory.Debuff,
  EffectCategory.Passive,
];

function groupByCategory(buffs: L2Buff[]): Map<EffectCategory, L2Buff[]> {
  const groups = new Map<EffectCategory, L2Buff[]>();
  for (const buff of buffs) {
    // Unclassified (id not in skill-effect-fields.json yet) falls back to
    // the default Buff row, same as the server's own default bucket.
    const category = getSkillEffectCategory(buff.Id) ?? EffectCategory.Buff;
    const group = groups.get(category);
    if (group) {
      group.push(buff);
    } else {
      groups.set(category, [buff]);
    }
  }
  return groups;
}

export const EffectsContent = observer(function EffectsContent() {
  const game = useGameStore();
  const groups = groupByCategory(game.buffs);
  const categories = ROW_ORDER.filter((category) => groups.has(category));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SLOT_GAP }}>
      {categories.length === 0 && !game.shortBuff && <div style={rowStyle} />}
      {categories.map((category) => (
        <div key={category} style={rowStyle}>
          {groups.get(category)!.map((buff) => (
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
      ))}
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
