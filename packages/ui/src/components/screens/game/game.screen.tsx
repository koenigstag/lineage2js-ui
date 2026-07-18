import { Screen } from "../../core/screen.component";
import { GameMenu } from "../../menus/game/game.menu";
import { WindowsRoot } from "../../windows/core/windows-root";
import { GAME_WINDOW_IDS } from "../../../config/windows.registry";

export function GameScreen() {
  return (
    <Screen className="screen screen--game">
      <WindowsRoot ids={GAME_WINDOW_IDS} />

      <div style={{ position: "absolute", bottom: 10, right: 10 }}>
        <GameMenu />
      </div>
    </Screen>
  );
}
