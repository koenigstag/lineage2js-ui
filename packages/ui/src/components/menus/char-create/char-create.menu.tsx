import { useState } from "react";
import { observer } from "mobx-react-lite";
import { BaseInput } from "../../core/inputs/base.input";
import { SelectInput, type SelectOption } from "../../core/inputs/select.input";
import { BaseButton } from "../../core/buttons/base.button";
import { useAlert } from "../../core/alert-modal";
import { useSessionStore, useUiStore } from "../../../stores/StoreContext";
import { MENU_Z_INDEX } from "../../../config/z-index";
import { buildNewCharacter } from "../../../config/network-mapping";
import {
  RACES,
  RACE_LABELS,
  getAvailableBaseClasses,
  getBaseClassLabel,
  type Race,
  type BaseClass,
  type Sex,
} from "../../../config/character-races";

const RACE_OPTIONS: SelectOption[] = RACES.map((race) => ({ value: race, label: RACE_LABELS[race] }));

const SEX_OPTIONS: SelectOption[] = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
];

// Values are 0-based to match Face/HairStyle/HairColor's own enum indices directly.
const FACE_OPTIONS: SelectOption[] = [
  { value: "0", label: "Face 1" },
  { value: "1", label: "Face 2" },
  { value: "2", label: "Face 3" },
];

const HAIR_OPTIONS: SelectOption[] = [
  { value: "0", label: "Hair 1" },
  { value: "1", label: "Hair 2" },
  { value: "2", label: "Hair 3" },
  { value: "3", label: "Hair 4" },
  { value: "4", label: "Hair 5" },
];

const HAIR_COLOR_OPTIONS: SelectOption[] = [
  { value: "0", label: "Color 1" },
  { value: "1", label: "Color 2" },
  { value: "2", label: "Color 3" },
  { value: "3", label: "Color 4" },
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

  const baseClassOptions: SelectOption[] = getAvailableBaseClasses(race).map((value) => ({
    value,
    label: getBaseClassLabel(race, value),
  }));

  async function handleCreateCharacter() {
    if (!nickname.trim()) {
      return;
    }

    const charData = buildNewCharacter({
      nickname,
      race,
      baseClass,
      sex,
      face: Number(face),
      hair: Number(hair),
      hairColor: Number(hairColor),
    });

    // The new character is appended at the roster's current length -- see
    // CommandCreateCharacter. A real client goes straight into the world
    // after creation, so success here means "game", not back to char-select.
    if (await session.createCharacter(charData, session.characters.length)) {
      ui.setScreen("game");
    } else {
      await alert(session.error ?? "Could not create character.");
    }
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
      <BaseInput value={nickname} placeholder="Nickname" onChange={setNickname} />
      <SelectInput options={RACE_OPTIONS} value={race} onChange={(value) => onRaceChange(value as Race)} />
      <SelectInput
        options={baseClassOptions}
        value={baseClass}
        onChange={(value) => onBaseClassChange(value as BaseClass)}
      />
      <SelectInput options={SEX_OPTIONS} value={sex} onChange={(value) => onSexChange(value as Sex)} />
      <SelectInput options={FACE_OPTIONS} value={face} onChange={setFace} />
      <SelectInput options={HAIR_OPTIONS} value={hair} onChange={setHair} />
      <SelectInput options={HAIR_COLOR_OPTIONS} value={hairColor} onChange={setHairColor} />
      <div style={{ marginTop: 8 }}>
        <BaseButton onClick={handleCreateCharacter} disabled={!nickname.trim() || session.isConnecting}>
          {session.isConnecting ? "Creating..." : "Create character"}
        </BaseButton>
      </div>
      {alertModal}
    </div>
  );
});
