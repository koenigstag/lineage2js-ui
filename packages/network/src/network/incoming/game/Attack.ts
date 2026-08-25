import GameClientPacket from "./GameClientPacket";

export default class Attack extends GameClientPacket {
  AttackerObjectId: number = 0;
  Subjects: number[] = [];
  /** Attacker's position at the moment of this attack (AttackBuilder's own "location" write, right after the first hit). */
  AttackerX: number = 0;
  AttackerY: number = 0;
  AttackerZ: number = 0;
  /**
   * Primary target's position at the moment of this attack (AttackBuilder's
   * trailing "location" write) -- the protocol carries no explicit heading
   * field for the attacker (confirmed against lineage2ts's AttackBuilder.ts:
   * attacker id, hits, attacker location, hit count, remaining hits, target
   * location -- nothing else), so AttackMutator derives one from Attacker*
   * -> Target* the same way L2Creature.setMovingTo already derives a mover's
   * heading from its own from/to positions.
   */
  TargetX: number = 0;
  TargetY: number = 0;
  TargetZ: number = 0;

  // @Override
  readImpl(): boolean {
    const _id = this.readC();

    this.AttackerObjectId = this.readD();

    const _targetId = this.readD();
    const _damage = this.readD();
    const _flags = this.readC();

    this.Subjects.push(_targetId);

    const [attackerX, attackerY, attackerZ] = this.readLoc();
    this.AttackerX = attackerX;
    this.AttackerY = attackerY;
    this.AttackerZ = attackerZ;

    const _hitSize = this.readH();
    for (let i = 0; i < _hitSize; i++) {
      const _targetId1 = this.readD();
      const _damage1 = this.readD();
      const _flags1 = this.readC();

      this.Subjects.push(_targetId1);
    }

    const [targetX, targetY, targetZ] = this.readLoc();
    this.TargetX = targetX;
    this.TargetY = targetY;
    this.TargetZ = targetZ;

    return true;
  }
}
