import { t } from "../lang/lang";

/**
 * The three appearance choices a character carries besides race/class/sex,
 * as the 0-based indices Face/HairStyle/HairColor use on the wire.
 */
export interface CharacterAppearance {
  face: number;
  hair: number;
  hairColor: number;
}

export const DEFAULT_APPEARANCE: CharacterAppearance = { face: 0, hair: 0, hairColor: 0 };

/** How many variants the creation screen offers, matching retail's own counts. */
export const FACE_COUNT = 3;
export const HAIR_STYLE_COUNT = 5;

/**
 * Placeholder hair tones, one per HairColor index.
 *
 * Unlike face and hair style -- which retail varies by swapping the texture
 * on one head mesh, and this pipeline converts no textures (see
 * assets-server/scripts/convert-client-rigs.ts) -- colour is the one
 * appearance choice a flat-tinted body can actually show, since the converted
 * rigs carry a `hair` material slot of their own.
 *
 * @deprecated Invented tones, not ported from any real art source -- the same
 * "temp until textures exist" status as character-races.ts's own colour
 * tables. Index 0 is the tone every body was hard-tinted with before this
 * became selectable.
 */
const HAIR_COLORS = ["#3a2a20", "#7a5230", "#c9a961", "#6a2f20"];

export const HAIR_COLOR_COUNT = HAIR_COLORS.length;

/** Falls back to the default tone for an index off the end -- a character created on a client that offered more colours than this one renders rather than crashing. */
export function getHairColor(index: number): string {
  return HAIR_COLORS[index] ?? HAIR_COLORS[0];
}

/**
 * Options for the creation screen's selects. Numbered labels rather than
 * names because that is what retail shows too -- there is nothing to call
 * "Face 2" but its number.
 */
function numberedOptions(count: number, key: string): Array<{ value: string; label: string }> {
  return Array.from({ length: count }, (_, index) => ({
    value: String(index),
    label: t(`charCreate.${key}${index + 1}`),
  }));
}

export const faceOptions = () => numberedOptions(FACE_COUNT, "face");
export const hairOptions = () => numberedOptions(HAIR_STYLE_COUNT, "hair");
export const hairColorOptions = () => numberedOptions(HAIR_COLOR_COUNT, "color");
