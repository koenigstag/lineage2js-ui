import { observer } from "mobx-react-lite";
import { Screen } from "../../core/screen.component";
import { BaseButton } from "../../core/buttons/base.button";
import { LegalFooter } from "../../core/legal-footer.component";
import { CharSelectMenu } from "../../menus/char-select/char-select.menu";
import { CharInfoMenu } from "../../menus/char-select/char-info.menu";
import { CharSelectScene } from "./scene/char-select-scene.component";
import { useGameStore, useUiStore } from "../../../stores/StoreContext";

export const CharSelectScreen = observer(function CharSelectScreen() {
  const game = useGameStore();
  const ui = useUiStore();

  function handleEnterWorld() {
    game.enterWorld();
    ui.setScreen("game");
  }

  const characters = Array.from(game.characters.values());
  const selectedCharacter = characters.find((character) => character.id === game.selectedCharacterId);

  return (
    <Screen className="screen screen--select-char" style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
        <CharSelectScene
          characters={characters}
          selectedCharacterId={game.selectedCharacterId}
          onSelect={(id) => game.selectCharacter(id)}
        />

        {selectedCharacter && (
          <div
            style={{
              position: "absolute",
              bottom: 84,
              left: "50%",
              transform: "translateX(-50%)",
              color: "#e8dfc8",
              fontSize: 18,
              textShadow: "0 1px 4px #000000",
            }}
          >
            {selectedCharacter.nickname}
          </div>
        )}

        <div style={{ position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)" }}>
          <BaseButton onClick={handleEnterWorld} disabled={!game.selectedCharacterId}>
            <span style={{ fontSize: 20, padding: "4px 24px", display: "inline-block" }}>Start</span>
          </BaseButton>
        </div>

        <CharSelectMenu />
        <CharInfoMenu />
      </div>
      <LegalFooter />
    </Screen>
  );
});
