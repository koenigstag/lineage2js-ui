import { EffectCategory, getEffectCategory } from "@lineage2js/network";
import { rootStore } from "../stores/RootStore";

/**
 * Reactive read, not baked onto the entity: DatapackStore.skillEffectFields
 * loads asynchronously (see DatapackStore.loadSkillEffectFields()), same
 * treatment as npc-race-mapping.ts's getNpcRace(). AbnormalStatusUpdate never
 * sends a buff's category, only id/level/remaining -- see @lineage2js/network's
 * EffectCategory.ts for where the [magicClass, operateType, isDebuff]
 * table comes from and the precedence getEffectCategory() applies.
 */
export function getSkillEffectCategory(skillId: number): EffectCategory | undefined {
  const fields = rootStore.datapack.skillEffectFields[skillId];
  if (!fields) {
    return undefined;
  }

  const [magicClass, operateType, isDebuff] = fields;
  return getEffectCategory({ magicClass, operateType, isDebuff: isDebuff === 1 });
}
