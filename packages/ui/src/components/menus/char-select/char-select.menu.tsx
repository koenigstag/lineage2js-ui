import { observer } from "mobx-react-lite";
import { BaseButton } from "../../core/buttons/base.button";
import { useConfirmation } from "../../core/confirmation-modal";
import { useAlert } from "../../core/alert-modal";
import { useGameStore, useSessionStore, useUiStore } from "../../../stores/StoreContext";
import { MAX_CHARACTERS } from "../../../stores/GameStore";
import { MENU_Z_INDEX } from "../../../config/z-index";
import { t } from "../../../lang/lang";

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
      await alert(session.error ?? t("charSelect.templatesFailed"));
    }
  }

  // The roster keeps a character that's pending deletion, counting down (see
  // L2User.DeleteSecondsLeft), rather than dropping it -- so the same slot is
  // either deletable or restorable, never both. The real client swaps the
  // button the same way.
  const slotIndex = session.characters.findIndex((character) => character.ObjectId === game.selectedCharacterId);
  const selected = slotIndex < 0 ? undefined : session.characters[slotIndex];
  const isPendingDeletion = (selected?.DeleteSecondsLeft ?? 0) > 0;

  async function handleDeleteCharacter() {
    if (!selected) {
      return;
    }
    if (!(await confirm(t("charSelect.deleteConfirm", { name: selected.Name })))) {
      return;
    }
    if (!(await session.deleteCharacter(slotIndex))) {
      await alert(session.error ?? t("charSelect.deleteFailed"));
    }
  }

  async function handleRestoreCharacter() {
    if (!selected) {
      return;
    }
    if (!(await confirm(t("charSelect.restoreConfirm", { name: selected.Name })))) {
      return;
    }
    if (!(await session.restoreCharacter(slotIndex))) {
      await alert(session.error ?? t("charSelect.restoreFailed"));
    }
  }

  async function handleLogout() {
    if (await confirm(t("charSelect.logoutConfirm"))) {
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
        {session.isConnecting ? t("charSelect.loading") : t("charSelect.createButton")}
      </BaseButton>
      {isPendingDeletion ? (
        <BaseButton onClick={handleRestoreCharacter} disabled={session.isConnecting}>
          {t("charSelect.restoreButton")}
        </BaseButton>
      ) : (
        <BaseButton onClick={handleDeleteCharacter} disabled={!selected || session.isConnecting}>
          {t("charSelect.deleteButton")}
        </BaseButton>
      )}
      <BaseButton onClick={handleLogout}>{t("charSelect.reLoginButton")}</BaseButton>
      {modal}
      {alertModal}
    </div>
  );
});
