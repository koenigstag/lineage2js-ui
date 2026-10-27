import {
  AdditiveBlending,
  BufferGeometry,
  ClampToEdgeWrapping,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  RepeatWrapping,
  SRGBColorSpace,
  Texture,
  WebGLRenderer,
} from "three";
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

/**
 * How the client blends one material slot, as `convert:maps` reads it off the
 * slot's `Shader`.
 *
 * Absent for a slot means the client wrapped it in nothing at all -- a bare
 * texture, drawn opaque. That is bark, stone and masonry; foliage, glass and
 * water all arrive with one of these.
 */
export interface SlotBlend {
  mode: "normal" | "masked" | "modulate" | "translucent" | "invisible" | "brighten" | "darken";
  /** `Shader.AlphaRef`, 0..1. */
  alphaRef: number;
  /** Whether the Shader carries an Opacity -- see applyBlend, it decides as much as the mode. */
  opacity: boolean;
}

/** What the converter knows about a mesh that its glTF does not carry. */
export interface MeshInfo {
  /** Per material slot, the qualified texture it wears. */
  textures: (string | null)[];
  /** Per material slot, how the client blends it. Absent when every slot is opaque. */
  blends?: (SlotBlend | null)[];
  /**
   * Per material slot, `[clampU, clampV]` from the texture's own clamp mode --
   * present only for the slots that do not tile. See applyTextures: that is 13
   * slots in the whole client, and three's own default is the other way round.
   */
  clamps?: ([boolean, boolean] | null)[];
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

/**
 * Turns the client's own description of a slot into three's material flags.
 *
 * The rule is the engine's, quoted in the vendored reader beside its blend
 * switch:
 *
 *   if (OutputBlending == OB_Normal && !Opacity) glDisable(GL_BLEND);
 *   else                                         glEnable(GL_BLEND);
 *
 * which is why a tree's bark stays solid while its leaves do not -- both are
 * `OB_Normal`, and only the leaves carry an Opacity. Reading the mode alone
 * would leave 3123 opaque slots blended and every leaf still a card.
 * `OB_Masked` additionally discards fully transparent texels
 * (`glAlphaFunc(GL_GREATER, 0)`).
 */
function applyBlend(material: MeshBasicMaterial, blend: SlotBlend | null | undefined): void {
  // No Shader at all, or OB_Normal without an Opacity: the engine turns
  // blending off, so leave the material exactly as the glTF built it.
  if (!blend || (blend.mode === "normal" && !blend.opacity)) return;

  if (blend.mode === "invisible") {
    material.visible = false;
    return;
  }

  material.transparent = true;

  if (blend.mode === "brighten") {
    material.blending = AdditiveBlending;
    material.depthWrite = false;
  } else if (blend.mode === "translucent") {
    material.depthWrite = false;
  } else {
    // A blended surface must not write depth. Writing it means the first leaf
    // card drawn blends its soft edge with whatever happens to be in the
    // buffer -- the sky -- and then occludes the card behind it, so that edge
    // keeps the sky's colour instead of the leaves it is actually in front
    // of. Opaque geometry is already drawn by then, so trunks and ground
    // still show through the fringe correctly; what is given up is the order
    // of leaves against each other inside one tree, which is a far quieter
    // error than a sky-coloured halo around every branch.
    material.depthWrite = false;
  }

  // Discard what the texture says is nothing at all, which is most of it:
  // measured on the client's own leaf textures, 72% of texels are alpha 0 and
  // 15% are alpha 1, but the 13% in between is a real authored edge the
  // client blends -- so this cuts at the bottom and leaves that edge alone
  // rather than hardening it into a stencil.
  const ref = Math.max(blend.alphaRef, 1 / 255);
  material.alphaTest = ref;

  // transparent and alphaTest both change which shader three compiles, and a
  // part without a texture never reaches the needsUpdate below.
  material.needsUpdate = true;
}

async function applyTextures(meshName: string, parts: StaticMeshPart[]): Promise<void> {
  const info = (await meshTable())[meshName];
  const slots = info?.textures;
  if (!slots) return;

  for (const part of parts) {
    applyBlend(part.material as MeshBasicMaterial, info?.blends?.[part.slot]);
    const textureName = slots[part.slot];
    const url = textureName ? getStaticMeshTextureUrl(textureName) : undefined;
    if (!url) continue;

    let request = textures.get(url);
    if (!request) {
      request = textureLoader.loadAsync(url).catch(() => null);
      textures.set(url, request);
    }

    const texture = (await request) as Texture | null;
    if (!texture) continue;

    texture.colorSpace = SRGBColorSpace;

    // Unreal tiles a texture unless its UClampMode/VClampMode says otherwise,
    // and three's Texture defaults to the opposite -- which smears the last
    // column of a bark texture down the whole trunk, and does the same to
    // every wall and floor. Measured over the client: 13 slots of 55183
    // actually clamp, so tiling is the default here and the table carries
    // only the exceptions. The texture object is shared between the materials
    // that use it, which is fine while the client agrees with itself about
    // how a given texture is addressed.
    const clamp = info?.clamps?.[part.slot];
    texture.wrapS = clamp?.[0] ? ClampToEdgeWrapping : RepeatWrapping;
    texture.wrapT = clamp?.[1] ? ClampToEdgeWrapping : RepeatWrapping;
    const material = part.material as MeshBasicMaterial;
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
/**
 * The glTF's PBR material as the client would draw it: a texture multiplied by
 * a light, and nothing else.
 *
 * The client has no surface model for a static mesh. Its shader is
 * `reflectedLight.indirectDiffuse += vLitColor * 2.0` over the texture -- no
 * normal, no roughness, no diffuse term, because the editor's bake and the
 * environment curves already say how bright every mesh is. Leaving these as
 * `MeshStandardMaterial` meant the scene's lights decided instead, which is
 * why the sun had to be faked as a directional light to stop every trunk
 * reading as a cut-out.
 *
 * Unlit, the per-actor light goes in as the instance colour, which three
 * multiplies into exactly this spot -- see meshLightFor. It is also a good
 * deal cheaper across fifteen thousand instances.
 */
function toUnlit(source: Material): Material {
  const from = source as MeshStandardMaterial;
  const material = new MeshBasicMaterial({
    map: from.map,
    color: from.color,
    transparent: from.transparent,
    opacity: from.opacity,
    alphaTest: from.alphaTest,
    side: from.side,
    depthWrite: from.depthWrite,
    blending: from.blending,
    toneMapped: from.toneMapped,
    // Left as the glTF had it -- which is off, since umodel exports no
    // COLOR_0. An instance colour does not need it: three's *fragment* prefix
    // defines USE_COLOR from `vertexColors || instancingColor`, even though
    // the vertex prefix defines it from `vertexColors` alone, so the varying
    // is declared on both sides and setColorAt lands. Turning it on here
    // without also giving every geometry a colour attribute would paint the
    // world black, an unbound attribute reading as (0,0,0,1).
    vertexColors: from.vertexColors,
  });
  material.name = from.name;
  return material;
}

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
        parts.push({ geometry: slice, material: toUnlit(materials[slot]), slot });
      }
      geometry.dispose();
      return;
    }

    parts.push({ geometry, material: toUnlit(materials[0]), slot: parts.length });
  });

  return parts;
}
