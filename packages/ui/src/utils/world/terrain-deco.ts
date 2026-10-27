import { Matrix4, Quaternion, Vector3 } from "three";
import { STATIC_MESH_SCALE } from "../../config/world-assets";
import { l2ToThree } from "../coords";
import type { MapTerrain, MapTerrainDeco } from "./map-scene.types";
import { bitAt, type TerrainQuads } from "./terrain-geometry";

/**
 * The grass, grown the way the client grows it.
 *
 * None of this is placed in the map. A decoration layer is a recipe -- a
 * mesh, a density image and a seeded random walk -- and the client runs it
 * per terrain sector, every time, to get the same blades in the same places.
 * So this runs the same walk rather than shipping its result: 30 to 45
 * thousand blades a map would be a megabyte each and would still have to be
 * thinned by distance at the far end.
 *
 * The walk is reproduced exactly, which means the *order* of the random calls
 * matters as much as the arithmetic: every `srand` advances one shared
 * stream, so a call skipped or added anywhere shifts every blade after it.
 * See UDecoLayer.getDecodeInfo in the vendored reader, which this follows
 * line for line.
 */

/** A sector is 16x16 quads, and 16x16 sectors tile a map. */
const SECTOR_QUADS = 16;
const SECTORS_PER_SIDE = 16;

/**
 * The client's own generator: a 32-bit LCG whose top bits become the 0..1.
 *
 * `Math.imul` rather than `*` because the client's multiply wraps at 32 bits
 * and JavaScript's does not -- 196314165 * a seed near 2^31 leaves the
 * double's integer range and the stream diverges within a few draws.
 */
interface Stream {
  seed: number;
}

function srand(stream: Stream): number {
  stream.seed = (Math.imul(stream.seed, 196314165) + 907633515) | 0;
  return (stream.seed & 0x007fffff) / 0x00800000;
}

/** `max + (min - max) * rand` -- the client's order, which is not `lerp(min, max)`. */
function rangeSrand([min, max]: [number, number], stream: Stream): number {
  return max + (min - max) * srand(stream);
}

export interface DecoInstance {
  /** Local to the map's own origin, three.js space, ready for an instance matrix. */
  matrix: Matrix4;
}

export interface DecoSector {
  layer: number;
  sectorX: number;
  sectorY: number;
  /** Centre and radius in three.js units, for the distance test. */
  center: Vector3;
  radius: number;
  instances: Matrix4[];
}

/** How many sectors a map has per side, and which one a quad belongs to. */
export function decoSectorCount(): number {
  return SECTORS_PER_SIDE;
}

const position = new Vector3();
const quaternion = new Quaternion();
const scale = new Vector3();
const up = new Vector3(0, 1, 0);

/**
 * Every blade of one layer inside one terrain sector.
 *
 * Expensive enough to be worth caching and cheap enough to do on demand: a
 * sector is 256 quads and at most `maxPerQuad` attempts each, and the density
 * test rejects most of them before any work happens.
 */
export function scatterDecoSector(
  terrain: MapTerrain,
  deco: MapTerrainDeco,
  density: Uint8Array,
  heights: Uint16Array,
  quads: TerrainQuads | null,
  sectorX: number,
  sectorY: number
): Matrix4[] {
  const { origin, xAxis, yAxis, zAxis } = terrain.toWorld;
  const width = terrain.heightmap.width;
  const height = terrain.heightmap.height;

  // The stream is seeded per sector, in the sector order the client stores
  // them: row-major, offset (sx * 16, sy * 16). Every sector therefore grows
  // independently, which is what lets this run only the ones in view.
  const stream: Stream = { seed: (deco.seed + (sectorY * SECTORS_PER_SIDE + sectorX)) | 0 };
  const out: Matrix4[] = [];

  const worldOf = (hx: number, hy: number, target: Vector3): Vector3 => {
    const clampedX = Math.min(hx, width - 1);
    const clampedY = Math.min(hy, height - 1);
    const raw = heights[clampedY * width + clampedX];
    return target.set(
      (hx - origin[0]) * xAxis[0],
      (hy - origin[1]) * yAxis[1],
      (raw - origin[2]) * zAxis[2]
    );
  };

  const a = new Vector3();
  const b = new Vector3();
  const c = new Vector3();
  const dirX = new Vector3();
  const dirY = new Vector3();
  const at = new Vector3();

  const quadsX = Math.min(SECTOR_QUADS, width - 1 - sectorX * SECTOR_QUADS);
  const quadsY = Math.min(SECTOR_QUADS, height - 1 - sectorY * SECTOR_QUADS);

  for (let y = 0; y < quadsY; y++) {
    for (let x = 0; x < quadsX; x++) {
      const gx = sectorX * SECTOR_QUADS + x;
      const gy = sectorY * SECTOR_QUADS + y;

      // A quad the terrain does not draw grows nothing -- the same bitmap the
      // ground's holes come from.
      if (!deco.showOnInvisible && quads && !bitAt(quads.visibility, width, gx, gy)) continue;

      const quadDensity = density[gy * width + gx] / 255;

      for (let attempt = 0; attempt < deco.maxPerQuad; attempt++) {
        // Both draws happen whether or not the blade is placed. The client
        // evaluates the left side first, so this order is load-bearing.
        const roll = srand(stream);
        if (roll >= quadDensity * rangeSrand(deco.density, stream)) continue;

        const randX = srand(stream);
        const randY = srand(stream);

        // One of the quad's two triangles, picked by the pair -- the same
        // split the ground is drawn with, so a blade lands on the surface
        // rather than through it.
        if (randX > randY) {
          worldOf(gx + 1, gy, a);
          worldOf(gx, gy, b);
          worldOf(gx + 1, gy + 1, c);
          dirX.subVectors(b, a);
          dirY.subVectors(c, a);
          at.copy(a).addScaledVector(dirX, 1 - randX).addScaledVector(dirY, randY);
        } else {
          worldOf(gx, gy + 1, a);
          worldOf(gx, gy, b);
          worldOf(gx + 1, gy + 1, c);
          dirX.subVectors(b, a);
          dirY.subVectors(c, a);
          at.copy(a).addScaledVector(dirX, randX).addScaledVector(dirY, 1 - randY);
        }

        const scaleX = rangeSrand(deco.scale[0], stream);
        const scaleY = rangeSrand(deco.scale[1], stream);
        const scaleZ = rangeSrand(deco.scale[2], stream);
        const yaw = deco.randomYaw ? Math.floor(65535 * srand(stream)) : 0;

        // alignToTerrain is false on every layer in the client, so the blade
        // stands up rather than leaning with the slope, and the only rotation
        // left is the yaw -- see the pitch term in setDecorationMatrix, which
        // is zero for a normal of (0, 0, 1).
        // The layer's own scale is a multiplier on the mesh, and the mesh
        // arrives from umodel at a hundredth of client units -- so this needs
        // the same STATIC_MESH_SCALE every placed actor gets (see
        // actorMatrix). Without it a blade is drawn at 52.5% of its size,
        // which on the dense layer is a speck in the ground rather than grass.
        l2ToThree(at.x, at.y, at.z, position);
        quaternion.setFromAxisAngle(up, -(yaw / 65536) * Math.PI * 2);
        scale.set(
          scaleX * STATIC_MESH_SCALE,
          scaleZ * STATIC_MESH_SCALE,
          scaleY * STATIC_MESH_SCALE
        );
        out.push(new Matrix4().compose(position, quaternion, scale));
      }
    }
  }

  return out;
}
