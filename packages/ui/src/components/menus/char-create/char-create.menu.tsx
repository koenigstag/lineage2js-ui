import { useState } from "react";
import { BaseInput } from "../../core/inputs/base.input";
import { SelectInput, type SelectOption } from "../../core/inputs/select.input";
import { BaseButton } from "../../core/buttons/base.button";
import { useGameStore, useUiStore } from "../../../stores/StoreContext";
import { MENU_Z_INDEX } from "../../../config/z-index";

const RACE_OPTIONS: SelectOption[] = [
  { value: "human", label: "Human" },
  { value: "elf", label: "Elf" },
  { value: "dark-elf", label: "Dark Elf" },
  { value: "orc", label: "Orc" },
  { value: "dwarf", label: "Dwarf" },
];

const BASE_CLASS_OPTIONS: SelectOption[] = [
  { value: "fighter", label: "Fighter" },
  { value: "mystic", label: "Mystic" },
];

const SEX_OPTIONS: SelectOption[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];

const FACE_OPTIONS: SelectOption[] = [
  { value: "1", label: "Face 1" },
  { value: "2", label: "Face 2" },
  { value: "3", label: "Face 3" },
];

const HAIR_OPTIONS: SelectOption[] = [
  { value: "1", label: "Hair 1" },
  { value: "2", label: "Hair 2" },
  { value: "3", label: "Hair 3" },
  { value: "4", label: "Hair 4" },
  { value: "5", label: "Hair 5" },
];

export function CharCreateMenu() {
  const game = useGameStore();
  const ui = useUiStore();

  const [nickname, setNickname] = useState("");
  const [race, setRace] = useState(RACE_OPTIONS[0].value);
  const [baseClass, setBaseClass] = useState(BASE_CLASS_OPTIONS[0].value);
  const [sex, setSex] = useState(SEX_OPTIONS[0].value);
  const [face, setFace] = useState(FACE_OPTIONS[0].value);
  const [hair, setHair] = useState(HAIR_OPTIONS[0].value);

  function handleCreateCharacter() {
    if (!nickname.trim()) {
      return;
    }

    const id = game.createCharacter({ nickname, race, baseClass, sex, face, hair });
    game.selectCharacter(id);
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
      <BaseInput value={nickname} placeholder="Nickname" onChange={setNickname} />
      <SelectInput options={RACE_OPTIONS} value={race} onChange={setRace} />
      <SelectInput options={BASE_CLASS_OPTIONS} value={baseClass} onChange={setBaseClass} />
      <SelectInput options={SEX_OPTIONS} value={sex} onChange={setSex} />
      <SelectInput options={FACE_OPTIONS} value={face} onChange={setFace} />
      <SelectInput options={HAIR_OPTIONS} value={hair} onChange={setHair} />
      <div style={{ marginTop: 8 }}>
        <BaseButton onClick={handleCreateCharacter} disabled={!nickname.trim()}>
          Create character
        </BaseButton>
      </div>
    </div>
  );
}
