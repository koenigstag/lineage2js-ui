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
    if (nextRace === race) return;
    setRace(nextRace);
    // Neither is carried over: picking a race starts the walk-in again from
    // the new race's whole line-up, and a class or sex still selected under it
    // reads as the screen having decided for you. Class stays settled only
    // where there is nothing to decide (see soleBaseClass).
    setBaseClass(soleBaseClass(session.characterTemplates, nextRace));
    setSex(null);
    setAppearance(DEFAULT_APPEARANCE);
  }

  function handleBaseClassChange(nextBaseClass: BaseClass) {
    if (nextBaseClass === baseClass) return;
    setBaseClass(nextBaseClass);
    setAppearance(DEFAULT_APPEARANCE);
  }

  // Sex survives a class change on purpose -- within a race it means the same
  // thing for either class, so clearing it would be throwing away an answer
  // the player already gave to a question that hasn't changed. It does not
  // survive a race change, where the line-up it was answered against is gone.
  // Face, hair and hair colour survive neither: each is a different body's art
  // under the same numbering, so "face 2" carried across is a choice the
  // player never made.
  function handleSelectVariant(nextRace: RaceNames, nextBaseClass: BaseClass, nextSex: SexNames) {
    if (nextRace !== race || nextBaseClass !== baseClass) setAppearance(DEFAULT_APPEARANCE);
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
          onBaseClassChange={handleBaseClassChange}
          onSexChange={setSex}
          onAppearanceChange={setAppearance}
        />
        {baseClass !== null && sex !== null && <CharTemplateInfoMenu race={race} baseClass={baseClass} sex={sex} />}
      </div>
      <LegalFooter />
    </Screen>
  );
});
