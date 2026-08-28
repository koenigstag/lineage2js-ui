import { useState } from "react";
import { observer } from "mobx-react-lite";
import { BaseInput } from "../../core/inputs/base.input";
import { SelectInput, type SelectOption } from "../../core/inputs/select.input";
import { BaseButton } from "../../core/buttons/base.button";
import { useAlert } from "../../core/alert-modal";
import { useGameStore, useSessionStore, useUiStore } from "../../../stores/StoreContext";
import { MENU_Z_INDEX } from "../../../config/z-index";
import { buildNewCharacter, getAvailableBaseClassesFromTemplates, getAvailableRacesFromTemplates } from "../../../config/network-mapping";
import { getRaceLabel, getBaseClassLabel, type RaceNames, type BaseClass, type SexNames } from "../../../config/character-races";
import {
  faceOptions,
  hairColorOptions,
  hairOptions,
  type CharacterAppearance,
} from "../../../config/character-appearance";
import {
  MAX_CHARACTER_NAME_LENGTH,
  validateCharacterName,
  type CharacterNameError,
} from "../../../lib/character-name";
import { t } from "../../../lang/lang";

const NAME_ERROR_KEYS: Record<CharacterNameError, string> = {
  length: "charCreate.nameErrorLength",
  characters: "charCreate.nameErrorCharacters",
  taken: "charCreate.nameErrorTaken",
};

const SEX_OPTIONS: Array<{ value: SexNames; labelKey: string }> = [
  { value: "MALE", labelKey: "charCreate.sexMale" },
  { value: "FEMALE", labelKey: "charCreate.sexFemale" },
];

interface CharCreateMenuProps {
  race: RaceNames;
  /** Null until chosen -- see CreateCharScreen for why nothing but the race starts settled. */
  baseClass: BaseClass | null;
  sex: SexNames | null;
  appearance: CharacterAppearance;
  onRaceChange: (race: RaceNames) => void;
  onBaseClassChange: (baseClass: BaseClass) => void;
  onSexChange: (sex: SexNames) => void;
  onAppearanceChange: (appearance: CharacterAppearance) => void;
}

export const CharCreateMenu = observer(function CharCreateMenu({
  race,
  baseClass,
  sex,
  appearance,
  onRaceChange,
  onBaseClassChange,
  onSexChange,
  onAppearanceChange,
}: CharCreateMenuProps) {
  const game = useGameStore();
  const session = useSessionStore();
  const ui = useUiStore();
  const { alert, modal: alertModal } = useAlert();

  const [nickname, setNickname] = useState("");

  const raceOptions: SelectOption[] = getAvailableRacesFromTemplates(session.characterTemplates).map((value) => ({
    value,
    label: getRaceLabel(value),
  }));
  const baseClassOptions: SelectOption[] = getAvailableBaseClassesFromTemplates(session.characterTemplates, race).map(
    (value) => ({
      value,
      label: getBaseClassLabel(value),
    })
  );
  const sexOptions: SelectOption[] = SEX_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }));

  // Each step opens the next: the scene moves in on the class's two bodies,
  // then on one face, and the appearance choices are only worth making once
  // there is a face to see them on.
  const bodyChosen = baseClass !== null && sex !== null;

  async function handleCreateCharacter() {
    if (baseClass === null || sex === null) return;

    // Catch what the server would reject anyway, so the player gets a specific
    // reason instead of a round-trip ending in a generic CharCreateFail.
    const nameError = validateCharacterName(
      nickname,
      session.characters.map((character) => character.Name)
    );
    if (nameError) {
      await alert(t(NAME_ERROR_KEYS[nameError]));
      return;
    }

    const charData = buildNewCharacter(
      {
        nickname: nickname.trim(),
        race,
        baseClass,
        sex,
        face: appearance.face,
        hair: appearance.hair,
        hairColor: appearance.hairColor,
      },
      session.characterTemplates
    );

    // Like the real client, creating a character drops back to selection with
    // the new one preselected rather than entering the world -- the server
    // stays in the char-select state either way (see CommandCreateCharacter).
    const newCharacterId = await session.createCharacter(charData);
    if (newCharacterId !== undefined) {
      game.selectCharacter(newCharacterId);
      ui.setScreen("select-char");
    } else {
      await alert(session.error ?? t("charCreate.createFailed"));
    }
  }

  function handleBack() {
    ui.setScreen("select-char");
  }

  return (
    <div
      style={{
        position: "absolute",
        top: 10,
        left: 10,
        zIndex: MENU_Z_INDEX,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        width: 240,
        backgroundColor: "#1a1a1a",
        border: "1px solid #444444",
        borderRadius: 4,
        padding: 16,
      }}
    >
      <BaseInput
        value={nickname}
        placeholder={t("charCreate.nicknamePlaceholder")}
        maxLength={MAX_CHARACTER_NAME_LENGTH}
        onChange={setNickname}
      />
      <SelectInput
        options={raceOptions}
        value={race}
        placeholder={t("charCreate.racePlaceholder")}
        onChange={(value) => onRaceChange(value as RaceNames)}
      />
      <SelectInput
        options={baseClassOptions}
        value={baseClass ?? ""}
        placeholder={t("charCreate.classPlaceholder")}
        onChange={(value) => onBaseClassChange(value as BaseClass)}
      />
      <SelectInput
        options={sexOptions}
        value={sex ?? ""}
        placeholder={t("charCreate.sexPlaceholder")}
        disabled={baseClass === null}
        onChange={(value) => onSexChange(value as SexNames)}
      />
      <SelectInput
        options={faceOptions()}
        value={String(appearance.face)}
        placeholder={t("charCreate.facePlaceholder")}
        disabled={!bodyChosen}
        onChange={(value) => onAppearanceChange({ ...appearance, face: Number(value) })}
      />
      <SelectInput
        options={hairOptions()}
        value={String(appearance.hair)}
        placeholder={t("charCreate.hairPlaceholder")}
        disabled={!bodyChosen}
        onChange={(value) => onAppearanceChange({ ...appearance, hair: Number(value) })}
      />
      <SelectInput
        options={hairColorOptions()}
        value={String(appearance.hairColor)}
        placeholder={t("charCreate.hairColorPlaceholder")}
        disabled={!bodyChosen}
        onChange={(value) => onAppearanceChange({ ...appearance, hairColor: Number(value) })}
      />
      <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
        {/* Deliberately not disabled on an empty name -- validation explains why it's rejected. An
            unchosen class or sex is different: there is no mistake to explain, the character simply
            isn't described yet. */}
        <BaseButton onClick={handleCreateCharacter} disabled={session.isConnecting || !bodyChosen}>
          {session.isConnecting ? t("charCreate.creating") : t("charCreate.createButton")}
        </BaseButton>
        <BaseButton onClick={handleBack} disabled={session.isConnecting}>
          {t("charCreate.backButton")}
        </BaseButton>
      </div>
      {alertModal}
    </div>
  );
});
