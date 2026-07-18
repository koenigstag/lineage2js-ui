import { GameMenu } from "../../menus/game/game.menu";

export function GameScreen() {
  return (
    <div
      className="screen screen--game"
      style={{ position: "relative", width: "100vw", height: "100vh", backgroundColor: "#000000" }}
    >
      <div style={{ position: "absolute", bottom: 10, right: 10 }}>
        <GameMenu />
      </div>
    </div>
  );
}
