import { observer } from "mobx-react-lite";
import { useGameStore, useSessionStore } from "../../../stores/StoreContext";
import { MENU_Z_INDEX } from "../../../config/z-index";
import { t } from "../../../lang/lang";

interface VitalBarProps {
  label: string;
  value: number;
  max: number;
  color: string;
}

function VitalBar({ label, value, max, color }: VitalBarProps) {
  const percent = max > 0 ? Math.max(0, Math.min(100, (100 * value) / max)) : 0;

  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#cccccc" }}>
        <span>{label}</span>
        <span>
          {Math.round(value)}/{Math.round(max)}
        </span>
      </div>
      <div style={{ height: 6, backgroundColor: "#222222", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${percent}%`, height: "100%", backgroundColor: color }} />
      </div>
    </div>
  );
}

/** Selected character's real HP/MP from the server. No CP -- CharSelectionInfo doesn't parse it. */
export const CharInfoMenu = observer(function CharInfoMenu() {
  const game = useGameStore();
  const session = useSessionStore();
  const character = session.characters.find((entry) => entry.ObjectId === game.selectedCharacterId);

  if (!character) {
    return null;
  }

  return (
    <div
      style={{
        position: "absolute",
        top: 10,
        left: 10,
        zIndex: MENU_Z_INDEX,
        width: 180,
        backgroundColor: "#1a1a1a",
        border: "1px solid #444444",
        borderRadius: 4,
        padding: 12,
      }}
    >
      <div style={{ color: "#e8dfc8", fontSize: 14, marginBottom: 8 }}>{character.Name}</div>
      <VitalBar label={t("charSelect.hp")} value={character.Hp} max={character.MaxHp} color="#8a3a3a" />
      <VitalBar label={t("charSelect.mp")} value={character.Mp} max={character.MaxMp} color="#3a5a8a" />
    </div>
  );
});
