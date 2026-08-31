import { BufferGeometry, Material, Mesh, Object3D } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { getStaticMeshUrl } from "../../config/world-assets";

/**
 * One drawable part of a static mesh: a geometry and the material it is drawn
 * with. A mesh with several materials (a tree's bark and its leaves) comes back
 * as several parts, since an InstancedMesh draws exactly one pair.
 */
export interface StaticMeshPart {
  geometry: BufferGeometry;
  material: Material;
}

const loader = new GLTFLoader();

/**
 * Meshes are shared across every actor that places them and across maps --
 * one map's 797 actors resolve to 131 meshes, and neighbouring maps reuse the
 * same packages -- so they are cached by name for the session rather than per
 * placement. `null` marks a mesh that could not be loaded, so a missing file
 * is not retried on every render.
 */
const cache = new Map<string, StaticMeshPart[] | null>();
const inFlight = new Map<string, Promise<StaticMeshPart[] | null>>();

export function getCachedStaticMesh(name: string): StaticMeshPart[] | null | undefined {
  return cache.get(name);
}

/** Loads a mesh once; concurrent callers share the same request. */
export function loadStaticMesh(name: string): Promise<StaticMeshPart[] | null> {
  const cached = cache.get(name);
  if (cached !== undefined) return Promise.resolve(cached);

  const pending = inFlight.get(name);
  if (pending) return pending;

  const url = getStaticMeshUrl(name);
  if (!url) {
    cache.set(name, null);
    return Promise.resolve(null);
  }

  const request = loader
    .loadAsync(url)
    .then((gltf) => {
      const parts = collectParts(gltf.scene);
      cache.set(name, parts.length > 0 ? parts : null);
      return cache.get(name)!;
    })
    .catch(() => {
      cache.set(name, null);
      return null;
    })
    .finally(() => {
      inFlight.delete(name);
    });

  inFlight.set(name, request);
  return request;
}

/**
 * Flattens a loaded glTF into geometry/material pairs in the file's own root
 * space.
 *
 * umodel writes one node per mesh with the primitives split by material, so in
 * practice the transform is the identity -- but baking whatever transform is
 * there into the geometry means the instance matrix is the only transform an
 * InstancedMesh has to carry, which is what makes the placement arithmetic
 * readable.
 */
function collectParts(root: Object3D): StaticMeshPart[] {
  const parts: StaticMeshPart[] = [];

  root.updateMatrixWorld(true);
  root.traverse((child) => {
    if (!(child instanceof Mesh)) return;

    const materials = Array.isArray(child.material) ? child.material : [child.material];
    const geometry = child.geometry.clone();
    if (!child.matrixWorld.equals(root.matrix)) {
      geometry.applyMatrix4(child.matrixWorld);
    }

    // A multi-material mesh keeps its groups; each group is its own draw with
    // its own material, so it becomes its own instanced part.
    if (materials.length > 1 && geometry.groups.length > 0) {
      for (const group of geometry.groups) {
        const slice = geometry.clone();
        slice.clearGroups();
        slice.setDrawRange(group.start, group.count);
        parts.push({ geometry: slice, material: materials[group.materialIndex ?? 0] });
      }
      geometry.dispose();
      return;
    }

    parts.push({ geometry, material: materials[0] });
  });

  return parts;
}
