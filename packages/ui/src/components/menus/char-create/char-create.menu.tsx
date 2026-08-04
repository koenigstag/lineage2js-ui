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

// Values are 0-based to match Face/HairStyle/HairColor's own enum indices directly.
const FACE_OPTIONS: Array<{ value: string; labelKey: string }> = [
  { value: "0", labelKey: "charCreate.face1" },
  { value: "1", labelKey: "charCreate.face2" },
  { value: "2", labelKey: "charCreate.face3" },
];

const HAIR_OPTIONS: Array<{ value: string; labelKey: string }> = [
  { value: "0", labelKey: "charCreate.hair1" },
  { value: "1", labelKey: "charCreate.hair2" },
  { value: "2", labelKey: "charCreate.hair3" },
  { value: "3", labelKey: "charCreate.hair4" },
  { value: "4", labelKey: "charCreate.hair5" },
];

const HAIR_COLOR_OPTIONS: Array<{ value: string; labelKey: string }> = [
  { value: "0", labelKey: "charCreate.color1" },
  { value: "1", labelKey: "charCreate.color2" },
  { value: "2", labelKey: "charCreate.color3" },
  { value: "3", labelKey: "charCreate.color4" },
];

interface CharCreateMenuProps {
  race: RaceNames;
  baseClass: BaseClass;
  sex: SexNames;
  onRaceChange: (race: RaceNames) => void;
  onBaseClassChange: (baseClass: BaseClass) => void;
  onSexChange: (sex: SexNames) => void;
}

export const CharCreateMenu = observer(function CharCreateMenu({
  race,
  baseClass,
  sex,
  onRaceChange,
  onBaseClassChange,
  onSexChange,
}: CharCreateMenuProps) {
  const game = useGameStore();
  const session = useSessionStore();
  const ui = useUiStore();
  const { alert, modal: alertModal } = useAlert();

  const [nickname, setNickname] = useState("");
  const [face, setFace] = useState(FACE_OPTIONS[0].value);
  const [hair, setHair] = useState(HAIR_OPTIONS[0].value);
  const [hairColor, setHairColor] = useState(HAIR_COLOR_OPTIONS[0].value);

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
  const faceOptions: SelectOption[] = FACE_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }));
  const hairOptions: SelectOption[] = HAIR_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }));
  const hairColorOptions: SelectOption[] = HAIR_COLOR_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }));

  async function handleCreateCharacter() {
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
        face: Number(face),
        hair: Number(hair),
        hairColor: Number(hairColor),
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
      <SelectInput options={raceOptions} value={race} onChange={(value) => onRaceChange(value as RaceNames)} />
      <SelectInput
        options={baseClassOptions}
        value={baseClass}
        onChange={(value) => onBaseClassChange(value as BaseClass)}
      />
      <SelectInput options={sexOptions} value={sex} onChange={(value) => onSexChange(value as SexNames)} />
      <SelectInput options={faceOptions} value={face} onChange={setFace} />
      <SelectInput options={hairOptions} value={hair} onChange={setHair} />
      <SelectInput options={hairColorOptions} value={hairColor} onChange={setHairColor} />
      <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
        {/* Deliberately not disabled on an empty name -- validation explains why it's rejected. */}
        <BaseButton onClick={handleCreateCharacter} disabled={session.isConnecting}>
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
