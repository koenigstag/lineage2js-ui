import { BaseButton } from "../../core/buttons/base.button";
import { useSessionStore, useUiStore } from "../../../stores/StoreContext";

export function GameScreen() {
  const session = useSessionStore();
  const ui = useUiStore();

  function handleLogout() {
    session.logout();
    ui.setScreen("login");
  }

  return (
    <div
      className="screen screen--game"
      style={{ position: "relative", width: "100vw", height: "100vh", backgroundColor: "#000000" }}
    >
      <div style={{ position: "absolute", bottom: 10, right: 10 }}>
        <BaseButton onClick={handleLogout}>Logout</BaseButton>
      </div>
    </div>
  );
}
