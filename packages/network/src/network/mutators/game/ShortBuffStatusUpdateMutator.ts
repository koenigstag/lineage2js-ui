import IMMOClientMutator from "../../../mmocore/IMMOClientMutator";
import GameClient from "../../GameClient";
import L2Buff from "../../../entities/L2Buff";
import ShortBuffStatusUpdate from "../../incoming/game/ShortBuffStatusUpdate";

export default class ShortBuffStatusUpdateMutator extends IMMOClientMutator<
  GameClient,
  ShortBuffStatusUpdate
> {
  update(packet: ShortBuffStatusUpdate): void {
    // (0, 0, 0) is the server's own "clear it" packet (see
    // ShortBuffStatusUpdate.ts's doc comment).
    if (packet.SkillId === 0) {
      this.Client.ShortBuff = undefined;
      return;
    }

    const buff = new L2Buff(packet.SkillId, packet.SkillLevel);
    buff.RemainingTime = packet.Duration;
    if (buff.RemainingTime > 0) {
      buff.autoCountDown(() => {
        if (this.Client.ShortBuff === buff) {
          this.Client.ShortBuff = undefined;
        }
      });
    }
    this.Client.ShortBuff = buff;
  }
}
