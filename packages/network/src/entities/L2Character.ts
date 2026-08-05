import L2Creature from "./L2Creature";

export default class L2Character extends L2Creature {
  private _isPartyMember!: boolean;
  private _cp!: number;
  private _maxCp!: number;
  private _level!: number;
  private _clanId!: number;
  private _allyId!: number;
  private _clanCrestId!: number;
  private _allyCrestId!: number;
  // NPC id of the floating Agathion companion, set by equipping an Agathion
  // Bracelet in the L.Bracelet paperdoll slot -- a separate field from
  // Paperdoll (see L2Creature.ts), not derivable from it. 0/absent means no
  // Agathion summoned. Sent by both CharInfo and UserInfo, hence living here
  // rather than on the NPC-shared L2Creature.
  private _agathionId!: number;

  public get ClanId(): number {
    return this._clanId;
  }
  public set ClanId(value: number) {
    this._clanId = value;
  }
  public get AllyId(): number {
    return this._allyId;
  }
  public set AllyId(value: number) {
    this._allyId = value;
  }
  public get ClanCrestId(): number {
    return this._clanCrestId;
  }
  public set ClanCrestId(value: number) {
    this._clanCrestId = value;
  }
  public get AllyCrestId(): number {
    return this._allyCrestId;
  }
  public set AllyCrestId(value: number) {
    this._allyCrestId = value;
  }
  public get AgathionId(): number {
    return this._agathionId;
  }
  public set AgathionId(value: number) {
    this._agathionId = value;
  }

  public get Cp(): number {
    return this._cp;
  }

  public set Cp(value: number) {
    this._cp = value;
  }

  public get MaxCp(): number {
    return this._maxCp;
  }

  public set MaxCp(value: number) {
    this._maxCp = value;
  }
  public get IsPartyMember(): boolean {
    return this._isPartyMember;
  }
  public set IsPartyMember(value: boolean) {
    this._isPartyMember = value;
  }
  public get Level(): number {
    return this._level;
  }
  public set Level(value: number) {
    this._level = value;
  }
}
