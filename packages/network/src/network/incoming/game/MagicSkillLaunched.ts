import GameClientPacket from "./GameClientPacket";

export default class MagicSkillLaunched extends GameClientPacket {
  ActiveCharObjId!: number;
  SkillId!: number;

  // @Override
  readImpl(): boolean {
    const _id = this.readC();

    this.ActiveCharObjId = this.readD();
    this.SkillId = this.readD();
    const _skillLevel = this.readD();

    const _targetsNum = this.readD();

    for (let i = 0; i < _targetsNum; i++) {
      const _targetId = this.readD();
    }

    return true;
  }
}
