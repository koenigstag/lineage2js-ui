import { useState, type CSSProperties } from "react";
import { observer } from "mobx-react-lite";
import { BaseButton } from "../../core/buttons/base.button";
import { useConfirmation } from "../../core/confirmation-modal";
import { useSessionStore, useUiStore, useWindowManagerStore } from "../../../stores/StoreContext";
import { MENU_Z_INDEX } from "../../../config/z-index";

const GRID_ITEMS: { id: string; icon: string; title: string }[] = [
  { id: "character", icon: "🧍", title: "Character" },
  { id: "inventory", icon: "🎒", title: "Inventory" },
  { id: "actions", icon: "✋", title: "Actions" },
  { id: "skills-list", icon: "📖", title: "Skills" },
  { id: "quests", icon: "📜", title: "Quests" },
  { id: "clan", icon: "🚩", title: "Clan" },
  { id: "map", icon: "🗺️", title: "Map" },
];

const iconButtonStyle: CSSProperties = {
  width: 40,
  height: 40,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#2a2a2a",
  color: "#cccccc",
  border: "1px solid #666666",
  borderRadius: 4,
  fontSize: 18,
  cursor: "pointer",
  padding: 0,
};

export const GameMenu = observer(function GameMenu() {
  const session = useSessionStore();
  const ui = useUiStore();
  const windowManager = useWindowManagerStore();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { confirm, modal } = useConfirmation();

  function handleSelectCharacter() {
    setIsMenuOpen(false);
    ui.setScreen("select-char");
  }

  function handleMacrosPanel() {
    setIsMenuOpen(false);
    windowManager.toggle("macroses");
  }

  async function handleLogout() {
    setIsMenuOpen(false);
    if (await confirm("Logout to the login screen?")) {
      session.logout();
      ui.setScreen("login");
    }
  }

  async function handleExit() {
    setIsMenuOpen(false);
    if (await confirm("Exit the game?")) {
      window.close();
    }
  }

  return (
    <div
      className="menu menu--game"
      style={{
        position: "relative",
        zIndex: MENU_Z_INDEX,
        backgroundColor: "#1a1a1a",
        border: "1px solid #444444",
        borderRadius: 4,
        padding: 8,
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 40px)", gridAutoRows: "40px", gap: 4 }}>
        {GRID_ITEMS.map(({ id, icon, title }) => (
          <button key={id} type="button" style={iconButtonStyle} onClick={() => windowManager.toggle(id)}>
            <div title={title}>{icon}</div>
          </button>
        ))}
        <button type="button" style={iconButtonStyle} onClick={() => setIsMenuOpen((open) => !open)}>
          <div title="Menu">⚙️</div>
        </button>
      </div>

      {isMenuOpen && (
        <div
          style={{
            position: "absolute",
            bottom: "100%",
            right: 0,
            marginBottom: 4,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            backgroundColor: "#1a1a1a",
            border: "1px solid #444444",
            borderRadius: 4,
            padding: 12,
          }}
        >
          <BaseButton onClick={handleSelectCharacter}>
            <div title="Select character">🧑 Select character</div>
          </BaseButton>
          <BaseButton onClick={handleMacrosPanel}>
            <div title="Macros Panel">⚙️ Macros Panel</div>
          </BaseButton>
          <BaseButton onClick={handleLogout}>
            <div title="Logout">🚪 Logout</div>
          </BaseButton>
          <BaseButton
            onClick={() => {
              setIsMenuOpen(false);
              windowManager.toggle("settings");
            }}
          >
            <div title="Settings">⚙️ Settings</div>
          </BaseButton>
          <BaseButton onClick={handleExit}>
            <div title="Exit">✖️ Exit</div>
          </BaseButton>
        </div>
      )}

      {modal}
    </div>
  );
});
