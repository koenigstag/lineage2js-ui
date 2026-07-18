import { GameMenu } from "../../menus/game/game.menu";

export function GameScreen() {
  return (
    <div
      className="screen screen--game"
      style={{ position: "relative", width: "100vw", height: "100vh", backgroundColor: "#000000" }}
    >
      <div style={{ position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)" }}>
        <GameMenu />
      </div>
    </div>
  );
}
