import L2Object from "./L2Object";
import { Sex } from "../enums/Sex";
import { Race } from "../enums/Race";
import Vector from "../mmocore/Vector";
import { headingBetween } from "./l2-heading";
import L2ObjectCollection from "./L2ObjectCollection";
import L2Buff from "./L2Buff";
import { ClassId } from "../enums/ClassId";
import { Face } from "../enums/Face";
import { HairStyle } from "../enums/HairStyle";
import { HairColor } from "../enums/HairColor";
import GameServerPacket from "../network/outgoing/game/GameServerPacket";

export default abstract class L2Creature extends L2Object {
  private _hp!: number;
  private _mp!: number;
  private _maxHp!: number;
  private _maxMp!: number;
  private _isRunning!: boolean;
  private _isSitting!: boolean;
  private _isFishing!: boolean;

  private _hpPercent!: number;
  private _mpPercent!: number;

  private _dx!: number;
  private _dy!: number;
  private _dz!: number;
  private _pAtk!: number;
  private _pAtkSpd!: number;
  private _mAtk!: number;
  private _mAtkSpd!: number;
  private _isDead = false;
  private _runSpeed!: number;
  private _walkSpeed!: number;
  private _speedMultiplier!: number;
  private _atkSpdMultiplier!: number;
  private _swimRunSpeed!: number;
  private _swimWalkSpeed!: number;
  private _flyRunSpeed!: number;
  private _flyWalkSpeed!: number;
  private _collisionRadius!: number;
  private _collisionHeight!: number;
  private _title!: string;
  private _isInCombat!: boolean;
  private _isNoble!: boolean;
  private _isHero!: boolean;
  private _isAttackable!: boolean;
  private _isTargetable!: boolean;
  private _target!: L2Object | null;
  // Display id per paperdoll slot (index = GameServerPacket.PAPERDOLL_* --
  // 25 slots total, PAPERDOLL_TOTALSLOTS), shared by every creature kind:
  // CharInfo/UserInfo populate all of it for players, NpcInfo populates
  // just the RHAND/CHEST/LHAND indices for NPCs/mobs. Same shape either
  // way, so a caller reads Paperdoll[PAPERDOLL_RHAND] without needing to
  // know or care what kind of creature it has. No 3D asset pipeline renders
  // any of this yet, same "no character art" situation as everything else
  // in components/core/scene.
  //
  // Densely pre-filled with undefined (not left as holes from sparse
  // `arr[slot] = value` assignment) -- Array.prototype.forEach/map/etc.
  // silently skip holes, so a caller iterating slots would miss unequipped
  // ones entirely instead of seeing them as empty.
  private _paperdoll: Array<number | undefined> = new Array<number | undefined>(GameServerPacket.PAPERDOLL_TOTALSLOTS).fill(
    undefined
  );
  private _sex!: Sex;
  private _recommHave!: number;
  private _classId!: ClassId;
  private _className!: string;
  private _baseClassId!: ClassId;
  private _baseClassName!: string;
  private _race!: Race;
  private _isMoving = false;
  private _movingDistance: number = 0;
  // Snapshot of where the current move segment started, plus when (epoch
  // ms) -- so a renderer can compute an exact analytic position for "now"
  // (moveFrom + direction * CurrentSpeed * elapsed) instead of only seeing
  // this class's own coarse 100ms setMovingTo() steps (see below), which
  // are precise enough for gameplay logic (distance checks, etc.) but too
  // sparse to look smooth at 60fps. Undefined until this creature's first
  // setMovingTo() call.
  private _moveFromX?: number;
  private _moveFromY?: number;
  private _moveFromZ?: number;
  private _moveStartedAt?: number;
  private _isReady = true;
  private _karma!: number;
  private _hairStyle!: HairStyle;
  private _hairColor!: HairColor;
  private _face!: Face;
  private _STR!: number;
  private _DEX!: number;
  private _CON!: number;
  private _INT!: number;
  private _WIT!: number;
  private _MEN!: number;
  private _buffs: L2ObjectCollection<L2Buff> = new L2ObjectCollection();

  public get Buffs(): L2ObjectCollection<L2Buff> {
    return this._buffs;
  }
  public set Buffs(value: L2ObjectCollection<L2Buff>) {
    this._buffs = value;
  }

  public get Race(): Race {
    return this._race;
  }

  public set Race(value: Race) {
    this._race = value;
  }

  public get BaseClassName(): string {
    return this._baseClassName;
  }

  public set BaseClassName(value: string) {
    this._baseClassName = value;
  }

  public get BaseClassId(): ClassId {
    return this._baseClassId;
  }

  public set BaseClassId(value: ClassId) {
    this._baseClassId = value;
  }

  public get ClassId(): ClassId {
    return this._classId;
  }

  public set ClassId(value: ClassId) {
    this._classId = value;
  }

  public get ClassName(): string {
    return this._className;
  }

  public set ClassName(value: string) {
    this._className = value;
  }

  public get IsReady(): boolean {
    return this._isReady;
  }
  public set IsReady(value: boolean) {
    this._isReady = value;
  }

  public get Sex(): Sex {
    return this._sex;
  }

  public set Sex(value: Sex) {
    this._sex = value;
  }

  public get Title(): string {
    return this._title;
  }

  public set Title(value: string) {
    this._title = value;
  }

  public get IsTargetable(): boolean {
    return this._isTargetable;
  }

  public set IsTargetable(value: boolean) {
    this._isTargetable = value;
  }

  public get Target(): L2Object | null {
    return this._target;
  }

  public set Target(value: L2Object | null) {
    this._target = value;
  }

  public get Paperdoll(): Array<number | undefined> {
    return this._paperdoll;
  }

  public set Paperdoll(value: Array<number | undefined>) {
    this._paperdoll = value;
  }

  public get IsAttackable(): boolean {
    return this._isAttackable;
  }

  public set IsAttackable(value: boolean) {
    this._isAttackable = value;
  }

  public get FlyWalkSpeed(): number {
    return this._flyWalkSpeed;
  }

  public set FlyWalkSpeed(value: number) {
    this._flyWalkSpeed = value;
  }

  public get FlyRunSpeed(): number {
    return this._flyRunSpeed;
  }

  public set FlyRunSpeed(value: number) {
    this._flyRunSpeed = value;
  }

  public get SwimWalkSpeed(): number {
    return this._swimWalkSpeed;
  }

  public set SwimWalkSpeed(value: number) {
    this._swimWalkSpeed = value;
  }

  public get SwimRunSpeed(): number {
    return this._swimRunSpeed;
  }

  public set SwimRunSpeed(value: number) {
    this._swimRunSpeed = value;
  }

  public get Hp(): number {
    return this._hp;
  }

  public set Hp(value: number) {
    this._hp = value;
    this._hpPercent = (100 * this._hp) / this._maxHp;
    this._isDead = value === 0;
  }

  public get Mp(): number {
    return this._mp;
  }

  public set Mp(value: number) {
    this._mp = value;
    this._mpPercent = (100 * this._mp) / this._maxMp;
  }

  public get MaxHp(): number {
    return this._maxHp;
  }

  public set MaxHp(value: number) {
    this._maxHp = value;
    this._hpPercent = (100 * this._hp) / this._maxHp;
  }

  public get MaxMp(): number {
    return this._maxMp;
  }

  public set MaxMp(value: number) {
    this._maxMp = value;
    this._mpPercent = (100 * this._mp) / this._maxMp;
  }

  public get IsRunning(): boolean {
    return this._isRunning;
  }

  public set IsRunning(value: boolean) {
    this._isRunning = value;
  }

  public get IsSitting(): boolean {
    return this._isSitting;
  }

  public set IsSitting(value: boolean) {
    this._isSitting = value;
  }

  public get IsFishing(): boolean {
    return this._isFishing;
  }

  public set IsFishing(value: boolean) {
    this._isFishing = value;
  }

  public get HpPercent(): number {
    return this._hpPercent;
  }

  public set HpPercent(value: number) {
    this._hpPercent = value;
  }

  public get MpPercent(): number {
    return this._mpPercent;
  }

  public set MpPercent(value: number) {
    this._mpPercent = value;
  }

  public get Dx(): number {
    return this._dx;
  }

  public set Dx(value: number) {
    this._dx = value;
  }

  public get Dy(): number {
    return this._dy;
  }

  public set Dy(value: number) {
    this._dy = value;
  }

  public get Dz(): number {
    return this._dz;
  }

  public set Dz(value: number) {
    this._dz = value;
  }

  public get IsDead(): boolean {
    return this._isDead;
  }

  public set IsDead(value: boolean) {
    this._isDead = value;
  }

  public get RunSpeed(): number {
    return this._runSpeed;
  }

  public set RunSpeed(value: number) {
    this._runSpeed = value;
  }

  public get WalkSpeed(): number {
    return this._walkSpeed;
  }

  public set WalkSpeed(value: number) {
    this._walkSpeed = value;
  }

  public get SpeedMultiplier(): number {
    return this._speedMultiplier;
  }

  public set SpeedMultiplier(value: number) {
    this._speedMultiplier = value;
  }

  public get AtkSpdMultiplier(): number {
    return this._atkSpdMultiplier;
  }

  public set AtkSpdMultiplier(value: number) {
    this._atkSpdMultiplier = value;
  }

  // Server-reported collision cylinder radius/height for this creature's
  // current template/transform -- sent fresh in CharInfo/UserInfo/NpcInfo
  // (see those packets' readImpl()), not derived client-side. NpcInfo
  // actually writes this pair twice per packet (a real protocol quirk, not
  // a vendored-parser bug -- confirmed against lineage2ts's NpcInfoWithCharacters
  // writer); both occurrences carry the same value, so only the first is kept.
  public get CollisionRadius(): number {
    return this._collisionRadius;
  }

  public set CollisionRadius(value: number) {
    this._collisionRadius = value;
  }

  public get CollisionHeight(): number {
    return this._collisionHeight;
  }

  public set CollisionHeight(value: number) {
    this._collisionHeight = value;
  }

  public get PAtk(): number {
    return this._pAtk;
  }

  public set PAtk(value: number) {
    this._pAtk = value;
  }

  public get PAtkSpd(): number {
    return this._pAtkSpd;
  }

  public set PAtkSpd(value: number) {
    this._pAtkSpd = value;
  }
  public get MAtk(): number {
    return this._mAtk;
  }

  public set MAtk(value: number) {
    this._mAtk = value;
  }

  public get MAtkSpd(): number {
    return this._mAtkSpd;
  }

  public set MAtkSpd(value: number) {
    this._mAtkSpd = value;
  }
  public get RecommHave(): number {
    return this._recommHave;
  }

  public set RecommHave(value: number) {
    this._recommHave = value;
  }

  public get Karma(): number {
    return this._karma;
  }

  public set Karma(value: number) {
    this._karma = value;
  }

  public get HairStyle(): HairStyle {
    return this._hairStyle;
  }

  public set HairStyle(value: HairStyle) {
    this._hairStyle = value;
  }

  public get HairColor(): HairColor {
    return this._hairColor;
  }

  public set HairColor(value: HairColor) {
    this._hairColor = value;
  }

  public get Face(): Face {
    return this._face;
  }

  public set Face(value: Face) {
    this._face = value;
  }

  public get IsInCombat(): boolean {
    return this._isInCombat;
  }

  public set IsInCombat(value: boolean) {
    this._isInCombat = value;
  }

  public get IsNoble(): boolean {
    return this._isNoble;
  }

  public set IsNoble(value: boolean) {
    this._isNoble = value;
  }

  public get IsHero(): boolean {
    return this._isHero;
  }

  public set IsHero(value: boolean) {
    this._isHero = value;
  }

  public get IsMoving(): boolean {
    return this._isMoving;
  }

  public get STR(): number {
    return this._STR;
  }

  public set STR(value: number) {
    this._STR = value;
  }

  public get DEX(): number {
    return this._DEX;
  }

  public set DEX(value: number) {
    this._DEX = value;
  }

  public get CON(): number {
    return this._CON;
  }

  public set CON(value: number) {
    this._CON = value;
  }

  public get INT(): number {
    return this._INT;
  }

  public set INT(value: number) {
    this._INT = value;
  }

  public get WIT(): number {
    return this._WIT;
  }

  public set WIT(value: number) {
    this._WIT = value;
  }
  public get MEN(): number {
    return this._MEN;
  }

  public set MEN(value: number) {
    this._MEN = value;
  }

  public set IsMoving(isMoving: boolean) {
    const wasMoving = this._isMoving;
    this._isMoving = isMoving;
    if (!isMoving) {
      this._movingDistance = 0;
    }
    if (isMoving !== wasMoving) {
      this.fire(`${isMoving ? "Start" : "Stop"}Moving`, { creature: this });
    }
  }

  /**
   * @returns Distance length that was requested to move
   */
  public get MovingDistance(): number {
    return this._movingDistance;
  }

  public set MovingDistance(value: number) {
    this._movingDistance = value;
  }

  public get MoveFromX(): number | undefined {
    return this._moveFromX;
  }

  public get MoveFromY(): number | undefined {
    return this._moveFromY;
  }

  public get MoveFromZ(): number | undefined {
    return this._moveFromZ;
  }

  /** Date.now() when the current move segment started -- see this class's field comment. */
  public get MoveStartedAt(): number | undefined {
    return this._moveStartedAt;
  }

  public get CurrentSpeed(): number {
    return this.IsRunning
      ? this.RunSpeed * (this.SpeedMultiplier > 0 ? this.SpeedMultiplier : 1)
      : this.WalkSpeed * (this.SpeedMultiplier > 0 ? this.SpeedMultiplier : 1);
  }

  private _moveInterval!: ReturnType<typeof setInterval> | null;

  public setMovingTo(x: number, y: number, z: number, dx: number, dy: number, dz: number, heading?: number): void {
    if (this._moveInterval) {
      clearInterval(this._moveInterval);

      // Deliberately NOT firing a "StopMoving" here for a redirect (a fresh
      // setMovingTo while already moving, e.g. GameStore.advancePendingAction
      // re-chasing a mob that's wandered further before the previous hop
      // finished) -- IsMoving is about to go back to true a few lines down
      // regardless, so a listener would see a same-tick Stop+Start pair for
      // a move that never actually stopped. That used to matter: fire()
      // (EventEmitter.ts) calls handlers synchronously, and
      // advancePendingAction's `me.once("StopMoving", ...)` re-registers
      // itself on every hop -- so a redirect's synchronous Stop could
      // re-enter advancePendingAction -> moveTo -> setMovingTo *while this
      // very call is still running*, before it's written its own new
      // moveFrom/moveStartedAt/interval below. The outer call then finishes
      // and overwrites all of that with its own now-stale values, leaving
      // the interpolation (utils/creature-movement.ts) reading a
      // moveFrom/moveStartedAt pair that doesn't match where the character
      // actually was -- the visible symptom was a teleport/snap whenever a
      // chase (attack()/talkToNpc()) redirected mid-hop, e.g. from clicking
      // an already-targeted mob again before it finished walking into range.
    }

    this.Dx = dx;
    this.Dy = dy;
    this.Dz = dz;

    this.X = x;
    this.Y = y;
    this.Z = z;

    this._moveFromX = x;
    this._moveFromY = y;
    this._moveFromZ = z;
    this._moveStartedAt = Date.now();

    const movingVector: Vector = new Vector(dx - this.X, dy - this.Y);
    this._movingDistance = movingVector.length();

    let ticks = Math.ceil(this._movingDistance / (this.CurrentSpeed / 10));

    if (heading) {
      this.Heading = heading;
    } else if (this._movingDistance > 0) {
      // Only derivable when there is a direction to derive it from; a
      // zero-length hop would otherwise overwrite a perfectly good heading
      // with whichever way headingBetween() points for two identical points.
      this.Heading = headingBetween(x, y, dx, dy);
    }

    // Being told to move to where we already stand is not a move. The server
    // sends exactly that when a pick-up (or any pawn-targeted action) is
    // attempted from on top of the object: MoveToPawn arrives with the
    // destination we are already at. Starting a move for it left the
    // creature "moving" with a zero-length step, which the UI drew as a walk
    // cycle on the spot -- and a repeat of the same order kept restarting it,
    // so the walk never ended even after the item was in the bag.
    //
    // Also covers a speed of zero, where ticks would be Infinity or NaN and
    // the interval below would never reach its `ticks <= 0` exit at all.
    if (!Number.isFinite(ticks) || ticks <= 0) {
      this.X = dx;
      this.Y = dy;
      this.Z = dz;
      this._movingDistance = 0;
      this.IsMoving = false;
      return;
    }

    this.IsMoving = true;

    movingVector.normalize();

    // Z was never stepped here at all (X/Y were, every 100ms, but Z stayed
    // frozen at this move's origin height for its entire duration) --
    // harmless for a single short hop, but on sloped terrain or several
    // moves in a row it drifts our tracked Z away from the server's own,
    // and the reference server (see lineage2ts's MoveToLocation.ts) rejects
    // *any* further move whose reported origin Z is more than 1000 units
    // off from what it thinks our Z actually is (responds ActionFailed +
    // a corrective ValidateLocation) -- so once that drift crossed the
    // threshold, movement silently stopped working entirely. Interpolating
    // Z the same way X/Y already are (and snapping it to Dz on arrival,
    // same as X/Y snap to Dx/Dy) keeps it from drifting in the first place.
    const zStep = (dz - z) / ticks;

    // TODO: Improve this as it will drift for larger movements
    this._moveInterval = setInterval(() => {
      // Check if movement was not cancelled by the server
      if (!this.IsMoving) {
        if (this._moveInterval) clearInterval(this._moveInterval);
        this._moveInterval = null;
        return;
      }

      const dx = Math.floor(movingVector.X * (this.CurrentSpeed / 10));
      const dy = Math.floor(movingVector.Y * (this.CurrentSpeed / 10));

      this._movingDistance -= Math.sqrt(dx * dx + dy * dy);
      this.X += dx;
      this.Y += dy;
      this.Z += zStep;

      ticks--;
      if (ticks <= 0) {
        this.X = this.Dx;
        this.Y = this.Dy;
        this.Z = this.Dz;
        this._movingDistance = 0;

        this.IsMoving = false;

        if (this._moveInterval) clearInterval(this._moveInterval);
        this._moveInterval = null;
      }
    }, 100);
  }

  private th!: ReturnType<typeof setTimeout> | null;

  public set HiTime(value: number) {
    this.IsReady = false;
    if (this.th) {
      clearTimeout(this.th);
      this.th = null;
    }

    this.th = setTimeout(() => {
      this.IsReady = true;
    }, value);
  }
}
