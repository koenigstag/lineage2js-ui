import GameClientPacket from "./GameClientPacket";

export default class GetItem extends GameClientPacket {
  /** Creature that picked the item up -- any nearby player, not just us. */
  PlayerId!: number;
  /** The picked-up item's object id. */
  ObjectId!: number;
  Location!: number[];

  // @Override
  readImpl(): boolean {
    const _id = this.readC();

    this.PlayerId = this.readD();
    this.ObjectId = this.readD();
    this.Location = this.readLoc();

    return true;
  }
}
