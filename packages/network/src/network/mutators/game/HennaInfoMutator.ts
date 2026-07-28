import IMMOClientMutator from "../../../mmocore/IMMOClientMutator";
import GameClient from "../../GameClient";
import HennaInfo from "../../incoming/game/HennaInfo";

export default class HennaInfoMutator extends IMMOClientMutator<
  GameClient,
  HennaInfo
> {
  update(packet: HennaInfo): void {
    const char = this.Client.ActiveChar;

    char.HennaSTR = packet.Str;
    char.HennaDEX = packet.Dex;
    char.HennaCON = packet.Con;
    char.HennaINT = packet.Int;
    char.HennaWIT = packet.Wit;
    char.HennaMEN = packet.Men;
  }
}
