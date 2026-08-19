/**
 * How a skill's active effect gets bucketed for display -- mirrors
 * lineage2ts's server-side characterEffects.ts (game-server/source/
 * gameService/models/characterEffects.ts), whose private getEffectList(skill)
 * does exactly this switch:
 *
 *   if (skill.isPassive())  return this.getPassives()
 *   if (skill.isDebuff)     return this.getDebuffs()
 *   if (skill.isTrigger())  return this.getTriggered()
 *   if (skill.isDance())    return this.getDances()   // Bard songs and Dancer dances share the same SkillMagicType.Dance
 *   if (skill.isToggle())   return this.getToggles()
 *   else                    return this.getBuffs()    // the default bucket
 *
 * The wire protocol's own AbnormalStatusUpdate packet (opcode 0x85) does
 * NOT tag each entry with its category -- it's a flat {skillId, skillLevel,
 * timeLeftSeconds} list (see lineage2ts's packets/send/builder/
 * AbnormalStatusUpdate.ts). The server derives the category from each
 * skill's own static data (magicClass/operateType/isDebuff, sourced from
 * lineage2ts's own datapack CSV -- game-server/source/data/type/sqlite/
 * SkillData.ts loads exactly these three fields into Skill.magic/
 * operateType/isDebuff) at cast time. Splitting game.buffs into
 * per-category rows client-side needs the same three raw fields per skill
 * id (see public/skill-effect-fields/data.json) plus getEffectCategory()
 * below, which applies the identical precedence.
 *
 * Passive skills are never sent as a timed buff at all (no icon, no
 * duration) -- Passive is included here only for parity with the server's
 * own bucket list, not something a client ever needs to render.
 *
 * Not covered by this bucket system: the healing-potion reuse-cooldown icon
 * (skill.isHealingPotionSkill()) is excluded from AbnormalStatusUpdate
 * entirely and sent via its own ShortBuffStatusUpdate packet instead (see
 * network/incoming/game/ShortBuffStatusUpdate.ts, already implemented) --
 * it isn't an EffectCategory.
 */
export enum EffectCategory {
  Buff = "buff",
  Debuff = "debuff",
  Dance = "dance",
  Toggle = "toggle",
  Trigger = "trigger",
  Passive = "passive",
}

/**
 * The three datapack fields getEffectCategory() needs -- see this file's
 * doc comment for where each one comes from and what it means:
 *   magicClass: SkillMagicType (0 PhysicalCast, 1 MagicCast, 2 StaticAbility, 3 Dance, 4 Trigger)
 *   operateType: SkillOperateType code ("P" Passive, "T" Toggle, everything else active: A1/A2/A3/A4/CA1/CA5/DA1/DA2)
 *   isDebuff: the datapack's own isDebuff flag
 */
export interface SkillEffectFields {
  magicClass: number;
  operateType: string;
  isDebuff: boolean;
}

const DANCE_MAGIC_CLASS = 3;
const TRIGGER_MAGIC_CLASS = 4;

/**
 * Same precedence as lineage2ts's characterEffects.ts's getEffectList()
 * (see this file's top comment) -- order matters: a debuff-flagged Dance/
 * Trigger skill is a Debuff, not a Dance/Trigger, same as server-side.
 */
export function getEffectCategory({ magicClass, operateType, isDebuff }: SkillEffectFields): EffectCategory {
  if (operateType === "P") {
    return EffectCategory.Passive;
  }
  if (isDebuff) {
    return EffectCategory.Debuff;
  }
  if (magicClass === TRIGGER_MAGIC_CLASS) {
    return EffectCategory.Trigger;
  }
  if (magicClass === DANCE_MAGIC_CLASS) {
    return EffectCategory.Dance;
  }
  if (operateType === "T") {
    return EffectCategory.Toggle;
  }
  return EffectCategory.Buff;
}
