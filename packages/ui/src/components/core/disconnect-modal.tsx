import { observer } from "mobx-react-lite";
import { BaseButton } from "./buttons/base.button";
import { DISCONNECT_Z_INDEX } from "../../config/z-index";
import { t } from "../../lang/lang";
import { useGameStore, useSessionStore, useUiStore } from "../../stores/StoreContext";

// Shown once the game connection drops (see GameStore.isDisconnected, set
// from the ServerClose/Disconnected event handlers in bindToClient). Same
// no-dismissal title + vertical option list layout as death-modal.tsx --
// the only way out is the button. Reconnecting the same socket isn't
// meaningful for this protocol, so the only option tears the session down
// and returns to the login screen, same as SessionStore.logout() elsewhere.
export const DisconnectModal = observer(function DisconnectModal() {
  const game = useGameStore();
  const session = useSessionStore();
  const ui = useUiStore();

  if (!game.isDisconnected) {
    return null;
  }

  function handleReturnToLogin() {
    session.logout();
    ui.setScreen("login");
  }

  const options = [
    { label: t("disconnect.returnToLoginButton"), onClick: handleReturnToLogin },
  ];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: DISCONNECT_Z_INDEX,
        backgroundColor: "rgba(0, 0, 0, 0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          gap: 12,
          minWidth: 240,
          backgroundColor: "#1a1a1a",
          border: "1px solid #444444",
          borderRadius: 4,
          padding: 20,
        }}
      >
        <span style={{ color: "#cccccc", textAlign: "center", fontSize: 15 }}>
          {t("disconnect.message")}
        </span>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {options.map(({ label, onClick }) => (
            <BaseButton key={label} onClick={onClick} style={{ width: "100%" }}>
              {label}
            </BaseButton>
          ))}
        </div>
      </div>
    </div>
  );
});
