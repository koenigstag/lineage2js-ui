import { RACES, getAvailableBaseClasses, type BaseClass, type Race, type Sex } from "../../../../config/character-races";

export interface GalleryVariant {
  race: Race;
  baseClass: BaseClass;
  sex: Sex;
}

export interface GalleryGroup {
  race: Race;
  variants: GalleryVariant[];
}

const SEXES: Sex[] = ["MALE", "FEMALE"];

export const RACE_GALLERY: GalleryGroup[] = RACES.map((race) => {
  const variants: GalleryVariant[] = [];
  for (const baseClass of getAvailableBaseClasses(race)) {
    for (const sex of SEXES) {
      variants.push({ race, baseClass, sex });
    }
  }
  return { race, variants };
});

const CLASS_COLORS: Record<BaseClass, { MALE: string; FEMALE: string }> = {
  fighter: { MALE: "#8a4a3a", FEMALE: "#b06a4a" },
  mystic: { MALE: "#3a5a8a", FEMALE: "#6a8ab0" },
};

export function colorForVariant(variant: GalleryVariant): string {
  return CLASS_COLORS[variant.baseClass][variant.sex];
}
