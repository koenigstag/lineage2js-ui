import { useState } from "react";
import { observer } from "mobx-react-lite";
import { BaseInput } from "../../core/inputs/base.input";
import { SelectInput, type SelectOption } from "../../core/inputs/select.input";
import { BaseButton } from "../../core/buttons/base.button";
import { useAlert } from "../../core/alert-modal";
import { useSessionStore, useUiStore } from "../../../stores/StoreContext";
import { MENU_Z_INDEX } from "../../../config/z-index";
import { buildNewCharacter, getAvailableBaseClassesFromTemplates, getAvailableRacesFromTemplates } from "../../../config/network-mapping";
import { getRaceLabel, getBaseClassLabel, type Race, type BaseClass, type Sex } from "../../../config/character-races";
import { t } from "../../../lang/lang";

const SEX_OPTIONS: Array<{ value: Sex; labelKey: string }> = [
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
  race: Race;
  baseClass: BaseClass;
  sex: Sex;
  onRaceChange: (race: Race) => void;
  onBaseClassChange: (baseClass: BaseClass) => void;
  onSexChange: (sex: Sex) => void;
}

export const CharCreateMenu = observer(function CharCreateMenu({
  race,
  baseClass,
  sex,
  onRaceChange,
  onBaseClassChange,
  onSexChange,
}: CharCreateMenuProps) {
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
    if (!nickname.trim()) {
      return;
    }

    const charData = buildNewCharacter(
      {
        nickname,
        race,
        baseClass,
        sex,
        face: Number(face),
        hair: Number(hair),
        hairColor: Number(hairColor),
      },
      session.characterTemplates
    );

    // The new character is appended at the roster's current length -- see
    // CommandCreateCharacter. A real client goes straight into the world
    // after creation, so success here means "game", not back to char-select.
    if (await session.createCharacter(charData, session.characters.length)) {
      ui.setScreen("game");
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
      <BaseInput value={nickname} placeholder={t("charCreate.nicknamePlaceholder")} onChange={setNickname} />
      <SelectInput options={raceOptions} value={race} onChange={(value) => onRaceChange(value as Race)} />
      <SelectInput
        options={baseClassOptions}
        value={baseClass}
        onChange={(value) => onBaseClassChange(value as BaseClass)}
      />
      <SelectInput options={sexOptions} value={sex} onChange={(value) => onSexChange(value as Sex)} />
      <SelectInput options={faceOptions} value={face} onChange={setFace} />
      <SelectInput options={hairOptions} value={hair} onChange={setHair} />
      <SelectInput options={hairColorOptions} value={hairColor} onChange={setHairColor} />
      <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
        <BaseButton onClick={handleCreateCharacter} disabled={!nickname.trim() || session.isConnecting}>
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
