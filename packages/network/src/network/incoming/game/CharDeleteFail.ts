import { CharDeleteFailReason } from "../../../enums/CharDeleteFailReason";
import GameClientPacket from "./GameClientPacket";

/**
 * Deletion refused (opcode 0x1e, then a D reason) -- matches lineage2ts's
 * send/CharacteDeleteFail.ts, declared size 5. The server follows it with a
 * fresh roster regardless, same as on success.
 */
export default class CharDeleteFail extends GameClientPacket {
  FailReason!: CharDeleteFailReason;

  // @Override
  readImpl(): boolean {
    const _id = this.readC();
    this.FailReason = (CharDeleteFailReason as any)[this.readD()];

    return true;
  }
}
