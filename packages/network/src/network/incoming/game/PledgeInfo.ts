import GameClientPacket from "./GameClientPacket";

export default class PledgeInfo extends GameClientPacket {
  ClanId!: number;
  ClanName!: string;
  AllyName!: string;

  // @Override
  readImpl(): boolean {
    const _id = this.readC();
    this.ClanId = this.readD();
    this.ClanName = this.readS();
    this.AllyName = this.readS();

    return true;
  }
}
