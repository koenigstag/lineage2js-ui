import { observer } from "mobx-react-lite";
import { BaseButton } from "../../core/buttons/base.button";
import { useGameStore, useSessionStore, useUiStore } from "../../../stores/StoreContext";
import { MAX_CHARACTERS } from "../../../stores/GameStore";

export const CharSelectMenu = observer(function CharSelectMenu() {
  const game = useGameStore();
  const session = useSessionStore();
  const ui = useUiStore();

  function handleCreateCharacter() {
    ui.setScreen("create-char");
  }

  function handleDeleteCharacter() {
    if (game.selectedCharacterId) {
      game.deleteCharacter(game.selectedCharacterId);
    }
  }

  function handleLogout() {
    session.logout();
    ui.setScreen("login");
  }

  return (
    <div
      style={{
        position: "absolute",
        bottom: 10,
        right: 10,
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
        Create character
      </BaseButton>
      <BaseButton onClick={handleDeleteCharacter} disabled={!game.selectedCharacterId}>
        Delete character
      </BaseButton>
      <BaseButton onClick={handleLogout}>Logout</BaseButton>
    </div>
  );
});
