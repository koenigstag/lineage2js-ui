// The baked world: per-map terrain metadata and static mesh placement, and the
// mesh geometry those placements point at. Both are produced offline by
// packages/assets-server/scripts/convert-maps.ts -- see that package's README
// for what a map file contains and how it lines up with the geodata.
//
// The two live behind separate env vars on purpose. The scene files are ~40MB
// for the whole world; the geometry is gigabytes. Serving the first without
// the second is a useful state -- placement can be checked, and every mesh
// simply doesn't draw.
import { GEO_REGION_SIZE, GEO_REGION_ZERO_X, GEO_REGION_ZERO_Y } from "./geodata";
import { L2_TO_THREE_SCALE } from "../utils/coords";

const WORLD_MAP_BASE_URL = import.meta.env.VITE_WORLD_MAP_BASE_URL;
const STATIC_MESH_BASE_URL = import.meta.env.VITE_STATIC_MESH_BASE_URL;
const STATIC_MESH_TEXTURE_BASE_URL = import.meta.env.VITE_STATIC_MESH_TEXTURE_BASE_URL;

/** One `.unr` map covers exactly one geodata region -- see the assets-server README. */
export const MAP_SIZE = GEO_REGION_SIZE;

/**
 * umodel writes glTF at a hundredth of the client's own units, and unlike the
 * character rigs (whose converter multiplies it back out, see UNIT_SCALE in
 * convert-client-rigs.ts) nothing post-processes these files -- so the factor
 * has to be applied when the mesh is placed.
 */
export const STATIC_MESH_SCALE = 100 * L2_TO_THREE_SCALE;

/**
 * How far a terrain chunk is built and drawn from, on top of its own radius.
 *
 * Lives here rather than in TerrainField because the fog has to agree with it:
 * fog that clears before the ground ends shows the edge of the world, and fog
 * that closes in sooner than it needs to throws away ground already paid for.
 */
export const TERRAIN_DRAW_DISTANCE = 260;

/**
 * How far the drawn ground sits below the geodata's walkable plane, in L2
 * units.
 *
 * Measured rather than assumed: sampling 20_18's heightmap against this
 * project's own baked geodata puts the terrain 31-33 units under it, tightly
 * (p10 -37.6, p90 -26.4) -- see packages/assets-server/README.md. The two
 * describe different surfaces and both are right; they simply do not coincide.
 *
 * Everything the server places -- players, mobs, dropped items -- stands on
 * the walkable plane, so drawing it at the Z the server gave leaves it
 * hovering once real terrain is underneath.
 */
export const TERRAIN_BELOW_GEODATA = 32;

/** Which map a world position falls in. Same arithmetic as worldToRegionCoords. */
export function worldToMapCoords(worldX: number, worldY: number): [number, number] {
  return [Math.floor(worldX / MAP_SIZE) + GEO_REGION_ZERO_X, Math.floor(worldY / MAP_SIZE) + GEO_REGION_ZERO_Y];
}

export function mapKey(mapX: number, mapY: number): string {
  return `${mapX}_${mapY}`;
}

export function getMapSceneUrl(mapX: number, mapY: number): string | undefined {
  if (!WORLD_MAP_BASE_URL) return undefined;
  return `${withSlash(WORLD_MAP_BASE_URL)}${mapKey(mapX, mapY)}/scene.json`;
}

export function getMapHeightmapUrl(mapX: number, mapY: number): string | undefined {
  if (!WORLD_MAP_BASE_URL) return undefined;
  return `${withSlash(WORLD_MAP_BASE_URL)}${mapKey(mapX, mapY)}/heightmap.bin`;
}

/** Per-quad visibility and edge-turn bits, concatenated. See parseTerrainQuads. */
export function getMapQuadsUrl(mapX: number, mapY: number): string | undefined {
  if (!WORLD_MAP_BASE_URL) return undefined;
  return `${withSlash(WORLD_MAP_BASE_URL)}${mapKey(mapX, mapY)}/quads.bin`;
}

/**
 * A file the map's own scene names, beside its scene.json -- a baked
 * sun-intensity plane, a decoration layer's density image.
 *
 * Both travel as greyscale PNGs rather than raw buffers: the width and height
 * come with the file instead of having to be agreed separately, and deflate
 * takes 64kB down to ten or forty depending on how smooth the map is. See
 * MapTerrain.shadow and MapTerrainDeco.
 */
export function getMapAssetUrl(mapX: number, mapY: number, file: string): string | undefined {
  if (!WORLD_MAP_BASE_URL) return undefined;
  return `${withSlash(WORLD_MAP_BASE_URL)}${mapKey(mapX, mapY)}/${file}`;
}

/**
 * The world's lighting curves -- one file for the whole client, beside the
 * maps rather than inside any of them. See WorldEnv.
 */
export function getWorldEnvUrl(): string | undefined {
  if (!WORLD_MAP_BASE_URL) return undefined;
  return `${withSlash(WORLD_MAP_BASE_URL)}env.json`;
}

/**
 * A scene file names a mesh the way its package does -- `Package.Group.Name`,
 * e.g. `Oren_tree_S.DarkElf.Oren_Darkelf_tree09`. umodel lays its exports out
 * by *class* rather than group, so the group is dropped and the file is
 * `Oren_tree_S/StaticMesh/Oren_Darkelf_tree09.gltf`. Object names are unique
 * within a package (they have to be, or umodel would overwrite its own
 * output), so nothing is lost by dropping the middle.
 */
export function getStaticMeshUrl(qualifiedName: string): string | undefined {
  if (!STATIC_MESH_BASE_URL) return undefined;
  const parts = qualifiedName.split(".");
  if (parts.length < 2) return undefined;
  const pkg = parts[0];
  const name = parts[parts.length - 1];
  return `${withSlash(STATIC_MESH_BASE_URL)}${pkg}/StaticMesh/${name}.gltf`;
}

/**
 * The per-mesh table `convert:maps` writes beside the geometry: which texture
 * each material slot wears, the client's own LOD chain, and the mesh's size.
 *
 * None of it can be read off the glTF. umodel puts no images in the files it
 * exports -- a material there is a name and a placeholder colour -- and it
 * knows nothing of LODs at all; both come out of the package by the converter.
 * Fetched once and shared; very repetitive JSON, and it compresses to about 7%
 * of itself.
 */
export function getMeshTableUrl(): string | undefined {
  if (!STATIC_MESH_BASE_URL) return undefined;
  return `${withSlash(STATIC_MESH_BASE_URL)}meshes.json`;
}

/** KTX2 for a qualified texture name, e.g. "Oren_tree_T.DarkElf.Oren_Darkelf_bark004". */
export function getStaticMeshTextureUrl(qualifiedName: string): string | undefined {
  if (!STATIC_MESH_TEXTURE_BASE_URL) return undefined;
  const parts = qualifiedName.split(".");
  if (parts.length < 2) return undefined;
  return `${withSlash(STATIC_MESH_TEXTURE_BASE_URL)}${parts[0]}/${parts[parts.length - 1]}.ktx2`;
}

function withSlash(base: string): string {
  return base.endsWith("/") ? base : `${base}/`;
}
