import { GameMenu } from "../../menus/game/game.menu";
import { WindowsRoot } from "../../windows/core/windows-root";
import { GAME_WINDOW_IDS } from "../../../config/windows.registry";

export function GameScreen() {
  return (
    <div
      className="screen screen--game"
      style={{ position: "relative", width: "100vw", height: "100vh", backgroundColor: "#000000" }}
    >
      <WindowsRoot ids={GAME_WINDOW_IDS} />

      <div style={{ position: "absolute", bottom: 10, right: 10 }}>
        <GameMenu />
      </div>
    </div>
  );
}
