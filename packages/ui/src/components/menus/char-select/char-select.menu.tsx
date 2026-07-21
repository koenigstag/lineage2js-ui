import { observer } from "mobx-react-lite";
import { BaseButton } from "../../core/buttons/base.button";
import { useConfirmation } from "../../core/confirmation-modal";
import { useAlert } from "../../core/alert-modal";
import { useGameStore, useSessionStore, useUiStore } from "../../../stores/StoreContext";
import { MAX_CHARACTERS } from "../../../stores/GameStore";
import { MENU_Z_INDEX } from "../../../config/z-index";

export const CharSelectMenu = observer(function CharSelectMenu() {
  const game = useGameStore();
  const session = useSessionStore();
  const ui = useUiStore();
  const { confirm, modal } = useConfirmation();
  const { alert, modal: alertModal } = useAlert();

  // Matches the real client: templates are requested when opening the
  // char-create screen, not at the point of submitting the form.
  async function handleCreateCharacter() {
    if (await session.requestCharacterTemplates()) {
      ui.setScreen("create-char");
    } else {
      await alert(session.error ?? "Could not load character templates.");
    }
  }

  async function handleLogout() {
    if (await confirm("Logout to the login screen?")) {
      game.selectCharacter(undefined);
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
      <BaseButton
        onClick={handleCreateCharacter}
        disabled={session.characters.length >= MAX_CHARACTERS || session.isConnecting}
      >
        {session.isConnecting ? "Loading..." : "Create"}
      </BaseButton>
      <BaseButton onClick={handleLogout}>Re-Login</BaseButton>
      {modal}
      {alertModal}
    </div>
  );
});
