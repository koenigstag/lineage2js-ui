import { observer } from "mobx-react-lite";
import { CharacterVitals } from "../../core/character-vitals.component";
import { useGameStore, useSessionStore } from "../../../stores/StoreContext";
import { MENU_Z_INDEX } from "../../../config/z-index";
import { MAX_VITALITY_POINTS } from "../../../stores/GameStore";

const BAR_WIDTH = 156;
const BAR_HEIGHT = 14;

/** Selected character's real Level/HP/MP/Vitality from the server. No CP -- CharSelectionInfo doesn't parse it. */
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
        backgroundColor: "#1a1a1a",
        border: "1px solid #444444",
        borderRadius: 4,
        padding: 12,
      }}
    >
      <CharacterVitals
        name={character.Name}
        level={character.Level}
        hp={character.Hp}
        maxHp={character.MaxHp}
        mp={character.Mp}
        maxMp={character.MaxMp}
        vitalityPercent={(character.Vitality / MAX_VITALITY_POINTS) * 100}
        width={BAR_WIDTH}
        height={BAR_HEIGHT}
      />
    </div>
  );
});
