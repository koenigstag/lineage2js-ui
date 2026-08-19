import AbstractGameCommand from "./AbstractGameCommand";
import MoveBackwardToLocation from "../network/outgoing/game/MoveBackwardToLocation";
import ValidatePosition from "../network/outgoing/game/ValidatePosition";

export default class CommandMoveTo extends AbstractGameCommand {
  execute(x: number, y: number, z: number): void {
    const char = this.GameClient?.ActiveChar;

    if (char) {
      const originX = char.X;
      const originY = char.Y;
      const originZ = char.Z;

      this.GameClient?.sendPacket(
        new MoveBackwardToLocation(x, y, z, originX, originY, originZ)
      );

      this.GameClient?.sendPacket(
        new ValidatePosition(originX, originY, originZ, char.Heading, 0)
      );

      // Client-side prediction: a real L2 client starts walking the moment
      // it sends this request, it doesn't wait for the server to echo a
      // MoveToLocation back -- and this server only broadcasts that packet
      // to OTHER nearby players who need to see us move, not back to the
      // mover itself (confirmed against lineage2ts's MoveToLocation.ts
      // handler: it calls AIEffectHelper.notifyMoveWithCoordinates, which
      // drives the AI controller/broadcast, but never replies to the
      // requester). Without this, our own character would never visibly
      // move -- setMovingTo is otherwise only ever invoked by
      // MoveToLocationMutator/MoveToPawnMutator in response to an incoming
      // packet. Any drift from the server's authoritative position gets
      // corrected the same way it already does for a rejected/adjusted
      // move (see the Z-desync branch's ActionFailed + ValidateLocation).
      char.setMovingTo(originX, originY, originZ, x, y, z);
    }
  }
}
