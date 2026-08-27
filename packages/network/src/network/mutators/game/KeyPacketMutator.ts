import IMMOClientMutator from "../../../mmocore/IMMOClientMutator";
import GameClient from "../../GameClient";
import KeyPacket from "../../incoming/game/KeyPacket";

export default class KeyPacketMutator extends IMMOClientMutator<
  GameClient,
  KeyPacket
> {
  update(packet: KeyPacket): void {
    if (!packet.IsProtocolOk) {
      // Rejected handshake: the server never enabled encryption on its side
      // and is closing the socket, and the key it sent is all zeroes (see
      // KeyPacket). Installing it would only garble anything still in
      // flight, and there is nothing left to decrypt anyway.
      return;
    }
    this.Client.setCryptInitialKey(packet.BlowfishKey);
  }
}
