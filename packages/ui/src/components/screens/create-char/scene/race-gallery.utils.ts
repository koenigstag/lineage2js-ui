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

const SEXES: Sex[] = ["male", "female"];

export const RACE_GALLERY: GalleryGroup[] = RACES.map((race) => {
  const variants: GalleryVariant[] = [];
  for (const baseClass of getAvailableBaseClasses(race)) {
    for (const sex of SEXES) {
      variants.push({ race, baseClass, sex });
    }
  }
  return { race, variants };
});

const CLASS_COLORS: Record<BaseClass, { male: string; female: string }> = {
  fighter: { male: "#8a4a3a", female: "#b06a4a" },
  mystic: { male: "#3a5a8a", female: "#6a8ab0" },
};

export function colorForVariant(variant: GalleryVariant): string {
  return CLASS_COLORS[variant.baseClass][variant.sex];
}
