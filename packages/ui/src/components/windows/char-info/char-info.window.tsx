import { observer } from "mobx-react-lite";
import { CharacterVitals } from "../../core/character-vitals.component";
import { useGameStore } from "../../../stores/StoreContext";

const BAR_WIDTH = 220;
const BAR_HEIGHT = 16;

export const CharInfoContent = observer(function CharInfoContent() {
  const game = useGameStore();
  const info = game.charInfo;

  return (
    <CharacterVitals
      name={info.name}
      level={info.level}
      cp={info.cp}
      maxCp={info.maxCp}
      hp={info.hp}
      maxHp={info.maxHp}
      mp={info.mp}
      maxMp={info.maxMp}
      vitalityPercent={info.vitalityPercent}
      width={BAR_WIDTH}
      height={BAR_HEIGHT}
      onIdentityClick={() => game.selectSelfAsTarget()}
    />
  );
});
