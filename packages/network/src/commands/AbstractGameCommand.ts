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
  //
  // Because of this, calling code should NOT re-check
  // `client.GameClient.IsConnected` before calling a `client.xxx()` command
  // -- it's already handled here, for every command, unconditionally. The
  // only thing worth an explicit IsConnected check at the call site is
  // deciding between two genuinely different behaviors (e.g. an
  // offline/demo-mode fallback that simulates the result locally) -- not as
  // a guard just to avoid calling into a command that's already safe to
  // call while disconnected.
  static requiresGameConnection = true;

  constructor(public LoginClient: LoginClient, public GameClient: GameClient) {}

  // @Override
  abstract execute(...args: any[]): void;
}
