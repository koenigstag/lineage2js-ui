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

/** A heightmap sample. TEXF_G16: unsigned 16-bit, little-endian, row-major. */
function heightAt(heights: Uint16Array, width: number, height: number, x: number, y: number): number {
  return heights[Math.min(height - 1, y) * width + Math.min(width - 1, x)];
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
  chunkY: number
): TerrainChunk {
  const { width, height } = terrain.heightmap;
  const { origin, xAxis, yAxis, zAxis } = terrain.toWorld;

  const startX = chunkX * TERRAIN_CHUNK_QUADS;
  const startY = chunkY * TERRAIN_CHUNK_QUADS;
  const quadsX = Math.min(TERRAIN_CHUNK_QUADS, width - 1 - startX);
  const quadsY = Math.min(TERRAIN_CHUNK_QUADS, height - 1 - startY);
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
      const h = heightAt(heights, width, height, hx, hy);

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
      const dzdx = (heightAt(heights, width, height, hx + 1, hy) - heightAt(heights, width, height, Math.max(0, hx - 1), hy)) * zAxis[2];
      const dzdy = (heightAt(heights, width, height, hx, hy + 1) - heightAt(heights, width, height, hx, Math.max(0, hy - 1))) * zAxis[2];
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
      const a = row * cols + col;
      const b = a + 1;
      const c = a + cols;
      const d = c + 1;
      indices[at++] = a;
      indices[at++] = c;
      indices[at++] = b;
      indices[at++] = b;
      indices[at++] = c;
      indices[at++] = d;
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new BufferAttribute(normals, 3));
  geometry.setAttribute("worldXY", new BufferAttribute(worldXY, 2));
  geometry.setIndex(new BufferAttribute(indices, 1));
  geometry.computeBoundingSphere();

  const center = min.clone().add(max).multiplyScalar(0.5);
  return { geometry, chunkX, chunkY, center, radius: min.distanceTo(max) / 2 };
}

/** How many chunks a map's heightmap divides into, per side. */
export function terrainChunkCount(terrain: MapTerrain): number {
  return Math.ceil((terrain.heightmap.width - 1) / TERRAIN_CHUNK_QUADS);
}
