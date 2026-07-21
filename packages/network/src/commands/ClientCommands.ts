import L2Buff from "../entities/L2Buff";
import L2Character from "../entities/L2Character";
import L2Creature from "../entities/L2Creature";
import L2Item from "../entities/L2Item";
import L2Object from "../entities/L2Object";
import L2Server from "../entities/L2Server";
import L2User from "../entities/L2User";
import { Actions } from "../enums/Actions";
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
   * Create a character in the given slot (the existing character count from
   * selectServer()'s result) and enter the world with it. Assumes
   * requestCharacterTemplates() already ran for this game session.
   * @param charData
   * @param newCharSlot
   */
  createCharacter(charData: L2Character, newCharSlot: number): Promise<EnterWorldResult>;

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
   * Accepts the requested party invite
   */
  acceptJoinParty(): void;
  /**
   * Declines the requested party invite
   */
  declineJoinParty(): void;
  /**
   * Select next/closest attackable target
   */
  nextTarget(): L2Creature | undefined;
  /**
   * Request for inventory item list
   */
  inventory(): void;
  /**
   * Use an item. Accepts L2Item object or ObjectId
   * @param item
   */
  useItem(item: L2Item | number): void;
  /**
   * Request player a duel. If no char is provided, the command tries to request the selected target
   * @param char
   */
  requestDuel(char?: L2Character | string): void;
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
          const cmd = Object.create((commands as any)[propertyKey] as AbstractGameCommand, {
            LoginClient: { value: (target as any).LoginClient },
            GameClient: { value: (target as any).GameClient },
          });
          target.logger.debug("Command", propertyKey);
          return (...args: any) => cmd.execute(...args);
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
