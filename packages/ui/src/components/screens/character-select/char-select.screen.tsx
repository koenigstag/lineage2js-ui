import { observer } from "mobx-react-lite";
import { Screen } from "../../core/screen.component";
import { BaseButton } from "../../core/buttons/base.button";
import { LegalFooter } from "../../core/legal-footer.component";
import { useAlert } from "../../core/alert-modal";
import { CharSelectMenu } from "../../menus/char-select/char-select.menu";
import { CharInfoMenu } from "../../menus/char-select/char-info.menu";
import { CharSelectScene } from "./scene/char-select-scene.component";
import { useGameStore, useSessionStore, useUiStore } from "../../../stores/StoreContext";
import { toLocalRace, toLocalBaseClass, toLocalSex } from "../../../config/network-mapping";

export const CharSelectScreen = observer(function CharSelectScreen() {
  const game = useGameStore();
  const session = useSessionStore();
  const ui = useUiStore();
  const { alert, modal: alertModal } = useAlert();

  async function handleEnterWorld() {
    const slotIndex = session.characters.findIndex((character) => character.ObjectId === game.selectedCharacterId);
    if (slotIndex < 0) {
      return;
    }

    if (await session.selectCharacter(slotIndex)) {
      game.setActiveCharacter(game.selectedCharacterId);
      ui.setScreen("game");
    } else {
      await alert(session.error ?? "Could not enter the world.");
    }
  }

  const characters = session.characters.map((character) => ({
    id: character.ObjectId,
    nickname: character.Name,
    race: toLocalRace(character),
    baseClass: toLocalBaseClass(character),
    sex: toLocalSex(character),
  }));
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
          <BaseButton onClick={handleEnterWorld} disabled={!selectedCharacter || session.isConnecting}>
            <span style={{ fontSize: 20, padding: "4px 24px", display: "inline-block" }}>
              {session.isConnecting ? "Entering..." : "Start"}
            </span>
          </BaseButton>
        </div>

        <CharSelectMenu />
        <CharInfoMenu />
        {alertModal}
      </div>
      <LegalFooter />
    </Screen>
  );
});
