import { observer } from "mobx-react-lite";
import { BaseButton } from "../../core/buttons/base.button";
import { CharSelectMenu } from "../../menus/char-select/char-select.menu";
import { useGameStore, useUiStore } from "../../../stores/StoreContext";

export const CharSelectScreen = observer(function CharSelectScreen() {
  const game = useGameStore();
  const ui = useUiStore();

  function handleEnterWorld() {
    game.enterWorld();
    ui.setScreen("game");
  }

  const characters = Array.from(game.characters.values());

  return (
    <div
      className="screen screen--select-char"
      style={{ position: "relative", width: "100vw", height: "100vh", backgroundColor: "#000000" }}
    >
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          display: "flex",
          gap: 24,
        }}
      >
        {characters.map((character) => {
          const isSelected = game.selectedCharacterId === character.id;

          return (
            <div
              key={character.id}
              onClick={() => game.selectCharacter(character.id)}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, cursor: "pointer" }}
            >
              <span style={{ color: "#cccccc" }}>{character.nickname}</span>
              <div
                style={{
                  width: 96,
                  height: 128,
                  border: isSelected ? "2px solid #ffffff" : "1px solid #666666",
                  backgroundColor: "#111111",
                }}
              />
            </div>
          );
        })}
      </div>

      <div style={{ position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)" }}>
        <BaseButton onClick={handleEnterWorld} disabled={!game.selectedCharacterId}>
          <span style={{ fontSize: 20, padding: "4px 24px", display: "inline-block" }}>Enter world</span>
        </BaseButton>
      </div>

      <CharSelectMenu />
    </div>
  );
});
