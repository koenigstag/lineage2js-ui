import type { CharacterAppearance } from "./character-appearance";

const CHARACTER_TEXTURE_BASE_URL = import.meta.env.VITE_CHARACTER_TEXTURE_BASE_URL;

/**
 * The parts a converted body is split into, and the name each one's material
 * carries in the glTF (see assets-server/scripts/convert-client-rigs.ts).
 *
 * A part is its own primitive precisely because it is its own texture -- the
 * client keeps one per part per rig, so they cannot share a material.
 */
export type BodyPart = "face" | "hair" | "upper" | "lower" | "boots" | "gloves" | "wing";

/**
 * A material's name is the slot it fills, which is the body part -- except for
 * hair, where it carries a style index after a dash.
 *
 * Hair is the one part a rig ships more than one of: the client keeps two head
 * meshes (`m00_bh` and `m00_ah`) and character creation picks between them, so
 * both are merged into the body and the runtime draws one. Rigs whose second
 * head the client never shows -- the orcs, the shamans, the male dwarf, the
 * male dark elf -- come out with a single style.
 */
export function parseSlot(slot: string): { part: BodyPart; style: number } {
  const dash = slot.lastIndexOf("-");
  if (dash < 0) return { part: slot as BodyPart, style: 0 };
  const style = Number(slot.slice(dash + 1));
  return Number.isInteger(style) ? { part: slot.slice(0, dash) as BodyPart, style } : { part: slot as BodyPart, style: 0 };
}

/**
 * Which appearance choice selects a part's texture.
 *
 * Both of the ones that vary are texture swaps in retail rather than
 * different geometry, which is why the counts line up with what character
 * creation offers: three faces, four hair colours. Everything else has one
 * texture and ignores the appearance entirely.
 */
function variantFor(part: BodyPart, appearance: CharacterAppearance): number {
  if (part === "face") return appearance.face;
  if (part === "hair") return appearance.hairColor;
  return 0;
}

/**
 * rig -> how many variants of each part it ships, written by the converter
 * beside the files, plus a token the server adds per rig.
 *
 * The token is what lets the textures be cached hard and still never be
 * stale: a re-converted rig arrives under URLs the browser has never seen.
 * Without it the files keep their names from one conversion to the next, and
 * an hour of the previous art is what everyone gets -- which is exactly how
 * long a wrong body can be mistaken for a wrong converter.
 */
interface TextureEntry {
  /** Slot -> how many variants of it the rig ships. */
  [slot: string]: number | string | string[] | undefined;
  /** Cache-busting token the server adds per rig. */
  v?: string;
  /** Slots whose alpha is a gloss mask rather than transparency. */
  gloss?: string[];
}

type TextureIndex = Record<string, TextureEntry>;

/**
 * Fetched once per session. Without it a caller would have to guess which
 * parts exist -- and they genuinely differ: the Kamael package has no texture
 * for the starting body's clothing, so those parts stay on their flat tint
 * while the face and hair do not.
 *
 * Resolves to null when no texture server is configured or it can't be
 * reached, which leaves every body tinted exactly as it was before textures.
 */
let indexRequest: Promise<TextureIndex | null> | undefined;

function textureIndex(): Promise<TextureIndex | null> {
  indexRequest ??= (async () => {
    if (!CHARACTER_TEXTURE_BASE_URL) return null;
    try {
      const response = await fetch(`${base()}index.json`);
      if (!response.ok) return null;
      return (await response.json()) as TextureIndex;
    } catch {
      return null;
    }
  })();
  return indexRequest;
}

function base(): string {
  return CHARACTER_TEXTURE_BASE_URL.endsWith("/") ? CHARACTER_TEXTURE_BASE_URL : `${CHARACTER_TEXTURE_BASE_URL}/`;
}

/**
 * Whether a part's texture uses its alpha channel as a gloss mask rather than
 * as transparency, which decides whether the runtime may alpha-test it.
 *
 * The converter works this out from where the texture came from and writes it
 * into the index -- see TextureManifest in convert-client-rigs.ts for why the
 * two cannot be told apart by looking at the image.
 *
 * An index that predates the field answers "gloss mask" for everything, which
 * is the safe way round rather than the accurate one. The two mistakes are not
 * equal: leaving a cut-out untested paints black around the hair, while
 * testing a gloss mask deletes the torso and legs outright -- which is exactly
 * what a page holding an index fetched before the converter rewrote it did.
 * The field is written even when empty, so its presence is the signal.
 */
export async function characterTextureIsGlossMask(rig: string, slot: string): Promise<boolean> {
  const index = await textureIndex();
  const gloss = index?.[rig]?.gloss;
  return gloss ? gloss.includes(slot) : true;
}

/**
 * How many hair styles a rig actually has, for the creation screen's select.
 *
 * Zero when there is no texture server to ask, which is also when the bodies
 * are flat-tinted capsules with no hair to change -- the caller falls back to
 * offering none rather than offering choices that do nothing.
 */
export async function characterHairStyleCount(rig: string): Promise<number> {
  const index = await textureIndex();
  const entry = index?.[rig];
  if (!entry) return 0;
  return Object.entries(entry).filter(([slot, count]) => typeof count === "number" && parseSlot(slot).part === "hair")
    .length;
}

/**
 * The texture for one part of one rig, or undefined when there isn't one --
 * an unconfigured server, a part the rig doesn't ship, or a variant past the
 * end of what it has (a character created on a client offering more faces
 * than this one still renders, on its first).
 */
export async function characterTextureUrl(
  rig: string,
  slot: string,
  appearance: CharacterAppearance
): Promise<string | undefined> {
  const index = await textureIndex();
  const entry = index?.[rig];
  const available = entry?.[slot];
  if (typeof available !== "number" || available <= 0) return undefined;
  const { part } = parseSlot(slot);
  const variant = Math.min(Math.max(variantFor(part, appearance), 0), available - 1);
  const version = entry?.v ? `?v=${entry.v}` : "";
  return `${base()}${rig}/${slot}-${variant}.png${version}`;
}
