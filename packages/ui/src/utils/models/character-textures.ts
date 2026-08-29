import { SRGBColorSpace, TextureLoader } from "three";
import type { MeshStandardMaterial, Object3D, Texture } from "three";
import { characterTextureIsGlossMask, characterTextureUrl, parseSlot } from "../../config/character-textures";
import type { CharacterAppearance } from "../../config/character-appearance";

/**
 * One in-flight load per URL, kept for the session. A texture is shared by
 * every character wearing it -- only the material is per-character (see
 * instantiateCharacterModel) -- and a town full of orcs draws on the same
 * handful of images.
 */
const loads = new Map<string, Promise<Texture | null>>();

function loadTexture(url: string): Promise<Texture | null> {
  let pending = loads.get(url);
  if (!pending) {
    pending = new TextureLoader()
      .loadAsync(url)
      .then((texture) => {
        // The UVs come out of a glTF, whose origin is the top left rather
        // than the bottom left TextureLoader assumes; and a base colour map
        // is authored in sRGB, which three has to be told or the whole body
        // comes out washed out.
        texture.flipY = false;
        texture.colorSpace = SRGBColorSpace;
        texture.needsUpdate = true;
        return texture;
      })
      .catch((error: unknown) => {
        // A missing texture is a normal state, not a failure: the part simply
        // stays on the flat tint it had before.
        console.warn(`Character texture unavailable at ${url}:`, error);
        return null;
      });
    loads.set(url, pending);
  }
  return pending;
}

/**
 * Dresses an instantiated body in the client's own textures, one per part.
 *
 * Applied after the fact rather than baked into the glTF because two of them
 * are choices: the face and the hair colour are texture swaps in retail, so
 * the same body has to be able to change them without reloading. Parts with
 * no texture -- the Kamael's starting clothes, or any rig at all when no
 * texture server is configured -- keep the flat tint they were given.
 *
 * `isCurrent` is checked after every await: appearance can change several
 * times while these are in flight, and without it a slow first choice would
 * land on top of a fast second one.
 */
export async function applyCharacterTextures(
  root: Object3D,
  rig: string,
  appearance: CharacterAppearance,
  isCurrent: () => boolean
): Promise<void> {
  const materials = new Map<string, MeshStandardMaterial[]>();
  root.traverse((object) => {
    const material = (object as { material?: MeshStandardMaterial }).material;
    if (!material?.name) return;
    const existing = materials.get(material.name);
    if (existing) existing.push(material);
    else materials.set(material.name, [material]);
  });

  // Which head to draw. Counted off the body rather than the index, so it is
  // right before the manifest arrives and right for a rig converted without
  // one -- and clamped, because a character created on a client with more
  // styles than this body has must still render.
  const styles = [...materials.keys()].filter((slot) => parseSlot(slot).part === "hair").length;
  const chosenStyle = Math.min(Math.max(appearance.hair, 0), Math.max(styles - 1, 0));

  await Promise.all(
    [...materials].map(async ([slot, targets]) => {
      const { part, style } = parseSlot(slot);
      // Both heads are in the body; only one is ever drawn. Material.visible
      // is what does it -- the parts share one geometry, so there is no object
      // to hide.
      const shown = part !== "hair" || style === chosenStyle;
      for (const material of targets) material.visible = shown;
      if (!shown) return;

      const url = await characterTextureUrl(rig, slot, appearance);
      if (!url || !isCurrent()) return;
      const glossMask = await characterTextureIsGlossMask(rig, slot);
      const texture = await loadTexture(url);
      if (!texture || !isCurrent()) return;
      for (const material of targets) {
        material.map = texture;
        // The tint stood in for the texture; leaving it on would multiply
        // straight into it and repaint the art.
        material.color.set(0xffffff);
        // Alpha is transparency on most parts and a gloss mask on the ones
        // the converter flags -- getting it backwards either paints hair and
        // cloth black or erases a body, so the answer comes from the index
        // rather than from anything visible in the image. Tested rather than
        // blended: it keeps the depth buffer honest for shapes drawn from
        // both sides, and the alpha here is all but binary anyway.
        material.alphaTest = glossMask ? 0 : 0.5;
        material.needsUpdate = true;
      }
    })
  );
}
