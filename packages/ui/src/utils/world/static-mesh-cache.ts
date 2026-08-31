import { BufferGeometry, Material, Mesh, MeshStandardMaterial, Object3D, SRGBColorSpace, WebGLRenderer } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { getMeshTableUrl, getStaticMeshTextureUrl, getStaticMeshUrl } from "../../config/world-assets";

/**
 * One drawable part of a static mesh: a geometry and the material it is drawn
 * with. A mesh with several materials (a tree's bark and its leaves) comes back
 * as several parts, since an InstancedMesh draws exactly one pair.
 */
export interface StaticMeshPart {
  geometry: BufferGeometry;
  material: Material;
  /** Which of the mesh's material slots this part belongs to. */
  slot: number;
}

const loader = new GLTFLoader();

/**
 * KTX2 keeps a texture block-compressed all the way onto the GPU, which is the
 * reason it was chosen over PNG or WebP: at fifteen thousand instances the
 * video memory a decompressed RGBA atlas would take matters as much as the
 * download. Transcoding to whatever format the GPU actually speaks needs
 * three's Basis transcoder, served at /basis/ (see vite.config.ts).
 */
const textureLoader = new KTX2Loader().setTranscoderPath(`${import.meta.env.BASE_URL}basis/`);

/**
 * KTX2Loader has to know the GPU's capabilities before it can pick a
 * transcode target, and it learns them from the renderer. Called once the
 * canvas exists -- until then no texture request is started.
 */
export function initStaticMeshTextures(renderer: WebGLRenderer): void {
  textureLoader.detectSupport(renderer);
}

/** The same loader, for the terrain's layer textures -- they are KTX2 too. */
export function ktx2Loader(): KTX2Loader {
  return textureLoader;
}

/**
 * Meshes are shared across every actor that places them and across maps --
 * one map's 797 actors resolve to 131 meshes, and neighbouring maps reuse the
 * same packages -- so they are cached by name for the session rather than per
 * placement. `null` marks a mesh that could not be loaded, so a missing file
 * is not retried on every render.
 */
const cache = new Map<string, StaticMeshPart[] | null>();
const inFlight = new Map<string, Promise<StaticMeshPart[] | null>>();

/** What the converter knows about a mesh that its glTF does not carry. */
export interface MeshInfo {
  /** Per material slot, the qualified texture it wears. */
  textures: (string | null)[];
  /** The client's own simplified versions, nearest first. Only trees have them. */
  lods?: string[];
  /** Bounding radius in client units. */
  radius: number;
}

let tableRequest: Promise<Record<string, MeshInfo>> | undefined;

/** The whole table, fetched once. */
export function meshTable(): Promise<Record<string, MeshInfo>> {
  tableRequest ??= (async () => {
    const url = getMeshTableUrl();
    if (!url) return {};
    try {
      const response = await fetch(url);
      return response.ok ? ((await response.json()) as Record<string, MeshInfo>) : {};
    } catch {
      return {};
    }
  })();
  return tableRequest;
}

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
    .then(async (gltf) => {
      const parts = collectParts(gltf.scene);
      cache.set(name, parts.length > 0 ? parts : null);
      // Textures land after the geometry is already on screen. Doing it the
      // other way round would hold every mesh back for its images, and an
      // untextured mesh in the right place reads far better than nothing.
      if (parts.length > 0) void applyTextures(name, parts);
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

const textures = new Map<string, Promise<unknown>>();

async function applyTextures(meshName: string, parts: StaticMeshPart[]): Promise<void> {
  const slots = (await meshTable())[meshName]?.textures;
  if (!slots) return;

  for (const part of parts) {
    const textureName = slots[part.slot];
    const url = textureName ? getStaticMeshTextureUrl(textureName) : undefined;
    if (!url) continue;

    let request = textures.get(url);
    if (!request) {
      request = textureLoader.loadAsync(url).catch(() => null);
      textures.set(url, request);
    }

    const texture = (await request) as { colorSpace?: string } | null;
    if (!texture) continue;

    texture.colorSpace = SRGBColorSpace;
    const material = part.material as MeshStandardMaterial;
    material.map = texture as never;
    // umodel writes a flat placeholder colour into every material it exports;
    // left in place it would tint the real texture.
    material.color?.setRGB(1, 1, 1);
    material.needsUpdate = true;
  }
}

/**
 * Flattens a loaded glTF into geometry/material pairs in the file's own root
 * space, keeping each one's material slot.
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
        const slot = group.materialIndex ?? 0;
        const slice = geometry.clone();
        slice.clearGroups();
        slice.setDrawRange(group.start, group.count);
        parts.push({ geometry: slice, material: materials[slot], slot });
      }
      geometry.dispose();
      return;
    }

    parts.push({ geometry, material: materials[0], slot: parts.length });
  });

  return parts;
}
