import { BufferAttribute, BufferGeometry, Vector3 } from "three";
import { l2ToThree } from "../coords";
import type { MapTerrain } from "./map-scene.types";

/**
 * Quads per side of one terrain chunk.
 *
 * The client's own unit is the TerrainSector, 16 quads a side -- 256 of them
 * per map. That is the right granularity for its renderer and far too fine for
 * ours: 16 quads is 2048 world units, so a view would hold a couple of hundred
 * sectors and spend a draw call on each. 64 quads is 8192 world units, sixteen
 * chunks to a map, and the same view holds a few dozen.
 */
export const TERRAIN_CHUNK_QUADS = 64;

export interface TerrainChunk {
  geometry: BufferGeometry;
  /** Chunk index within the map. */
  chunkX: number;
  chunkY: number;
  /** Centre in three.js space, for distance tests. */
  center: Vector3;
  /** Half the diagonal, so a distance test can account for the chunk's own size. */
  radius: number;
}

/**
 * The heightmaps of the maps one step along +x and +y, and of the one
 * diagonally between them.
 *
 * A map's samples tile the world without overlapping: 20_18's last sample sits
 * at world 32640 and 21_18's first at 32768, exactly one quad apart. That quad
 * belongs to neither map's own grid, so a map drawn from its own 256 samples
 * stops 128 units short of its neighbour and leaves a strip of nothing along
 * every border -- 2.4 three-units, taller than the character standing beside
 * it, and crossing right under the camera at a map corner.
 *
 * The client draws that row from the neighbour's edge, and its own data says
 * so: the per-quad bitmaps are 256x256 against the 255x255 quads one map's
 * samples can span, and every bit of that extra row and column is set.
 */
export interface TerrainNeighbours {
  /** The map at +x; its column 0 is this map's column `width`. */
  nextX: TerrainNeighbourField | null;
  /** The map at +y; its row 0 is this map's row `height`. */
  nextY: TerrainNeighbourField | null;
  /** The map diagonally at +x +y, for the single corner sample. */
  nextXY: TerrainNeighbourField | null;
}

/**
 * A neighbour's heightmap and the Z origin its raw values are measured from.
 *
 * The origin is not decoration. Each map's `toWorld` carries its own
 * `origin.z` -- the terrain actor's height, folded in by Unreal -- and they
 * differ: 20_18's is 32225.86 against 21_18's 32323.54. Reading a neighbour's
 * raw sample and subtracting *our* origin puts that vertex 29 units off the
 * same point as the neighbour draws it, which is a one-quad ledge along the
 * border -- a smaller, sharper version of the gap this stitch exists to close.
 * So the sample is carried into this map's frame first.
 */
export interface TerrainNeighbourField {
  heights: Uint16Array;
  /** That map's own `toWorld.origin.z`. */
  originZ: number;
}

/**
 * The client's two per-quad bitmaps, as `convert:maps` writes them: visibility
 * first, then edge turn, one bit per quad at `x + y * width`, least significant
 * bit first.
 *
 * Visibility is what makes a hole a hole -- a cave mouth is a quad the terrain
 * does not draw, and without it the world is sealed shut. Edge turn says which
 * diagonal a quad splits along, which is the difference between a ridge and a
 * hollow on the same four corners.
 */
export interface TerrainQuads {
  visibility: Uint8Array;
  edgeTurn: Uint8Array;
}

export function parseTerrainQuads(buffer: ArrayBuffer, width: number, height: number): TerrainQuads | null {
  const half = Math.ceil((width * height) / 8);
  if (buffer.byteLength < half * 2) return null;
  return {
    visibility: new Uint8Array(buffer, 0, half),
    edgeTurn: new Uint8Array(buffer, half, half),
  };
}

/** One bit of a per-quad bitmap, least significant bit first. Shared with the deco scatter. */
export function bitAt(bits: Uint8Array, width: number, x: number, y: number): boolean {
  const index = x + y * width;
  return (bits[index >> 3] & (1 << (index & 7))) !== 0;
}

/**
 * Builds one chunk of a map's terrain surface.
 *
 * Heights come straight from the client's G16 heightmap, and the transform
 * that turns a sample into a world position is the map's own `toWorld` --
 * Unreal's `TransformPointBy` subtracts the origin before projecting onto the
 * axes, and the result is already in absolute world coordinates (verified
 * across neighbouring maps: 21_18's origin.x of -256 is exactly its map's
 * 32768-unit offset).
 *
 * Vertices are shared inside a chunk and duplicated on its border, which costs
 * one row and column per chunk and keeps the normals continuous within it.
 * Seams between chunks are hidden by the normals being computed from the
 * heightmap rather than from the triangles, so neighbouring chunks agree along
 * their shared edge.
 */
export function buildTerrainChunk(
  terrain: MapTerrain,
  heights: Uint16Array,
  chunkX: number,
  chunkY: number,
  quads?: TerrainQuads | null,
  neighbours?: TerrainNeighbours | null
): TerrainChunk {
  const { width, height } = terrain.heightmap;
  const { origin, xAxis, yAxis, zAxis } = terrain.toWorld;

  // One sample past this map's own last is the next map's first -- the same
  // world position, since the two grids are exactly `width` samples apart. With
  // that map loaded this one reaches it; without, it stops where it always did
  // and the strip stays open until it arrives. See TerrainNeighbours.
  const maxX = neighbours?.nextX ? width : width - 1;
  const maxY = neighbours?.nextY ? height : height - 1;

  // A neighbour's raw samples are measured from its own origin, so they are
  // carried into this map's frame before anything divides or subtracts.
  // See TerrainNeighbourField.
  const inOurFrame = (field: TerrainNeighbourField, raw: number): number => raw - field.originZ + origin[2];

  /** A heightmap sample. TEXF_G16: unsigned 16-bit, little-endian, row-major. */
  const sample = (x: number, y: number): number => {
    const sx = x < 0 ? 0 : x > maxX ? maxX : x;
    const sy = y < 0 ? 0 : y > maxY ? maxY : y;
    if (sx < width) {
      if (sy < height) return heights[sy * width + sx];
      const next = neighbours!.nextY!;
      return inOurFrame(next, next.heights[sx]);
    }
    if (sy < height) {
      const next = neighbours!.nextX!;
      return inOurFrame(next, next.heights[sy * width]);
    }
    // The far corner is the one sample that needs the diagonal map. Until it
    // loads, the nearest edge sample keeps that vertex in the right
    // neighbourhood; the chunk is rebuilt when the map arrives.
    const corner = neighbours?.nextXY;
    if (corner) return inOurFrame(corner, corner.heights[0]);
    const next = neighbours!.nextX!;
    return inOurFrame(next, next.heights[(height - 1) * width]);
  };

  const startX = chunkX * TERRAIN_CHUNK_QUADS;
  const startY = chunkY * TERRAIN_CHUNK_QUADS;
  const quadsX = Math.min(TERRAIN_CHUNK_QUADS, maxX - startX);
  const quadsY = Math.min(TERRAIN_CHUNK_QUADS, maxY - startY);
  const cols = quadsX + 1;
  const rows = quadsY + 1;

  const positions = new Float32Array(cols * rows * 3);
  const normals = new Float32Array(cols * rows * 3);
  // World XY per vertex: the layer shader needs it to place every layer's
  // texture, and recovering it from the position would mean undoing the
  // three.js axis mapping in the shader.
  const worldXY = new Float32Array(cols * rows * 2);

  const scratch = new Vector3();
  const min = new Vector3(Infinity, Infinity, Infinity);
  const max = new Vector3(-Infinity, -Infinity, -Infinity);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const hx = startX + col;
      const hy = startY + row;
      const h = sample(hx, hy);

      const worldX = (hx - origin[0]) * xAxis[0];
      const worldY = (hy - origin[1]) * yAxis[1];
      const worldZ = (h - origin[2]) * zAxis[2];

      l2ToThree(worldX, worldY, worldZ, scratch);
      const i = row * cols + col;
      positions[i * 3] = scratch.x;
      positions[i * 3 + 1] = scratch.y;
      positions[i * 3 + 2] = scratch.z;
      worldXY[i * 2] = worldX;
      worldXY[i * 2 + 1] = worldY;
      min.min(scratch);
      max.max(scratch);

      // Central differences over the heightmap, not over the triangles: a
      // neighbouring chunk computes the same value on the shared edge, so the
      // lighting has no seam even though the vertices are duplicated.
      const dzdx = (sample(hx + 1, hy) - sample(hx - 1, hy)) * zAxis[2];
      const dzdy = (sample(hx, hy + 1) - sample(hx, hy - 1)) * zAxis[2];
      const spanX = 2 * xAxis[0];
      const spanY = 2 * yAxis[1];

      // Normal of the surface z = f(x, y) in L2 space, then through the same
      // axis mapping as the positions.
      l2ToThree(-dzdx / spanX, -dzdy / spanY, 1, scratch);
      scratch.normalize();
      normals[i * 3] = scratch.x;
      normals[i * 3 + 1] = scratch.y;
      normals[i * 3 + 2] = scratch.z;
    }
  }

  const indices = new Uint32Array(quadsX * quadsY * 6);
  let at = 0;
  for (let row = 0; row < quadsY; row++) {
    for (let col = 0; col < quadsX; col++) {
      const hx = startX + col;
      const hy = startY + row;
      // A quad the client marks invisible is a hole -- the mouth of a cave,
      // the shaft under a trapdoor. Drawing it seals the world over.
      if (quads && !bitAt(quads.visibility, width, hx, hy)) continue;

      const a = row * cols + col;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;

      // Which diagonal the quad splits along. The client stores it per quad
      // because on the same four corners one choice gives a ridge and the
      // other a hollow.
      if (quads && bitAt(quads.edgeTurn, width, hx, hy)) {
        indices[at++] = a;
        indices[at++] = c;
        indices[at++] = b;
        indices[at++] = c;
        indices[at++] = d;
        indices[at++] = b;
      } else {
        indices[at++] = a;
        indices[at++] = c;
        indices[at++] = d;
        indices[at++] = a;
        indices[at++] = d;
        indices[at++] = b;
      }
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new BufferAttribute(normals, 3));
  geometry.setAttribute("worldXY", new BufferAttribute(worldXY, 2));
  geometry.setIndex(new BufferAttribute(indices.subarray(0, at), 1));
  geometry.computeBoundingSphere();

  const center = min.clone().add(max).multiplyScalar(0.5);
  return { geometry, chunkX, chunkY, center, radius: min.distanceTo(max) / 2 };
}

/** How many chunks a map's heightmap divides into, per side. */
export function terrainChunkCount(terrain: MapTerrain): number {
  return Math.ceil((terrain.heightmap.width - 1) / TERRAIN_CHUNK_QUADS);
}
