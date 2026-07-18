import { Screen } from "../../core/screen.component";
import { WindowsRoot } from "../../windows/core/windows-root";
import { GAME_WINDOW_IDS } from "../../../config/windows.registry";

export function GameScreen() {
  return (
    <Screen className="screen screen--game">
      <WindowsRoot ids={GAME_WINDOW_IDS} />
    </Screen>
  );
}
