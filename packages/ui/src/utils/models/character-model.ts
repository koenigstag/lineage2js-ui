import { useEffect, useState } from "react";
import type { AnimationClip, Group, Mesh, MeshStandardMaterial } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { clone as cloneSkinnedScene } from "three/examples/jsm/utils/SkeletonUtils.js";
import { versionedModelUrl } from "../../config/character-models";

export interface CharacterModelAsset {
  scene: Group;
  animations: AnimationClip[];
}

/**
 * Converted retail bodies are ~44 units tall in the source rig's own space
 * (see assets-server/scripts/convert-unity-models.ts); the scene wants the
 * ~1.7 three.js units the placeholder body already occupies. One factor for
 * every rig, so a dwarf stays shorter than an elf instead of every race being
 * normalized to the same height.
 */
export const CHARACTER_MODEL_SCALE = 1.7 / 44.6;

/** Per-slot colors standing in for the textures the pipeline doesn't convert yet. */
export interface CharacterModelTint {
  skin: string;
  outfit: string;
  hair: string;
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
    const color = tint[material.name as keyof CharacterModelTint];
    if (color) material.color.set(color);
    mesh.material = material;
  });

  return root;
}
