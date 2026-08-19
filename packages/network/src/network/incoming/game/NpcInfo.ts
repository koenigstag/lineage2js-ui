import AbstractNpcInfo from "./AbstractNpcInfo";
import L2Npc from "../../../entities/L2Npc";
import L2Mob from "../../../entities/L2Mob";
import L2Creature from "../../../entities/L2Creature";
import GameServerPacket from "../../outgoing/game/GameServerPacket";

export default class NpcInfo extends AbstractNpcInfo {
  ObjectId!: number;
  IsAttackable!: boolean;
  Creature!: L2Creature;

  // @Override
  readImpl(): boolean {
    const _id: number = this.readC();
    this.ObjectId = this.readD();
    const _idTemplate = this.readD() - 1000000;
    this.IsAttackable = this.readD() === 1;

    if (this.IsAttackable) {
      this.Creature = new L2Mob();
    } else {
      this.Creature = new L2Npc();
    }

    this.Creature.Id = _idTemplate;
    this.Creature.ObjectId = this.ObjectId;
    this.Creature.IsAttackable = this.IsAttackable;
    this.Creature.X = this.readD();
    this.Creature.Y = this.readD();
    this.Creature.Z = this.readD();

    this.Creature.Heading = this.readD();

    const _pad1 = this.readD();
    this.Creature.MAtkSpd = this.readD();
    this.Creature.PAtkSpd = this.readD();

    this.Creature.RunSpeed = this.readD();
    this.Creature.WalkSpeed = this.readD();
    this.Creature.SwimRunSpeed = this.readD();
    this.Creature.SwimWalkSpeed = this.readD();
    this.Creature.FlyRunSpeed = this.readD();
    this.Creature.FlyWalkSpeed = this.readD();

    const _flyRunSpd1 = this.readD();
    const _flyWalkSpd1 = this.readD();

    this.Creature.SpeedMultiplier = this.readF();
    this.Creature.AtkSpdMultiplier = this.readF();
    this.Creature.CollisionRadius = this.readF();
    this.Creature.CollisionHeight = this.readF();

    // Same Paperdoll array/index space as players (L2Creature.Paperdoll) --
    // just three of its 25 possible slots. Densely pre-filled, not left
    // sparse -- see CharInfo.ts's identical comment (matters even more
    // here, since 22 of the 25 slots are never touched at all).
    const paperdoll: Array<number | undefined> = new Array<number | undefined>(GameServerPacket.PAPERDOLL_TOTALSLOTS).fill(
      undefined
    );
    paperdoll[GameServerPacket.PAPERDOLL_RHAND] = this.readD(); // right hand weapon display id
    paperdoll[GameServerPacket.PAPERDOLL_CHEST] = this.readD();
    paperdoll[GameServerPacket.PAPERDOLL_LHAND] = this.readD(); // left hand weapon display id
    this.Creature.Paperdoll = paperdoll;

    const _unkn1 = this.readC(); // name above char 1=true ... ??
    this.Creature.IsRunning = this.readC() === 1;
    this.Creature.IsInCombat = this.readC() === 1;
    this.Creature.IsDead = this.readC() === 1;
    const _isSummoned = this.readC() === 2; // invisible ?? 0=false 1=true 2=summoned (only works if model has a summon animation)

    const _unkn2 = this.readD();
    // Real wire name -- previously discarded into a throwaway `_name`, with
    // a "Mob #<id>"/"NPC #<id>" placeholder assigned above instead. Confirmed
    // against both L2J_Mobius's AbstractNpcInfo.java (`_name = _npc.getName();
    // buffer.writeString(_name);` right before the title write) and
    // lineage2ts's NpcInfo.ts (`.writeS(name).writeS(title)`, same order) --
    // both write name then title at exactly this position. Some templates
    // deliberately send an empty string here (lineage2ts's
    // isUsingServerSideName() flag) and expect the client to resolve the
    // display name itself from its own id->name table -- see
    // config/npc-name-mapping.ts's getNpcName() in the UI package, which
    // falls back to the old placeholder when this is empty AND the id isn't
    // in that table either.
    this.Creature.Name = this.readS();
    const _unkn3 = this.readD();
    this.Creature.Title = this.readS();

    const _pad2 = this.readD();
    const _pad3 = this.readD();
    const _pad4 = this.readD();

    // let _titleColor = this.readD(); // Title color 0=client default
    // let _pvpFlag = this.readD(); // pvp flag
    // let _karma = this.readD(); // karma

    const _invisibleVisualEffect = this.readD();
    const _clanId = this.readD();
    const _clanCrest = this.readD();
    const _allyId = this.readD();
    const _allyCrest = this.readD();

    const _insideZone = this.readC(); // 1=water, 2=flying
    const _teamId = this.readC();

    // Real protocol quirk, not a vendored-parser bug: NpcInfo writes
    // collision radius/height a second time here (confirmed against
    // lineage2ts's NpcInfoWithCharacters writer -- both writes use the same
    // source value), so this repeat is intentionally discarded in favor of
    // the first occurrence assigned to Creature.CollisionRadius/Height above.
    const _collisionRadiusRepeat = this.readF();
    const _collisionHeightRepeat = this.readF();
    const _enchantEffect = this.readD(); // C4
    const _isFlying = this.readD() === 1; // C6
    const _pad5 = this.readD();
    const _colorEffect = this.readD(); // CT1.5 Pet form and skills, Color effect

    this.Creature.IsTargetable = this.readC() === 1;
    const _isShowName = this.readC() === 1;
    const _abnormalVisualEffectSpecial = this.readD();
    const _displayEffect = this.readD();

    return true;
  }
}
