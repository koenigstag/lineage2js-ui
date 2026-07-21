import { useState } from "react";
import { observer } from "mobx-react-lite";
import { Screen } from "../../core/screen.component";
import { LegalFooter } from "../../core/legal-footer.component";
import { CharCreateMenu } from "../../menus/char-create/char-create.menu";
import { CharTemplateInfoMenu } from "../../menus/char-create/char-template-info.menu";
import { CharCreateScene } from "./scene/char-create-scene.component";
import { useSessionStore } from "../../../stores/StoreContext";
import { getAvailableRacesFromTemplates, getAvailableBaseClassesFromTemplates } from "../../../config/network-mapping";
import { type Race, type BaseClass, type Sex } from "../../../config/character-races";

export const CreateCharScreen = observer(function CreateCharScreen() {
  const session = useSessionStore();
  const availableRaces = getAvailableRacesFromTemplates(session.characterTemplates);

  const [race, setRace] = useState<Race>(availableRaces[0]);
  const [baseClass, setBaseClass] = useState<BaseClass>(
    getAvailableBaseClassesFromTemplates(session.characterTemplates, availableRaces[0])[0]
  );
  const [sex, setSex] = useState<Sex>("MALE");

  function handleRaceChange(nextRace: Race) {
    setRace(nextRace);
    const available = getAvailableBaseClassesFromTemplates(session.characterTemplates, nextRace);
    if (!available.includes(baseClass)) {
      setBaseClass(available[0]);
    }
  }

  function handleSelectVariant(nextRace: Race, nextBaseClass: BaseClass, nextSex: Sex) {
    setRace(nextRace);
    setBaseClass(nextBaseClass);
    setSex(nextSex);
  }

  return (
    <Screen className="screen screen--create-char" style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
        <CharCreateScene race={race} baseClass={baseClass} sex={sex} onSelectVariant={handleSelectVariant} />
        <CharCreateMenu
          race={race}
          baseClass={baseClass}
          sex={sex}
          onRaceChange={handleRaceChange}
          onBaseClassChange={setBaseClass}
          onSexChange={setSex}
        />
        <CharTemplateInfoMenu race={race} baseClass={baseClass} sex={sex} />
      </div>
      <LegalFooter />
    </Screen>
  );
});
