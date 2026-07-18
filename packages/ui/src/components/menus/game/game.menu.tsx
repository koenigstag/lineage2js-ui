import { useState, type CSSProperties } from "react";
import { observer } from "mobx-react-lite";
import { BaseButton } from "../../core/buttons/base.button";
import { CharacterWindow } from "../../windows/character/character.window";
import { InventoryWindow } from "../../windows/inventory/inventory.window";
import { ActionsWindow } from "../../windows/actions/actions.window";
import { SkillsListWindow } from "../../windows/skills-list/skills-list.window";
import { QuestsWindow } from "../../windows/quests/quests.window";
import { ClanWindow } from "../../windows/clan/clan.window";
import { MapWindow } from "../../windows/map/map.window";
import { useSessionStore, useUiStore } from "../../../stores/StoreContext";

type WindowId = "character" | "inventory" | "actions" | "skills-list" | "quests" | "clan" | "map";

const GRID_ITEMS: { id: WindowId; icon: string; title: string }[] = [
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
  const [openWindows, setOpenWindows] = useState<Set<WindowId>>(new Set());
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  function toggleWindow(id: WindowId) {
    setOpenWindows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleSelectCharacter() {
    setIsMenuOpen(false);
    ui.setScreen("select-char");
  }

  function handleLogout() {
    setIsMenuOpen(false);
    session.logout();
    ui.setScreen("login");
  }

  function handleExit() {
    window.close();
  }

  return (
    <div className="menu menu--game" style={{ position: "relative" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 40px)", gridAutoRows: "40px", gap: 4 }}>
        {GRID_ITEMS.map(({ id, icon, title }) => (
          <button key={id} type="button" style={iconButtonStyle} onClick={() => toggleWindow(id)}>
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
          <BaseButton onClick={handleLogout}>
            <div title="Logout">🚪 Logout</div>
          </BaseButton>
          <BaseButton onClick={() => setIsMenuOpen(false)}>
            <div title="Settings">⚙️ Settings</div>
          </BaseButton>
          <BaseButton onClick={handleExit}>
            <div title="Exit">✖️ Exit</div>
          </BaseButton>
        </div>
      )}

      <CharacterWindow open={openWindows.has("character")} onClose={() => toggleWindow("character")} />
      <InventoryWindow open={openWindows.has("inventory")} onClose={() => toggleWindow("inventory")} />
      <ActionsWindow open={openWindows.has("actions")} onClose={() => toggleWindow("actions")} />
      <SkillsListWindow open={openWindows.has("skills-list")} onClose={() => toggleWindow("skills-list")} />
      <QuestsWindow open={openWindows.has("quests")} onClose={() => toggleWindow("quests")} />
      <ClanWindow open={openWindows.has("clan")} onClose={() => toggleWindow("clan")} />
      <MapWindow open={openWindows.has("map")} onClose={() => toggleWindow("map")} />
    </div>
  );
});
