import { useState } from "react";
import { observer } from "mobx-react-lite";
import type { CharacterTemplate } from "@lineage2js/network";
import { Screen } from "../../core/screen.component";
import { LegalFooter } from "../../core/legal-footer.component";
import { CharCreateMenu } from "../../menus/char-create/char-create.menu";
import { CharTemplateInfoMenu } from "../../menus/char-create/char-template-info.menu";
import { CharCreateScene } from "./scene/char-create-scene.component";
import { useSessionStore } from "../../../stores/StoreContext";
import { getAvailableRacesFromTemplates, getAvailableBaseClassesFromTemplates } from "../../../config/network-mapping";
import { type RaceNames, type BaseClass, type SexNames } from "../../../config/character-races";
import { DEFAULT_APPEARANCE, type CharacterAppearance } from "../../../config/character-appearance";

/**
 * The class of a race that has only one, so it can be settled without asking.
 *
 * Creation starts with nothing chosen but the race -- picking class and sex
 * is what walks the camera in -- except where there is nothing to pick:
 * dwarves and Kamael have no mystic line, and offering a one-item choice
 * would be a step that decides nothing. Read off the server's own templates
 * rather than a list of the two races, so a server that trims a class down to
 * one behaves the same way.
 */
function soleBaseClass(templates: CharacterTemplate[], race: RaceNames): BaseClass | null {
  const available = getAvailableBaseClassesFromTemplates(templates, race);
  return available.length === 1 ? available[0] : null;
}

export const CreateCharScreen = observer(function CreateCharScreen() {
  const session = useSessionStore();
  const availableRaces = getAvailableRacesFromTemplates(session.characterTemplates);
  const initialRace = availableRaces[0];

  const [race, setRace] = useState<RaceNames>(initialRace);
  const [baseClass, setBaseClass] = useState<BaseClass | null>(() =>
    soleBaseClass(session.characterTemplates, initialRace)
  );
  const [sex, setSex] = useState<SexNames | null>(null);
  const [appearance, setAppearance] = useState<CharacterAppearance>(DEFAULT_APPEARANCE);

  function handleRaceChange(nextRace: RaceNames) {
    setRace(nextRace);
    // Not carried over: the classes on offer differ by race, and a fighter
    // stays chosen only because every race happens to have one -- which reads
    // as the screen having decided for you.
    setBaseClass(soleBaseClass(session.characterTemplates, nextRace));
  }

  // Sex survives a race or class change on purpose. It means the same thing
  // everywhere, so clearing it would be throwing away an answer the player
  // already gave to a question that hasn't changed.
  function handleSelectVariant(nextRace: RaceNames, nextBaseClass: BaseClass, nextSex: SexNames) {
    setRace(nextRace);
    setBaseClass(nextBaseClass);
    setSex(nextSex);
  }

  return (
    <Screen className="screen screen--create-char" style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
        <CharCreateScene
          race={race}
          baseClass={baseClass}
          sex={sex}
          appearance={appearance}
          onSelectVariant={handleSelectVariant}
        />
        <CharCreateMenu
          race={race}
          baseClass={baseClass}
          sex={sex}
          appearance={appearance}
          onRaceChange={handleRaceChange}
          onBaseClassChange={setBaseClass}
          onSexChange={setSex}
          onAppearanceChange={setAppearance}
        />
        {baseClass !== null && sex !== null && <CharTemplateInfoMenu race={race} baseClass={baseClass} sex={sex} />}
      </div>
      <LegalFooter />
    </Screen>
  );
});
