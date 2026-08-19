import GameClientPacket from "./GameClientPacket";

// Empty confirmation packet sent after a successful RequestAcquireSkill --
// the server follows up with fresh SkillList/AcquireSkillList (and UserInfo
// for the new Sp) right after, which the existing sync handlers already
// pick up.
export default class AcquireSkillDone extends GameClientPacket {
  // @Override
  readImpl(): boolean {
    const _id = this.readC();

    return true;
  }
}
