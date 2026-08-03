import ICommand from "./ICommand";
import Logger from "../mmocore/Logger";
import LoginClient from "../network/LoginClient";
import GameClient from "../network/GameClient";

export default abstract class AbstractGameCommand implements ICommand {
  protected logger: Logger = Logger.getLogger(this.constructor.name);

  // Whether this command assumes an already-connected GameClient. True for
  // almost everything -- ClientCommands' dispatch proxy skips execute()
  // instead of calling into sendPacket() while disconnected (which would
  // otherwise throw from deep inside, GameClient.Connection being undefined)
  // unless a command overrides this to false. Only login() and
  // selectServer() do: login() only ever touches LoginClient, and
  // selectServer() is what establishes the GameClient connection itself.
  static requiresGameConnection = true;

  constructor(public LoginClient: LoginClient, public GameClient: GameClient) {}

  // @Override
  abstract execute(...args: any[]): void;
}
