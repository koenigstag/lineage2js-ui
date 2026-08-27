import L2Buff from "../entities/L2Buff";
import L2Character from "../entities/L2Character";
import L2Creature from "../entities/L2Creature";
import L2Item from "../entities/L2Item";
import L2Object from "../entities/L2Object";
import L2Server from "../entities/L2Server";
import L2Shortcut from "../entities/L2Shortcut";
import L2User from "../entities/L2User";
import { Actions } from "../enums/Actions";
import { AcquireSkillType } from "../enums/AcquireSkillType";
import { RestartPoint } from "../enums/RestartPoint";
import { ShotsType } from "../enums/ShotsType";
import Logger from "../mmocore/Logger";
import MMOConfig from "../mmocore/MMOConfig";
import GameClient from "../network/GameClient";
import LoginClient from "../network/LoginClient";
import { EnterWorldResult } from "./AbstractEnterWorldCommand";
import AbstractGameCommand from "./AbstractGameCommand";
import { LoginResult } from "./CommandLogin";
import { CharacterTemplate } from "../network/incoming/game/RequestNewCharacterSuccess";
import ICommand from "./ICommand";
import commands from "./index";

export default interface ClientCommands {
  /**
   * Authenticate against the login server. Resolves with its server list --
   * does not touch the game server yet (see selectServer).
   * @param config
   */
  login(config: MMOConfig | Record<string, unknown>): Promise<LoginResult>;
  /**
   * Log into one of the servers from login()'s result and hand off to the
   * game server. Resolves with the account's existing characters there.
   * @param serverId
   */
  selectServer(serverId: number): Promise<L2User[]>;
  /**
   * Select one of selectServer()'s characters (by its index in that list)
   * and enter the world with it.
   * @param slotIndex
   */
  selectCharacter(slotIndex: number): Promise<EnterWorldResult>;
  /**
   * Requests the race/class base-stat templates for the character-creation
   * screen. Matches the real client: sent when opening that screen, not at
   * the point of submitting the form.
   */
  requestCharacterTemplates(): Promise<CharacterTemplate[]>;
  /**
   * Create a character. Does not enter the world -- like the real client, the
   * server stays in the char-select state and answers with an updated roster,
   * which this resolves with (find the new character in it to preselect it).
   * Assumes requestCharacterTemplates() already ran for this game session.
   * @param charData
   */
  createCharacter(charData: L2Character): Promise<L2User[]>;
  /**
   * Leave the world and go back to character selection without dropping the
   * game-server connection. Resolves with the account's characters, same
   * shape as selectServer(). Required before any char-select-state request
   * (e.g. requestCharacterTemplates) will be answered again.
   */
  restart(): Promise<L2User[]>;

  say(text: string): void;
  /**
   * Shout a message
   * @param text
   */
  shout(text: string): void;
  /**
   * Send a PM
   * @param text
   * @param target
   */
  tell(text: string, target: string): void;
  /**
   * Send message to party
   * @param text
   */
  sayToParty(text: string): void;
  /**
   * Send message to clan
   * @param text
   */
  sayToClan(text: string): void;
  /**
   * Send message to trade
   * @param text
   */
  sayToTrade(text: string): void;
  /**
   * Send message to ally
   * @param text
   */
  sayToAlly(text: string): void;
  /**
   * Send a Hero Voice message. Requires the character to actually hold
   * Hero status server-side -- the server silently drops it otherwise, same
   * as the real client.
   * @param text
   */
  sayToHero(text: string): void;
  /**
   * Move to location
   * @param x
   * @param y
   * @param z
   */
  moveTo(x: number, y: number, z: number): void;
  /**
   * Drop an item at location
   * @param ItemObjectId
   * @param ItemsCount
   * @param x
   * @param y
   * @param z
   */
  dropItem(objectId: number, count: number, x?: number, y?: number, z?: number): void;
  /**
   * Permanently destroy an item from inventory (RequestDestroyItem, opcode
   * 0x60) -- a genuinely separate action/packet from dropItem (0x17, leaves
   * it on the ground) and sellItem (0x37, needs an active NPC shop session).
   * @param objectId
   * @param count
   */
  destroyItem(objectId: number, count: number): void;
  /**
   * Hit on target. Accepts L2Object object or ObjectId
   * @param object
   * @param shift
   */
  hit(object: L2Object | number, shift?: boolean): void;
  /**
   * Attack a target
   * @param object
   * @param shift
   */
  attack(object: L2Object | number, shift?: boolean): void;
  /**
   * Send any Actions enum member as a RequestActionUse -- covers sit/stand,
   * social actions, pet/servitor commands, etc. without a Command class per
   * action (see actionPackets.ts).
   * @param action
   * @param ctrlPressed
   * @param shiftPressed
   */
  action(action: keyof typeof Actions, ctrlPressed?: boolean, shiftPressed?: boolean): void;
  /**
   * Cancel the active target
   */
  cancelTarget(): void;
  /**
   * Invites a character to a party -- defaults to the current target's name when omitted
   */
  requestJoinParty(char?: L2Character | string): void;
  /**
   * Leaves the current party
   */
  leaveParty(): void;
  /**
   * Accepts the requested party invite
   */
  acceptJoinParty(): void;
  /**
   * Declines the requested party invite
   */
  declineJoinParty(): void;
  /**
   * Dismisses a member from the party -- only the party leader can do this
   */
  dismissPartyMember(name: string): void;
  /**
   * Transfers party leadership to another member -- only the current party leader can do this
   */
  changePartyLeader(name: string): void;
  /**
   * Sends a trade request to a target character
   */
  requestTrade(targetObjectId: number): void;
  /**
   * Accepts the requested trade
   */
  acceptTradeRequest(): void;
  /**
   * Declines the requested trade
   */
  declineTradeRequest(): void;
  /**
   * Accepts the requested duel
   */
  acceptDuel(): void;
  /**
   * Declines the requested duel
   */
  declineDuel(): void;
  /**
   * Accepts the requested pair (couple) social action
   */
  acceptCoupleAction(): void;
  /**
   * Declines the requested pair (couple) social action
   */
  declineCoupleAction(): void;
  /**
   * Select next/closest attackable target
   */
  nextTarget(): L2Creature | undefined;
  /**
   * Recommend a player character (RequestVoteNew) -- spends one of this
   * character's daily recommendations to increase the target's RecommHave.
   * @param targetObjectId
   */
  recommend(targetObjectId: number): void;
  /**
   * Request for inventory item list
   */
  inventory(): void;
  /**
   * Use an item (RequestUseItem, opcode 0x19). Also how equipping works --
   * there's no separate equip packet (RequestEquipItem is a server-side
   * no-op on lineage2ts); the server toggles equip state based on the
   * item's current isEquipped(). Accepts L2Item object or ObjectId.
   * @param item
   */
  useItem(item: L2Item | number): void;
  /**
   * Unequip whatever's in the given paperdoll slot (RequestUnEquipItem,
   * opcode 0x16) -- a genuinely separate packet from useItem's equip
   * toggle. Takes a slot bitmask, not an item objectId (L2ItemSlots,
   * numerically identical to L2Item.SLOT_*) -- for the ear/finger slots,
   * that must be the resolved single-side bit (SLOT_R_EAR/SLOT_L_EAR/...),
   * not the item's own ambiguous SLOT_LR_EAR/SLOT_LR_FINGER BodyPart, since
   * the server tracks each physical earring/ring in its own specific slot.
   * @param slot
   */
  unequipItem(slot: number): void;
  /**
   * Request player a duel. If no char is provided, the command tries to request the selected target
   * @param char
   * @param partyDuel challenges the target's whole party instead of just them
   */
  requestDuel(char?: L2Character | string, partyDuel?: boolean): void;
  /**
   * Enable/disable auto-shots
   * @param item
   * @param enable
   */
  autoShots(item: L2Item | ShotsType | number, enable: boolean): void;
  /**
   * Cancel a buff
   * @param object
   * @param buff
   * @param level
   */
  cancelBuff(object: L2Character | number, buff: L2Buff | number, level?: number): void;
  /**
   * Sit or stand
   */
  sitOrStand(): void;
  /**
   * Sync position with server
   */
  validatePosition(): void;
  /**
   * Ask the server for a NetPing reply (RequestNetPing). In High Five this
   * exchange is client-opened -- the server answers with NetPing, it never
   * pings unprompted -- so nothing arrives unless this is sent. Useful mostly
   * for measuring the round trip; see incoming/game/NetPing.ts for what the
   * reply carries.
   */
  netPing(): void;
  /**
   * Cast a magic skill
   * @param magicId
   * @param ctrl
   * @param shift
   */
  cast(magicSkillId: number, ctrl?: boolean, shift?: boolean): void;
  /**
   * Open dwarven craft recipe book
   */
  dwarvenCraftRecipes(): void;
  /**
   * Craft an item
   * @param recipeId
   */
  craft(recipeId: number): void;
  /**
   * Revive to location
   * @param where
   */
  revive(where: RestartPoint): void;
  /**
   * Accept resurrect request
   */
  acceptResurrect(): void;
  /**
   * Decline resurrect request
   */
  declineResurrect(): void;
  /**
   * Send Party Request
   */
  partyInvite(charOrCharName?: L2Character | string): void;
  /**
   * Send bypass to server. (dialog)
   */
  dialog(text: string): void;
  /**
   * Send logout request
   */
  logout(): void;
  /**
   * Ask the trainer for a skill/level's authoritative SpCost and item
   * requirements. Requires the player to have an active NPC trainer
   * interaction server-side (getLastFolkNPC()).
   * @param id
   * @param level
   * @param type
   */
  requestAcquireSkillInfo(id: number, level: number, type: AcquireSkillType): void;
  /**
   * Commit to learning a skill/level. Same trainer-interaction requirement
   * as requestAcquireSkillInfo.
   * @param id
   * @param level
   * @param type
   * @param subType only used for AcquireSkillType.SUBPLEDGE
   */
  requestAcquireSkill(id: number, level: number, type: AcquireSkillType, subType?: number): void;
  /**
   * Registers/updates a hotbar shortcut server-side (RequestShortCutReg).
   * The server always echoes back a ShortCutRegister packet to confirm --
   * that's what actually updates the client's shortcut list (see
   * GameStore.bindToClient's syncHotbar), not this call itself.
   * @param shortcut
   */
  registerShortcut(shortcut: L2Shortcut): void;
  /**
   * Removes a hotbar shortcut server-side (RequestShortCutDel). Unlike
   * registerShortcut, the server sends no confirmation packet back, so the
   * caller must clear the slot client-side itself.
   * @param slot combined slot index (page*12 + column), matches L2Shortcut.Slot
   */
  deleteShortcut(slot: number): void;
}

export default abstract class ClientCommands {
  protected logger: Logger = Logger.getLogger(this.constructor.name);

  LoginClient = new LoginClient();

  GameClient = new GameClient();

  protected commands: Record<string, ICommand> = commands;
  constructor() {
    return new Proxy<ClientCommands>(this, {
      get(target: ClientCommands, propertyKey: string, receiver: any) {
        if (propertyKey in target) {
          // return (target as any)[objectKey];
          return Reflect.get(target, propertyKey, receiver);
        }
        if (propertyKey in commands) {
          const prototype = (commands as any)[propertyKey] as AbstractGameCommand;
          const cmd = Object.create(prototype, {
            LoginClient: { value: (target as any).LoginClient },
            GameClient: { value: (target as any).GameClient },
          });
          target.logger.debug("Command", propertyKey);
          return (...args: any) => {
            // requiresGameConnection lives on the command class (a static,
            // see AbstractGameCommand), not the instance -- prototype.constructor
            // resolves to that class without needing to construct cmd first.
            const commandClass = prototype.constructor as typeof AbstractGameCommand;
            if (commandClass.requiresGameConnection && !target.GameClient.IsConnected) {
              target.logger.debug("Skipped (not connected)", propertyKey);
              return undefined;
            }
            return cmd.execute(...args);
          };
        }
      },
    });
  }

  registerCommand(commandName: string, commandHandler: ICommand): this {
    if (commandName in this.commands) {
      throw new Error(`Command ${commandName} is already registered.`);
    }
    this.commands[commandName] = commandHandler;
    return this;
  }
}
