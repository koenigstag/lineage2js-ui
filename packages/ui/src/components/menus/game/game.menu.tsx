import { useState, type CSSProperties } from "react";
import { observer } from "mobx-react-lite";
import { BaseButton } from "../../core/buttons/base.button";
import { useConfirmation } from "../../core/confirmation-modal";
import { useAlert } from "../../core/alert-modal";
import { useGameStore, useSessionStore, useUiStore, useWindowManagerStore } from "../../../stores/StoreContext";
import characterIcon from "../../../assets/menus/game/character@64.png";
import inventoryIcon from "../../../assets/menus/game/inventory@64.png";
import clanIcon from "../../../assets/menus/game/clan@64.png";
import skillsIcon from "../../../assets/menus/game/skills@64.png";
import mapIcon from "../../../assets/menus/game/map@64.png";
import menuIcon from "../../../assets/menus/game/menu@64.png";
import { t } from "../../../lang/lang";

const GRID_ITEMS: { id: string; icon?: string; image?: string; titleKey: string }[] = [
  { id: "character", image: characterIcon, titleKey: "game.grid.character" },
  { id: "inventory", image: inventoryIcon, titleKey: "game.grid.inventory" },
  { id: "actions", icon: "🤜", titleKey: "game.grid.actions" },
  { id: "skills-list", image: skillsIcon, titleKey: "game.grid.skills" },
  { id: "quests", icon: "🗞️", titleKey: "game.grid.quests" },
  { id: "clan", image: clanIcon, titleKey: "game.grid.clan" },
  { id: "map", image: mapIcon, titleKey: "game.grid.map" },
  { id: "chat", icon: "💬", titleKey: "game.grid.chat" },
  { id: "system-messages", icon: "📜", titleKey: "game.grid.battleLog" },
  { id: "party-char-info", icon: "👥", titleKey: "game.grid.party" },
  { id: "hotbar", icon: "⌨️", titleKey: "game.grid.hotbar" },
  { id: "effects", icon: "✨", titleKey: "game.grid.effects" },
  { id: "radar", icon: "🧭", titleKey: "game.grid.radar" },
];

const iconButtonStyle: CSSProperties = {
  width: 40,
  height: 40,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#211818",
  color: "#cccccc",
  border: "1px solid #666666",
  borderRadius: 4,
  fontSize: 18,
  cursor: "pointer",
  padding: 0,
};

const imageButtonStyle: CSSProperties = {
  width: 40,
  height: 40,
  background: "transparent",
  border: "none",
  padding: 0,
  cursor: "pointer",
  backgroundSize: "cover",
  backgroundPosition: "center",
};

const submenuRowStyle: CSSProperties = {
  background: "transparent",
  border: "none",
  width: "100%",
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: 4,
  textAlign: "left",
};

const submenuIconStyle: CSSProperties = {
  width: 40,
  height: 40,
  minWidth: 40,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "#180c08",
  border: "1px solid #9c927b",
  borderRadius: 4,
  fontSize: 18,
};

// Odd rows (1st, 3rd, ...) vs even rows (2nd, 4th, ...).
const SUBMENU_ROW_COLORS = ["#10100f", "#171717"];

export const GameMenu = observer(function GameMenu() {
  const game = useGameStore();
  const session = useSessionStore();
  const ui = useUiStore();
  const windowManager = useWindowManagerStore();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { confirm, modal } = useConfirmation();
  const { alert, modal: alertModal } = useAlert();

  async function handleSelectCharacter() {
    setIsMenuOpen(false);
    if (!(await confirm(t("game.returnToSelectConfirm")))) {
      return;
    }

    // Merely switching screens would leave the server thinking the character
    // is still in the world, and every later char-select-state request (the
    // char-create screen's RequestNewCharacter above all) would go unanswered.
    if (await session.restart()) {
      // selectedCharacterId stays put so the character we just left comes back
      // preselected, like the real client does.
      game.setActiveCharacter(undefined);
      ui.setScreen("select-char");
    } else {
      await alert(session.error ?? t("game.restartFailed"));
    }
  }

  function handleMacrosPanel() {
    setIsMenuOpen(false);
    windowManager.toggle("macroses");
  }

  async function handleExit() {
    setIsMenuOpen(false);
    if (await confirm(t("common.exitGameConfirm"))) {
      window.close();
    }
  }

  return (
    <div
      className="menu menu--game"
      style={{
        position: "relative",
        backgroundColor: "#181718",
        border: "1px solid #444444",
        borderRadius: 4,
        padding: 8,
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 40px)", gridAutoRows: "40px", gap: 4 }}>
        {GRID_ITEMS.map(({ id, icon, image, titleKey }) => {
          // party-char-info collapses to nothing (windows-root.tsx) whenever
          // there's no party -- disable the button rather than let a tap
          // silently do nothing.
          const disabled = id === "party-char-info" && game.party.length === 0;
          const title = t(titleKey);
          return (
            <button
              key={id}
              type="button"
              title={title}
              disabled={disabled}
              style={{
                ...(image ? { ...imageButtonStyle, backgroundImage: `url(${image})` } : iconButtonStyle),
                opacity: disabled ? 0.4 : 1,
                cursor: disabled ? "not-allowed" : "pointer",
              }}
              onClick={() => windowManager.toggle(id)}
            >
              {!image && <div title={title}>{icon}</div>}
            </button>
          );
        })}
        <button
          type="button"
          title={t("game.menuButtonTitle")}
          style={{ ...imageButtonStyle, backgroundImage: `url(${menuIcon})` }}
          onClick={() => setIsMenuOpen((open) => !open)}
        />
      </div>

      {isMenuOpen && (
        <div
          style={{
            position: "absolute",
            bottom: "100%",
            left: 0,
            right: 0,
            marginBottom: 4,
            display: "flex",
            flexDirection: "column",
            border: "1px solid #444444",
            borderRadius: 4,
            overflow: "hidden",
          }}
        >
          {[
            { label: t("game.restart"), icon: "🔃", onClick: handleSelectCharacter },
            { label: t("game.macro"), icon: "🪄", onClick: handleMacrosPanel },
            {
              label: t("common.settings"),
              icon: "🖥️",
              onClick: () => {
                setIsMenuOpen(false);
                windowManager.toggle("settings");
              },
            },
            { label: t("game.exitGame"), icon: "🛑", onClick: handleExit },
          ].map(({ label, icon, onClick }, index) => (
            <div key={label} style={{ backgroundColor: SUBMENU_ROW_COLORS[index % 2] }}>
              <BaseButton onClick={onClick} style={submenuRowStyle}>
                <div title={label} style={submenuIconStyle}>
                  {icon}
                </div>
                <span>{label}</span>
              </BaseButton>
            </div>
          ))}
        </div>
      )}

      {modal}
      {alertModal}
    </div>
  );
});
