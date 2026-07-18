import { observer } from "mobx-react-lite";
import { BaseButton } from "../../core/buttons/base.button";
import { useConfirmation } from "../../core/confirmation-modal";
import { useGameStore, useSessionStore, useUiStore } from "../../../stores/StoreContext";
import { MAX_CHARACTERS } from "../../../stores/GameStore";
import { MENU_Z_INDEX } from "../../../config/z-index";

export const CharSelectMenu = observer(function CharSelectMenu() {
  const game = useGameStore();
  const session = useSessionStore();
  const ui = useUiStore();
  const { confirm, modal } = useConfirmation();

  function handleCreateCharacter() {
    ui.setScreen("create-char");
  }

  async function handleDeleteCharacter() {
    if (game.selectedCharacterId && (await confirm("Delete this character? This cannot be undone."))) {
      game.deleteCharacter(game.selectedCharacterId);
    }
  }

  async function handleLogout() {
    if (await confirm("Logout to the login screen?")) {
      session.logout();
      ui.setScreen("login");
    }
  }

  return (
    <div
      style={{
        position: "absolute",
        bottom: 10,
        right: 10,
        zIndex: MENU_Z_INDEX,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        width: 240,
        backgroundColor: "#1a1a1a",
        border: "1px solid #444444",
        borderRadius: 4,
        padding: 16,
      }}
    >
      <BaseButton onClick={handleCreateCharacter} disabled={game.characters.size >= MAX_CHARACTERS}>
        Create
      </BaseButton>
      <BaseButton onClick={handleDeleteCharacter} disabled={!game.selectedCharacterId}>
        Delete
      </BaseButton>
      <BaseButton onClick={handleLogout}>Re-Login</BaseButton>
      {modal}
    </div>
  );
});
