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

/** One `.unr` map covers exactly one geodata region -- see the assets-server README. */
export const MAP_SIZE = GEO_REGION_SIZE;

/**
 * umodel writes glTF at a hundredth of the client's own units, and unlike the
 * character rigs (whose converter multiplies it back out, see UNIT_SCALE in
 * convert-client-rigs.ts) nothing post-processes these files -- so the factor
 * has to be applied when the mesh is placed.
 */
export const STATIC_MESH_SCALE = 100 * L2_TO_THREE_SCALE;

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

function withSlash(base: string): string {
  return base.endsWith("/") ? base : `${base}/`;
}
