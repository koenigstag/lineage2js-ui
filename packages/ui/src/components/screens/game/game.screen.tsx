import { Screen } from "../../core/screen.component";
import { WindowsRoot } from "../../windows/core/windows-root";
import { GAME_WINDOW_IDS } from "../../../config/windows.registry";
import { GeoTerrainDebugScene } from "./scene/geo-terrain-debug-scene.component";

export function GameScreen() {
  return (
    <Screen className="screen screen--game">
      <GeoTerrainDebugScene />
      <WindowsRoot ids={GAME_WINDOW_IDS} />
    </Screen>
  );
}
