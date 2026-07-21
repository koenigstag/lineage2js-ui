import { observer } from "mobx-react-lite";
import { useGameStore } from "../../../stores/StoreContext";
import { getBaseVitals, type Race, type BaseClass } from "../../../config/character-races";
import { MENU_Z_INDEX } from "../../../config/z-index";

interface VitalBarProps {
  label: string;
  value: number;
  color: string;
}

function VitalBar({ label, value, color }: VitalBarProps) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#cccccc" }}>
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div style={{ height: 6, backgroundColor: "#222222", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: "100%", height: "100%", backgroundColor: color }} />
      </div>
    </div>
  );
}

/** Selected character's HP/MP/CP -- demo vitals, no combat/damage tracking yet, so always shown full. */
export const CharInfoMenu = observer(function CharInfoMenu() {
  const game = useGameStore();
  const character = game.selectedCharacterId ? game.characters.get(game.selectedCharacterId) : undefined;

  if (!character) {
    return null;
  }

  const vitals = getBaseVitals(character.race as Race, character.baseClass as BaseClass);

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
      <div style={{ color: "#e8dfc8", fontSize: 14, marginBottom: 8 }}>{character.nickname}</div>
      <VitalBar label="HP" value={vitals.hp} color="#8a3a3a" />
      <VitalBar label="MP" value={vitals.mp} color="#3a5a8a" />
      <VitalBar label="CP" value={vitals.cp} color="#c2a23e" />
    </div>
  );
});
