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
 * skill's own static data at cast time; splitting game.buffs into
 * per-category rows client-side needs an equivalent skill id ->
 * EffectCategory table, which doesn't exist yet (see TODO.md).
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
