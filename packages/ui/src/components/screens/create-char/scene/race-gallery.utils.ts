import { RACES, getAvailableBaseClasses, type PlayerVariant, type RaceNames, type SexNames } from "../../../../config/character-races";

// Same shape as PlayerVariant -- kept as its own name since it's specifically
// what RACE_GALLERY enumerates, not every caller with a player variant on
// hand. colorForVariant/getPlayerVisualFromVariant now live in
// character-races.ts (shared by char-select/CreatureModel's player branch
// too, not just this gallery).
export type GalleryVariant = PlayerVariant;

export interface GalleryGroup {
  race: RaceNames;
  variants: GalleryVariant[];
}

const SEXES: SexNames[] = ["MALE", "FEMALE"];

export const RACE_GALLERY: GalleryGroup[] = RACES.map((race) => {
  const variants: GalleryVariant[] = [];
  for (const baseClass of getAvailableBaseClasses(race)) {
    for (const sex of SEXES) {
      variants.push({ race, baseClass, sex });
    }
  }
  return { race, variants };
});
