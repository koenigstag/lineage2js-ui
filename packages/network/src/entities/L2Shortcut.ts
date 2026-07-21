import L2Object from "./L2Object";
import { ShortcutType } from "../enums/ShortcutType";

export default class L2Shortcut extends L2Object {
  private _shortcutType!: ShortcutType;
  private _targetId!: number;
  private _level!: number;
  private _characterType!: number;
  private _itemReuseGroup!: number;
  private _itemReuseRemaining!: number;
  private _itemReuseTotal!: number;

  /** This collection's unique key (page*12 + column) -- aliases the base Id field, same as skill/item ids elsewhere. */
  public get Slot(): number {
    return this.Id;
  }

  public set Slot(value: number) {
    this.Id = value;
  }

  public get Type(): ShortcutType {
    return this._shortcutType;
  }

  public set Type(value: ShortcutType) {
    this._shortcutType = value;
  }

  /** The item/skill/action/macro/recipe/bookmark id this shortcut points to. */
  public get TargetId(): number {
    return this._targetId;
  }

  public set TargetId(value: number) {
    this._targetId = value;
  }

  /** SKILL shortcuts only. */
  public get Level(): number {
    return this._level;
  }

  public set Level(value: number) {
    this._level = value;
  }

  public get CharacterType(): number {
    return this._characterType;
  }

  public set CharacterType(value: number) {
    this._characterType = value;
  }

  /** ITEM shortcuts only: shared reuse group id. */
  public get ItemReuseGroup(): number {
    return this._itemReuseGroup;
  }

  public set ItemReuseGroup(value: number) {
    this._itemReuseGroup = value;
  }

  /** ITEM shortcuts only, seconds. 0 when not on cooldown. */
  public get ItemReuseRemaining(): number {
    return this._itemReuseRemaining;
  }

  public set ItemReuseRemaining(value: number) {
    this._itemReuseRemaining = value;
  }

  /** ITEM shortcuts only, seconds. */
  public get ItemReuseTotal(): number {
    return this._itemReuseTotal;
  }

  public set ItemReuseTotal(value: number) {
    this._itemReuseTotal = value;
  }
}
