import type { LangDictionary } from "./lang";

export const LANG_EN_US: LangDictionary = {
  classes: {
    race: {
      HUMAN: "Human",
      ELF: "Elf",
      DARK_ELF: "Dark Elf",
      ORC: "Orc",
      DWARF: "Dwarf",
      KAMAEL: "Kamael",
    },
    baseClass: {
      fighter: "Fighter",
      mystic: "Mystic",
    },
    // Orc's mystic archetype has its own name instead of "Orc Mystic".
    orcMystic: "Shaman",
  },
};
