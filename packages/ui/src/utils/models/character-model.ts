import { useEffect, useState } from "react";
import { Box3 } from "three";
import type { AnimationClip, Bone, Group, Mesh, MeshStandardMaterial } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinnedScene } from "three/examples/jsm/utils/SkeletonUtils.js";
import { versionedModelUrl } from "../../config/character-models";
import { parseSlot } from "../../config/character-textures";
import { L2_TO_THREE_SCALE } from "../coords";

export interface CharacterModelAsset {
  scene: Group;
  animations: AnimationClip[];
}

/**
 * Converted bodies are baked in real client/Unreal units (see UNIT_SCALE in
 * assets-server/scripts/convert-client-rigs.ts) -- the same ones world
 * positions are already in, so this is just L2_TO_THREE_SCALE and nothing
 * body-specific. One factor for every rig either way, so a dwarf stays
 * shorter than an elf instead of every race being normalized to the same
 * height.
 *
 * Used to be its own 1.7/44.6 ratio, calibrated to match the placeholder
 * capsule's arbitrary 1.7-unit height rather than any real client
 * measurement -- see convert-client-rigs.ts's UNIT_SCALE comment for how
 * that (and a matching factor-of-2 error in UNIT_SCALE itself) was found.
 */
export const CHARACTER_MODEL_SCALE = L2_TO_THREE_SCALE;

/**
 * How much CHARACTER_MODEL_SCALE itself changed when it (and UNIT_SCALE) were
 * corrected -- for retroactively fixing anything that was hand-converted
 * from real client data using the OLD value and baked in as literal scene
 * numbers, rather than expressed as `<client units> * CHARACTER_MODEL_SCALE`
 * the way SELECT_ARC_RADIUS now is (client-scene-lighting.ts), which needs
 * no correction of its own since it recomputes from the same source every
 * time. RACE_GALLERY's slot positions (race-gallery.utils.ts) are the other
 * place real client data was converted this way and baked in as numbers.
 */
const OLD_CHARACTER_MODEL_SCALE = 1.7 / 44.6;
export const CLIENT_DATA_CORRECTION = CHARACTER_MODEL_SCALE / OLD_CHARACTER_MODEL_SCALE;

/**
 * A human fighter's converted body, in three.js units -- ~45.5 client units
 * tall (measured off mfighter.glb's own bounding box; see UNIT_SCALE's
 * comment in convert-client-rigs.ts for why this is roughly double
 * lineage2ts's collisionMaleHeight rather than equal to it). The same
 * reference every race's auxiliary geometry (nickname height, click volume,
 * selection ring, camera framing) is pegged to, same as before this was
 * corrected it was pegged to the placeholder capsule's 1.7. Not per-race on
 * purpose: a dwarf rendering shorter than this and an orc taller than it is
 * the point (see CHARACTER_MODEL_SCALE), but the *auxiliary* geometry was
 * never per-race either, so this keeps that the same rough
 * one-size-fits-all it always was.
 */
export const REFERENCE_HUMAN_HEIGHT_M = 45.5 * CHARACTER_MODEL_SCALE;

/**
 * How far every other body-relative or decorative number in these scenes
 * (nickname height, click volume, selection ring, camera framing, the
 * char-select campfire's own hand-tuned geometry) needs to shrink now that
 * REFERENCE_HUMAN_HEIGHT_M is the real ~0.43 instead of the placeholder
 * capsule's arbitrary 1.7 they were all originally tuned against.
 */
export const LEGACY_SCENE_SCALE = REFERENCE_HUMAN_HEIGHT_M / 1.7;

/**
 * World height of the middle of a converted body's head, for anything that
 * has to aim at a face -- the creation screen's close-up shot, mainly.
 *
 * Measured off the model rather than assumed, because the rigs are nowhere
 * near a common height: a dwarf's head sits at 1.19 and an orc's at 1.89, and
 * the two ends of that are three quarters of a portrait shot apart. Midway
 * between the head joint and the top of the body lands on the face for every
 * rig in the set, retail-converted and Unity-converted alike.
 *
 * Cached per asset: the bodies are shared and immutable, and this walks the
 * whole tree.
 */
const headHeights = new WeakMap<CharacterModelAsset, number>();

export function getHeadHeight(asset: CharacterModelAsset): number {
  const cached = headHeights.get(asset);
  if (cached !== undefined) return cached;

  asset.scene.updateMatrixWorld(true);
  const top = new Box3().setFromObject(asset.scene).max.y;

  let joint = 0;
  asset.scene.traverse((object) => {
    // The joint itself, not the HeadNub tip above it, which every one of
    // these rigs also carries.
    if ((object as Bone).isBone && /head$/i.test(object.name)) {
      joint = Math.max(joint, object.matrixWorld.elements[13]);
    }
  });

  // No head joint at all would mean a rig unlike any in the set; aiming just
  // under the crown is still a face rather than the middle of a chest.
  const height = (joint > 0 ? (joint + top) / 2 : top * 0.94) * CHARACTER_MODEL_SCALE;
  headHeights.set(asset, height);
  return height;
}

/**
 * Which tint stands in for a part's texture, by the material name the
 * converter gave it.
 *
 * Two vocabularies on purpose: the retail-converted rigs name a material
 * after the body part it is, because that is how the client textures them
 * (see convert-client-rigs.ts), while the Unity-converted ten still name
 * theirs after the tint itself. Both have to resolve for as long as bodies
 * come from both pipelines.
 */
const TINT_FOR_MATERIAL: Record<string, keyof CharacterModelTint> = {
  skin: "skin",
  face: "skin",
  gloves: "skin",
  outfit: "outfit",
  upper: "outfit",
  lower: "outfit",
  boots: "outfit",
  hair: "hair",
  wing: "wing",
};

/** Per-part colors standing in for a texture that isn't served, see applyCharacterTextures. */
export interface CharacterModelTint {
  skin: string;
  outfit: string;
  hair: string;
  /** Kamael only -- every other rig comes out of the converter without the slot. */
  wing: string;
}

// One in-flight load per URL, kept for the session: ten rigs at ~800KB each,
// and a busy town can put dozens of characters on the same handful of them.
const loads = new Map<string, Promise<CharacterModelAsset | null>>();

export function loadCharacterModel(url: string): Promise<CharacterModelAsset | null> {
  let pending = loads.get(url);
  if (!pending) {
    pending = new GLTFLoader()
      .loadAsync(url)
      .then((gltf) => ({ scene: gltf.scene as Group, animations: gltf.animations }))
      .catch((error: unknown) => {
        // A missing or unreachable model is a normal state, not a failure:
        // no model server is configured by default, and orcs/Kamael have no
        // converted body at all. Callers fall back to the placeholder.
        console.warn(`Character model unavailable at ${url}:`, error);
        return null;
      });
    loads.set(url, pending);
  }
  return pending;
}

/**
 * Resolves to null both while loading and when the model can't be had at all,
 * so a caller can render its fallback body without a separate loading branch --
 * the real model simply swaps in once it arrives.
 */
export function useCharacterModel(url: string | undefined): CharacterModelAsset | null {
  const [asset, setAsset] = useState<CharacterModelAsset | null>(null);

  useEffect(() => {
    if (!url) {
      setAsset(null);
      return;
    }
    let current = true;
    // Through the version map first (see versionedModelUrl): the URL a body
    // is actually fetched from carries the token of the file behind it, so a
    // re-converted model is never served from a stale cache entry.
    void versionedModelUrl(url)
      .then(loadCharacterModel)
      .then((loaded) => {
        if (current) setAsset(loaded);
      });
    return () => {
      current = false;
    };
  }, [url]);

  return asset;
}

/**
 * One independent copy of a cached model: SkeletonUtils.clone rebuilds the
 * bone hierarchy and rebinds the skinned meshes to it, which a plain clone()
 * doesn't -- without it every character on screen would share one skeleton and
 * play the same animation frame.
 */
export function instantiateCharacterModel(asset: CharacterModelAsset, tint: CharacterModelTint): Group {
  const root = cloneSkinnedScene(asset.scene) as Group;

  root.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh) return;
    // Materials survive the clone by reference, so tinting one character would
    // otherwise repaint every character sharing the rig.
    const material = (mesh.material as MeshStandardMaterial).clone();
    const { part, style } = parseSlot(material.name);
    const color = tint[TINT_FOR_MATERIAL[part]];
    if (color) material.color.set(color);
    // Only the first head until something chooses otherwise: a body carries
    // every hair style it has, and drawing them together puts two haircuts on
    // one scalp. applyCharacterTextures moves this to the chosen one.
    if (part === "hair" && style !== 0) material.visible = false;
    mesh.material = material;
  });

  return root;
}
