import { useState } from "react";
import { Screen } from "../../core/screen.component";
import { LegalFooter } from "../../core/legal-footer.component";
import { CharCreateMenu } from "../../menus/char-create/char-create.menu";
import { CharCreateScene } from "./scene/char-create-scene.component";
import { RACES, type Race } from "../../../config/character-races";

export function CreateCharScreen() {
  const [race, setRace] = useState<Race>(RACES[0]);

  return (
    <Screen className="screen screen--create-char" style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
        <CharCreateScene race={race} />
        <CharCreateMenu race={race} onRaceChange={setRace} />
      </div>
      <LegalFooter />
    </Screen>
  );
}
