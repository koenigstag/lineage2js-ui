/**
 * Generates synthetic geodata tiles for local testing of the client's
 * tile-streaming pipeline, before any real (converted) L2J geodata exists.
 *
 * Binary layout (little-endian), mirrored in
 * packages/ui/src/utils/geodata/geo-tile-parser.ts -- keep both in sync:
 *   uint16 cellsX
 *   uint16 cellsY
 *   int16  heights[cellsX * cellsY]   -- row-major, index = y * cellsX + x
 *   uint8  nswe[cellsX * cellsY]      -- EAST=1, WEST=2, SOUTH=4, NORTH=8
 *
 * Run with `pnpm --filter @lineage2js/assets-server generate:geodata`.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Mirrors GEO_CELL_SIZE / GEO_TILE_CELLS in packages/ui/src/config/geodata.ts.
const CELL_SIZE = 16;
const TILE_CELLS = 64;

// Tile range to generate around the origin, e.g. -3..3 = a 7x7 tile field.
const TILE_RANGE = 3;

const NSWE_EAST = 1;
const NSWE_WEST = 2;
const NSWE_SOUTH = 4;
const NSWE_NORTH = 8;
const NSWE_ALL = NSWE_EAST | NSWE_WEST | NSWE_SOUTH | NSWE_NORTH;

// 0 = flat demo landscape (easier to judge movement/orientation against);
// bump back up for a rolling-hills test of the heightmap pipeline itself.
const HEIGHT_SCALE = 0;
const NOISE_FREQUENCY = 1 / 96; // cells per noise-lattice unit

function hash2(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return ((h >>> 0) % 100000) / 100000;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

function valueNoise2D(x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const sx = smooth(x - x0);
  const sy = smooth(y - y0);

  const n00 = hash2(x0, y0);
  const n10 = hash2(x0 + 1, y0);
  const n01 = hash2(x0, y0 + 1);
  const n11 = hash2(x0 + 1, y0 + 1);

  const nx0 = n00 + (n10 - n00) * sx;
  const nx1 = n01 + (n11 - n01) * sx;

  return nx0 + (nx1 - nx0) * sy;
}

/** Two octaves of value noise, combined into a single [-1, 1] signal. */
function heightAt(globalCellX: number, globalCellY: number): number {
  const base = valueNoise2D(globalCellX * NOISE_FREQUENCY, globalCellY * NOISE_FREQUENCY);
  const detail = valueNoise2D(globalCellX * NOISE_FREQUENCY * 4, globalCellY * NOISE_FREQUENCY * 4);
  return (base * 0.75 + detail * 0.25) * 2 - 1;
}

function generateTile(tileX: number, tileY: number): Buffer {
  const cellCount = TILE_CELLS * TILE_CELLS;
  const headerSize = 4;
  const heightsSize = cellCount * 2;
  const buffer = Buffer.alloc(headerSize + heightsSize + cellCount);

  buffer.writeUInt16LE(TILE_CELLS, 0);
  buffer.writeUInt16LE(TILE_CELLS, 2);

  const heights = new Int16Array(cellCount);

  for (let localY = 0; localY < TILE_CELLS; localY++) {
    for (let localX = 0; localX < TILE_CELLS; localX++) {
      const globalCellX = tileX * TILE_CELLS + localX;
      const globalCellY = tileY * TILE_CELLS + localY;
      const i = localY * TILE_CELLS + localX;

      const z = Math.round(heightAt(globalCellX, globalCellY) * HEIGHT_SCALE);
      heights[i] = z;
      buffer.writeInt16LE(z, headerSize + i * 2);
    }
  }

  // NSWE: block a direction where the height delta to that neighbor exceeds
  // a walkable-step threshold -- purely cosmetic for now (nothing consumes
  // it yet), just keeping the format honest end to end.
  const STEP_LIMIT = 60;
  for (let localY = 0; localY < TILE_CELLS; localY++) {
    for (let localX = 0; localX < TILE_CELLS; localX++) {
      const i = localY * TILE_CELLS + localX;
      const z = heights[i];
      let nswe = NSWE_ALL;

      const globalCellX = tileX * TILE_CELLS + localX;
      const globalCellY = tileY * TILE_CELLS + localY;

      const east = Math.round(heightAt(globalCellX + 1, globalCellY) * HEIGHT_SCALE);
      const west = Math.round(heightAt(globalCellX - 1, globalCellY) * HEIGHT_SCALE);
      const south = Math.round(heightAt(globalCellX, globalCellY + 1) * HEIGHT_SCALE);
      const north = Math.round(heightAt(globalCellX, globalCellY - 1) * HEIGHT_SCALE);

      if (Math.abs(east - z) > STEP_LIMIT) nswe &= ~NSWE_EAST;
      if (Math.abs(west - z) > STEP_LIMIT) nswe &= ~NSWE_WEST;
      if (Math.abs(south - z) > STEP_LIMIT) nswe &= ~NSWE_SOUTH;
      if (Math.abs(north - z) > STEP_LIMIT) nswe &= ~NSWE_NORTH;

      buffer.writeUInt8(nswe, headerSize + heightsSize + i);
    }
  }

  return buffer;
}

async function main() {
  const outDir = path.join(__dirname, "../assets/geodata");
  await fs.mkdir(outDir, { recursive: true });

  let count = 0;
  for (let tileY = -TILE_RANGE; tileY <= TILE_RANGE; tileY++) {
    for (let tileX = -TILE_RANGE; tileX <= TILE_RANGE; tileX++) {
      const buffer = generateTile(tileX, tileY);
      await fs.writeFile(path.join(outDir, `${tileX}_${tileY}.bin`), buffer);
      count++;
    }
  }

  console.log(`Wrote ${count} synthetic geodata tiles to ${outDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
