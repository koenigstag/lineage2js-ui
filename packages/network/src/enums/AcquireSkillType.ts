// Ordinal order matches the server's AcquireSkillType enum exactly (the wire
// sends/reads this as a plain ordinal int) -- see AcquireSkillList/
// AcquireSkillInfo/RequestAcquireSkill(Info).
export enum AcquireSkillType {
  CLASS = 0,
  FISHING = 1,
  PLEDGE = 2,
  SUBPLEDGE = 3,
  TRANSFORM = 4,
  TRANSFER = 5,
  SUBCLASS = 6,
  COLLECT = 7,
}
