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
/**
 * Only a fallback now. How many hair styles a body actually has is a property
 * of that body -- the client ships two head meshes for most rigs and one for
 * the orcs, the shamans and the male dwarf -- so the screen asks the converted
 * rig (see characterHairStyleCount) and falls back to this when there is no
 * texture server to ask, which is also when there is no hair to change.
 */
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
 * Options for the creation screen's appearance selects.
 *
 * Lettered, and lettered the same way for all three: there is nothing to call
 * one face or another but which one it is, and "Type A" is what retail's own
 * creation screen shows. One string covers every select, so a rig that turns
 * out to have another hair style needs no new one.
 */
function typeOptions(count: number): Array<{ value: string; label: string }> {
  return Array.from({ length: count }, (_, index) => ({
    value: String(index),
    // Past Z there is no letter left; the number reads better than whatever
    // punctuation follows it in the alphabet.
    label: t("charCreate.typeOption", { type: index < 26 ? String.fromCharCode(65 + index) : index + 1 }),
  }));
}

export const faceOptions = () => typeOptions(FACE_COUNT);
export const hairOptions = (count = HAIR_STYLE_COUNT) => typeOptions(count);
export const hairColorOptions = () => typeOptions(HAIR_COLOR_COUNT);
