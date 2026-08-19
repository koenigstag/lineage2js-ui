import GameClientPacket from "./GameClientPacket";

export default class HennaInfo extends GameClientPacket {
  // Cumulative equipped-Henna stat deltas (see L2User.HennaSTR and its
  // comment). Each dye trades a bonus on one stat for a penalty on another
  // (see dist/game/data/stats/hennaList.xml in the H5 reference server, e.g.
  // dyeId=1 is str +1 / con -3) -- server accumulates per stat via
  // Player.java's _hennaSTR += ..., clamped at +5 but with no floor, so the
  // total can go negative. Written on the wire as a signed byte (Java's
  // writeByte(int)), hence readSignedC() below, not readC().
  Int!: number;
  Str!: number;
  Con!: number;
  Men!: number;
  Dex!: number;
  Wit!: number;

  // @Override
  readImpl(): boolean {
    const _id = this.readC();

    this.Int = this.readSignedC();
    this.Str = this.readSignedC();
    this.Con = this.readSignedC();
    this.Men = this.readSignedC();
    this.Dex = this.readSignedC();
    this.Wit = this.readSignedC();

    const _slots = this.readD(); // 3

    const _hennaEquipListSize = this.readD();

    for (let i = 0; i < _hennaEquipListSize; i++) {
      const _dyeId = this.readD();
      const _unk = this.readD();
    }
    return true;
  }
}
