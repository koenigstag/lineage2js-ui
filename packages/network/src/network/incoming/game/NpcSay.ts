import GameClientPacket from "./GameClientPacket";

/**
 * An NPC/mob talking (opcode 0x30) -- a separate packet from CreatureSay,
 * with the speaker identified by npc template id instead of by name.
 *
 * Either NpcStringId is -1 and a single literal line follows, or it names an
 * entry of the client's NpcString table and the lines that follow are that
 * entry's $s1/$s2 parameters (server side: NpcSay.fromNpcText vs
 * fromNpcString). This client has no NpcString table, so the string-id form
 * arrives with nothing renderable -- see NpcSayMutator for how that is
 * surfaced.
 */
export default class NpcSay extends GameClientPacket {
  ObjectId: number = 0;
  Type: number = 0;
  /** Npc template id, already un-offset from the wire's +1000000. */
  NpcId: number = 0;
  /** -1 when Messages carries the literal text, otherwise an NpcString id. */
  NpcStringId: number = -1;
  Messages: string[] = [];

  // @Override
  readImpl(): boolean {
    const _id = this.readC();
    this.ObjectId = this.readD();
    this.Type = this.readD();
    this.NpcId = this.readD() - 1000000;
    this.NpcStringId = this.readD();

    while (this.hasMoreData()) {
      this.Messages.push(this.readS());
    }

    return true;
  }
}
