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

/** rig -> how many variants of each part it ships, written by the converter beside the files. */
type TextureIndex = Record<string, Partial<Record<BodyPart, number>>>;

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
 * The texture for one part of one rig, or undefined when there isn't one --
 * an unconfigured server, a part the rig doesn't ship, or a variant past the
 * end of what it has (a character created on a client offering more faces
 * than this one still renders, on its first).
 */
export async function characterTextureUrl(
  rig: string,
  part: BodyPart,
  appearance: CharacterAppearance
): Promise<string | undefined> {
  const index = await textureIndex();
  const available = index?.[rig]?.[part];
  if (!available) return undefined;
  const variant = Math.min(Math.max(variantFor(part, appearance), 0), available - 1);
  return `${base()}${rig}/${part}-${variant}.png`;
}
