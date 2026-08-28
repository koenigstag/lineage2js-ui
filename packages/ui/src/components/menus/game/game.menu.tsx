import { useEffect, useState, type CSSProperties } from "react";
import { observer } from "mobx-react-lite";
import { BaseButton } from "../../core/buttons/base.button";
import { useConfirmation } from "../../core/confirmation-modal";
import { useAlert } from "../../core/alert-modal";
import { useGameStore, useSessionStore, useUiStore, useWindowManagerStore } from "../../../stores/StoreContext";
import { useIsMobile } from "../../../lib/useIsMobile";
import { getGameMenuIconUrl } from "../../../config/icon-urls";
import { t } from "../../../lang/lang";

const menuIcon = getGameMenuIconUrl("menu");

interface GridItem {
  id: string;
  /**
   * Shown when `image` is unset (no assets server configured) or fails to
   * load -- every button has one, since the real art is copyrighted client
   * material this repo can't ship (see getGameMenuIconUrl).
   */
  icon?: string;
  image?: string;
  titleKey: string;
  /** Only shown on a mobile-width viewport -- panel-visibility toggles that are pointless on desktop, where those windows are always just visible/draggable already. */
  mobileOnly?: boolean;
}

const GRID_ITEMS: GridItem[] = [
  { id: "character", icon: "👨", image: getGameMenuIconUrl("character"), titleKey: "game.grid.character" },
  { id: "inventory", icon: "🎒", image: getGameMenuIconUrl("inventory"), titleKey: "game.grid.inventory" },
  { id: "actions", icon: "🤜", image: getGameMenuIconUrl("actions"), titleKey: "game.grid.actions" },
  { id: "skills-list", icon: "📖", image: getGameMenuIconUrl("skills"), titleKey: "game.grid.skills" },
  { id: "quests", icon: "🗞️", image: getGameMenuIconUrl("quests"), titleKey: "game.grid.quests" },
  { id: "clan", icon: "🚩", image: getGameMenuIconUrl("clan"), titleKey: "game.grid.clan" },
  { id: "map", icon: "🗺️", image: getGameMenuIconUrl("map"), titleKey: "game.grid.map" },
  { id: "chat", icon: "💬", titleKey: "game.grid.chat", mobileOnly: true },
  { id: "system-messages", icon: "📜", titleKey: "game.grid.battleLog", mobileOnly: true },
  { id: "party-char-info", icon: "👥", titleKey: "game.grid.party", mobileOnly: true },
  { id: "hotbar", icon: "⌨️", titleKey: "game.grid.hotbar", mobileOnly: true },
  { id: "effects", icon: "✨", titleKey: "game.grid.effects", mobileOnly: true },
  { id: "radar", icon: "🧭", titleKey: "game.grid.radar", mobileOnly: true },
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
};

const iconImageStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  display: "block",
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

interface MenuIconButtonProps {
  /** Real icon from the assets server, when one is configured (see getGameMenuIconUrl). */
  image?: string;
  /** Glyph drawn instead whenever that image is missing or fails to load. */
  icon?: string;
  title: string;
  disabled?: boolean;
  onClick: () => void;
}

/**
 * One 40x40 button of the menu grid. The real icon goes in an <img> rather
 * than a CSS background so a file the assets server doesn't have is
 * actually observable: on error the button falls back to the framed glyph,
 * exactly how the mobile-only buttons have always looked. Same approach as
 * IconFrame's iconUrl (components/core/icon-frame.component.tsx).
 */
function MenuIconButton({ image, icon, title, disabled = false, onClick }: MenuIconButtonProps) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [image]);

  const showImage = Boolean(image) && !imageFailed;

  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      style={{
        ...(showImage ? imageButtonStyle : iconButtonStyle),
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
      onClick={onClick}
    >
      {showImage ? (
        <img src={image} alt="" draggable={false} onError={() => setImageFailed(true)} style={iconImageStyle} />
      ) : (
        <div title={title}>{icon}</div>
      )}
    </button>
  );
}

export const GameMenu = observer(function GameMenu() {
  const game = useGameStore();
  const session = useSessionStore();
  const ui = useUiStore();
  const windowManager = useWindowManagerStore();
  const isMobile = useIsMobile();
  const visibleGridItems = GRID_ITEMS.filter((item) => !item.mobileOnly || isMobile);
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
        {visibleGridItems.map(({ id, icon, image, titleKey }) => (
          <MenuIconButton
            key={id}
            image={image}
            icon={icon}
            title={t(titleKey)}
            // party-char-info collapses to nothing (windows-root.tsx)
            // whenever there's no party -- disable the button rather than
            // let a tap silently do nothing.
            disabled={id === "party-char-info" && game.party.length === 0}
            onClick={() => windowManager.toggle(id)}
          />
        ))}
        <MenuIconButton
          image={menuIcon}
          icon="⚙️"
          title={t("game.menuButtonTitle")}
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
