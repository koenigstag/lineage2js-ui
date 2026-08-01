import GameClientPacket from "./GameClientPacket";

// Opcode 0xfa. The healing-potion reuse-cooldown icon, sent separately from
// AbnormalStatusUpdate -- lineage2ts's BuffInfo.isShortBuff() (true only for
// abnormalType === HP_RECOVER, i.e. healing potions) explicitly excludes it
// from the normal buff list and routes it through this packet instead. A
// (0, 0, 0) packet clears it (see lineage2ts's ResetShortBuffStatus).
export default class ShortBuffStatusUpdate extends GameClientPacket {
  SkillId!: number;
  SkillLevel!: number;
  /** Seconds, same convention as AbnormalStatusUpdate's per-buff remaining time. */
  Duration!: number;

  // @Override
  readImpl(): boolean {
    const _id = this.readC();
    this.SkillId = this.readD();
    this.SkillLevel = this.readD();
    this.Duration = this.readD();

    return true;
  }
}
