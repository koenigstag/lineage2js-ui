import GameServerPacket from "./GameServerPacket";

/**
 * Protocol version this client speaks: 273, id est High Five. The server
 * checks it against its own supported set the moment this arrives and refuses
 * the connection outright if it isn't in there -- see incoming/game/KeyPacket.ts
 * for the reply, which is where that verdict comes back.
 */
export const GAME_PROTOCOL_VERSION = 273;

export default class ProtocolVersion extends GameServerPacket {
  constructor(
    public protocolVersion: number = GAME_PROTOCOL_VERSION /** use value=-2 in order to "ping" */
  ) {
    super();
  }

  write(): void {
    this.writeC(0x0e);
    this.writeD(this.protocolVersion);
  }
}
