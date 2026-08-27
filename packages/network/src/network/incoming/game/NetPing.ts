import GameClientPacket from "./GameClientPacket";

/**
 * The server's answer to RequestNetPing (opcode 0xd9), carrying one int32.
 *
 * Matched against lineage2ts's send/NetPing.ts (`writeC(0xD9).writeD(
 * timeMillis)`, declared size 3 -- id est opcode + one D), which its
 * RequestNetPing handler calls as `NetPing(player.getOnlineTime())`.
 *
 * The unit of that value is not pinned down by the reference: the send
 * function names its parameter `timeMillis` and the session's own
 * onlineBeginTime is a `Date.now()` millisecond stamp, which both point at
 * milliseconds of the current session -- but getOnlineTime() itself isn't
 * visible from the packet side, and L2J's same-named field is in seconds. So
 * this is exposed raw and named for what it is rather than for a unit, and
 * callers that want a number they can trust should measure the round trip
 * themselves (which is what this packet is actually useful for -- see
 * GameStore's ping heartbeat).
 */
export default class NetPing extends GameClientPacket {
  /** Server-reported online time for this session. Unit unconfirmed -- see this class's doc comment. */
  OnlineTime!: number;

  // @Override
  readImpl(): boolean {
    const _id = this.readC();
    this.OnlineTime = this.readD();

    return true;
  }
}
