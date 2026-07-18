import { BaseButton } from "../../core/buttons/base.button";
import { useStore } from "../../../stores/StoreContext";
import { clearSession } from "../../../lib/session";

export function GameScreen() {
  const store = useStore();

  function handleLogout() {
    clearSession();
    store.setScreen("login");
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
