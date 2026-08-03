import L2Buff from "../entities/L2Buff";
import L2Creature from "../entities/L2Creature";
import L2DroppedItem from "../entities/L2DroppedItem";
import L2Item from "../entities/L2Item";
import L2ObjectCollection from "../entities/L2ObjectCollection";
import L2ClientObjectCollection from "../entities/L2ClientObjectCollection";
import L2PartyMember from "../entities/L2PartyMember";
import L2Shortcut from "../entities/L2Shortcut";
import L2Skill from "../entities/L2Skill";
import L2User from "../entities/L2User";
import MMOClient from "../mmocore/MMOClient";
import MMOConfig from "../mmocore/MMOConfig";
import MMOConnection from "../mmocore/MMOConnection";
import GameCrypt from "./GameCrypt";
import GamePacketHandler from "./GamePacketHandler";
import GameServerPacket from "./outgoing/game/GameServerPacket";
import L2Recipe from "../entities/L2Recipe";
import PledgeInfo from "./incoming/game/PledgeInfo";
import AcquireSkillList from "./incoming/game/AcquireSkillList";
import AcquireSkillInfo from "./incoming/game/AcquireSkillInfo";
import IConnection from "../mmocore/IConnection";
import mutators from "./mutators/game/index";
import SocketFactory from "../socket/SocketFactory";

export default class GameClient extends MMOClient {
  private _gameCrypt: GameCrypt = new GameCrypt();
  Config!: MMOConfig;
  ActiveChar: L2User = new L2User();
  CreaturesList: L2ObjectCollection<L2Creature> = new L2ClientObjectCollection(this);
  PartyList: L2ClientObjectCollection<L2PartyMember> = new L2ClientObjectCollection(this);
  DroppedItems: L2ClientObjectCollection<L2DroppedItem> = new L2ClientObjectCollection(this);
  InventoryItems: L2ClientObjectCollection<L2Item> = new L2ClientObjectCollection(this);
  SkillsList: L2ClientObjectCollection<L2Skill> = new L2ClientObjectCollection(this);
  /** Keyed by Shortcut.Slot (page*12 + column), see L2Shortcut. */
  Shortcuts: L2ClientObjectCollection<L2Shortcut> = new L2ClientObjectCollection(this);
  DwarfRecipeBook: L2ClientObjectCollection<L2Recipe> = new L2ClientObjectCollection(this);
  CommonRecipeBook: L2ClientObjectCollection<L2Recipe> = new L2ClientObjectCollection(this);
  /** clanId -> last PledgeInfo received for it. No outgoing request is wired to populate this on demand yet. */
  PledgeInfoByClanId: Map<number, PledgeInfo> = new Map();
  /** Last AcquireSkillList received (the trainer's Learn-tab offering for one AcquireSkillType). */
  AcquireSkillList: AcquireSkillList | undefined = undefined;
  /** `${id}_${level}` -> last AcquireSkillInfo received for it (authoritative SpCost/Requirements). */
  AcquireSkillInfoByKey: Map<string, AcquireSkillInfo> = new Map();
  /** Healing-potion reuse-cooldown icon, see ShortBuffStatusUpdate.ts -- a single value, not a collection, unlike BuffsList. */
  ShortBuff: L2Buff | undefined = undefined;
  /** Action ids currently usable (ExBasicActionList) -- the full default set at world-enter, a restricted set while transformed. undefined until the first one arrives (offline/not connected yet), which callers should treat as "no restriction known" rather than "nothing allowed". */
  BasicActionIds: Set<number> | undefined = undefined;

  LastConfirmMessageId!: number;
  LastConfirmMessageRequesterId!: number;
  /** Whether the pending duel request (ExDuelAskStart) was a party duel -- RequestDuelAnswerStart echoes it back, the server doesn't track it per-requester like ConfirmDlg's messageId/requesterId. */
  LastDuelPartyDuel!: boolean;

  get BuffsList(): L2ObjectCollection<L2Buff> {
    return this.ActiveChar.Buffs;
  }

  constructor() {
    super();
    this.PacketHandler = new GamePacketHandler();

    mutators.forEach((m) => {
      const mutator = Object.create(m[0], {
        Client: { value: this },
        PacketType: { value: (m[1] as any).name },
      });
      this.registerMutator(mutator);
    });
  }

  init(config: MMOConfig, connection?: IConnection): this {
    this.Connection = connection ?? new MMOConnection(SocketFactory.getSocketAdapter(config), this);

    // Same reasoning as LoginClient.init(): GameCrypt leaves its first packet
    // (KeyPacket) in the clear and only starts XOR-ing afterwards, so a crypt
    // carried over from a previous connection would garble the new KeyPacket
    // and strand the handshake.
    this._gameCrypt = new GameCrypt();
    this.resetStream();

    this.Config = config;

    return this;
  }

  /**
   * Drops everything scoped to one trip into the world (active character,
   * visible objects, inventory, skills, ...) while keeping the connection and
   * its crypt alive. Used when going back to character selection via
   * CommandRestart, where the socket stays up but the character does not.
   */
  resetWorldState(): void {
    this.ActiveChar = new L2User();
    this.CreaturesList.clear();
    this.PartyList.clear();
    this.DroppedItems.clear();
    this.InventoryItems.clear();
    this.SkillsList.clear();
    this.Shortcuts.clear();
    this.DwarfRecipeBook.clear();
    this.CommonRecipeBook.clear();
    this.PledgeInfoByClanId.clear();
    this.AcquireSkillList = undefined;
    this.AcquireSkillInfoByKey.clear();
    this.ShortBuff = undefined;
  }

  encrypt(buf: Uint8Array, offset: number, size: number): void {
    this._gameCrypt.encrypt(buf, offset, size);
  }
  decrypt(buf: Uint8Array, offset: number, size: number): void {
    this._gameCrypt.decrypt(buf, offset, size);
  }
  setCryptInitialKey(key: Uint8Array): void {
    this._gameCrypt.setKey(key);
  }

  pack(gsp: GameServerPacket): Uint8Array {
    gsp.write();

    this._gameCrypt.encrypt(gsp.Buffer, 0, gsp.Position);

    const sendable: Uint8Array = new Uint8Array(gsp.Position + 2);
    sendable[0] = (gsp.Position + 2) & 0xff;
    sendable[1] = (gsp.Position + 2) >>> 8;
    sendable.set(gsp.Buffer.slice(0, gsp.Position), 2);

    return sendable;
  }

  sendPacket(gsp: GameServerPacket): Promise<void> {
    let sendable: Uint8Array;
    try {
      // Same reasoning as LoginClient.sendPacket: keep serialization failures
      // inside the returned promise so callers can actually catch them.
      sendable = this.pack(gsp);
    } catch (error) {
      return Promise.reject(error);
    }

    this.logger.debug("Sending ", gsp.constructor.name);
    return this.sendRaw(sendable).then(() => {
      this.fire(`PacketSent:${gsp.constructor.name}`, { packet: gsp });
    });
  }
}
