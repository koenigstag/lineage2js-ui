import { observer } from "mobx-react-lite";
import { BaseButton } from "./buttons/base.button";
import { MODAL_Z_INDEX } from "../../config/z-index";
import { t } from "../../lang/lang";
import { useGameStore } from "../../stores/StoreContext";

// Shown whenever the local player is dead (see GameStore.isPlayerDead, set
// from the Die/Revive events in bindToClient). Deliberately has no backdrop
// dismissal or close button -- the only way out is picking one of the
// options below. Currently only "Town" is offered -- clan hall/castle/fixed
// restart points require ownership data this client doesn't model yet, but
// the layout (title + vertical option list) is built to take more.
export const DeathModal = observer(function DeathModal() {
  const game = useGameStore();

  if (!game.isPlayerDead) {
    return null;
  }

  const options = [
    { label: t("death.reviveTownButton"), onClick: () => game.reviveAtTown() },
  ];

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
          {t("death.message")}
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
