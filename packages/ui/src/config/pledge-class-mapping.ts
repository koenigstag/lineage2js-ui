import { t } from "../lang/lang";

/**
 * Highest PledgeClass tier this project has a name for (see
 * lang/en_US.ts's charInfo.pledgeClass table and L2Character.PledgeClass's
 * own doc comment) -- clan level 10's "Grand Duke". lineage2ts's
 * L2ClanMember.calculatePledgeClass can technically return up to 11, but
 * that tier (King/Emperor) was never shipped in the retail client's own
 * string table, so it's treated the same as Grand Duke here rather than
 * leaking a missing translation key.
 */
const MAX_KNOWN_PLEDGE_CLASS = 10;

/**
 * Clan-rank tier label for the character stats window's "Status" row
 * (L2Character.PledgeClass, server-computed from clan level/pledge type/
 * Noblesse/Hero status -- see that field's doc comment). 0 (or no data yet)
 * reads as "Vagabond", the real client's own default for anyone with no
 * clan -- distinct from a player's free-text custom Title, which isn't
 * shown in this row.
 */
export function getPledgeClassLabel(pledgeClass: number | undefined): string {
  const clamped = Math.max(0, Math.min(pledgeClass ?? 0, MAX_KNOWN_PLEDGE_CLASS));
  return t(`charInfo.pledgeClass.${clamped}`);
}
