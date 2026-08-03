import { observer } from "mobx-react-lite";
import { BaseButton } from "./buttons/base.button";
import { MODAL_Z_INDEX } from "../../config/z-index";
import { t } from "../../lang/lang";
import { useGameStore } from "../../stores/StoreContext";

// Shown whenever the local player is dead (see GameStore.isPlayerDead, set
// from the Die/Revive events in bindToClient). Only offers "Town" -- clan
// hall/castle/fixed restart points require ownership data this client
// doesn't model yet.
export const DeathModal = observer(function DeathModal() {
  const game = useGameStore();

  if (!game.isPlayerDead) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: MODAL_Z_INDEX,
        backgroundColor: "rgba(0, 0, 0, 0.4)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
          minWidth: 280,
          backgroundColor: "#1a1a1a",
          border: "1px solid #444444",
          borderRadius: 4,
          padding: 20,
        }}
      >
        <span style={{ color: "#cccccc" }}>{t("death.message")}</span>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <BaseButton onClick={() => game.reviveAtTown()}>
            {t("death.reviveTownButton")}
          </BaseButton>
        </div>
      </div>
    </div>
  );
});
