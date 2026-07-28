import GameClientPacket from "./GameClientPacket";

// Sent on every peace-zone vitality regen tick (see VitalityTask.java in the
// H5 reference server) -- unlike UserInfo/StatusUpdate, this fires purely
// for vitality changes, so it's the only way to see the vitality bar move
// live while resting in town instead of waiting for the next full refresh.
export default class ExVitalityPointInfo extends GameClientPacket {
  VitalityPoints!: number;

  // @Override
  readImpl(): boolean {
    const _id = this.readC();
    const _sub = this.readH();

    this.VitalityPoints = this.readD();

    return true;
  }
}
