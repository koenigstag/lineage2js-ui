import { Screen } from "../../core/screen.component";
import { WindowsRoot } from "../../windows/core/windows-root";
import { GAME_WINDOW_IDS } from "../../../config/windows.registry";
import { GameScene } from "./scene/game-scene.component";
import { DeathModal } from "../../core/death-modal";
import { DisconnectModal } from "../../core/disconnect-modal";

export function GameScreen() {
  return (
    <Screen className="screen screen--game">
      <GameScene />
      <WindowsRoot ids={GAME_WINDOW_IDS} />
      <DeathModal />
      <DisconnectModal />
    </Screen>
  );
}
