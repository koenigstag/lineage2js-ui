/**
 * Converts real L2J geodata region files (assets/highfive/geodata/*.l2j,
 * https://bitbucket.org/l2jgeo/l2j_geodata) into this project's pre-baked
 * tile format (assets/highfive/geodata-tiles/{tileX}_{tileY}.bin), so the
 * client never has to decode a whole 6-8MB region + rebuild CSR multilayer
 * data itself on every load -- it just fetches a small tile file and
 * deserializes it directly (geo-tile-parser.ts). Run once whenever the
 * source .l2j files change, not per-request.
 *
 * Real geodata is derived from the copyrighted L2 client and must never be
 * committed -- both the source .l2j files and the generated tiles live
 * under assets/, covered by its blanket .gitignore (real files never
 * committed, same policy as the real icon assets).
 *
 * Run with `pnpm --filter @lineage2js/assets-server convert:geodata`.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GEO_REGION_CELLS, readL2jRegion } from "./geodata/l2j-region-reader";
import { GEO_TILE_CELLS, writeGeoTile } from "./geodata/tile-format";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Mirrors packages/ui/src/config/geodata.ts.
const GEO_CELL_SIZE = 16;
const GEO_REGION_ZERO_TILE_X = 20;
const GEO_REGION_ZERO_TILE_Y = 18;
const TILES_PER_REGION_SIDE = GEO_REGION_CELLS / GEO_TILE_CELLS; // 32

const SOURCE_DIR = path.join(__dirname, "../assets/highfive/geodata");
const OUT_DIR = path.join(__dirname, "../assets/highfive/geodata-tiles");

const REGION_FILE_PATTERN = /^(-?\d+)_(-?\d+)\.l2j$/i;

async function convertRegionFile(filePath: string, rawRegionX: number, rawRegionY: number): Promise<number> {
  const buffer = await fs.readFile(filePath);
  const region = readL2jRegion(buffer);

  // rawRegionX/Y are the L2J file's own raw map-tile numbers; the client's
  // tiles are 0-centered on world origin -- convert into that same frame
  // before taking the local tile offset (inverse of use-geo-tiles.ts's own
  // tileToRegionCoords formula).
  const tileBaseX = (rawRegionX - GEO_REGION_ZERO_TILE_X) * TILES_PER_REGION_SIDE;
  const tileBaseY = (rawRegionY - GEO_REGION_ZERO_TILE_Y) * TILES_PER_REGION_SIDE;

  let count = 0;
  for (let tileLocalY = 0; tileLocalY < TILES_PER_REGION_SIDE; tileLocalY++) {
    for (let tileLocalX = 0; tileLocalX < TILES_PER_REGION_SIDE; tileLocalX++) {
      const cellOffsetX = tileLocalX * GEO_TILE_CELLS;
      const cellOffsetY = tileLocalY * GEO_TILE_CELLS;
      const tileBuffer = writeGeoTile(region, cellOffsetX, cellOffsetY);

      const tileX = tileBaseX + tileLocalX;
      const tileY = tileBaseY + tileLocalY;
      await fs.writeFile(path.join(OUT_DIR, `${tileX}_${tileY}.bin`), tileBuffer);
      count++;
    }
  }

  return count;
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  let sourceEntries: string[];
  try {
    sourceEntries = await fs.readdir(SOURCE_DIR);
  } catch {
    console.error(`No geodata source directory found at ${SOURCE_DIR}. Drop real *.l2j region files there first.`);
    process.exitCode = 1;
    return;
  }

  const regionFiles = sourceEntries.filter((name) => REGION_FILE_PATTERN.test(name));
  if (regionFiles.length === 0) {
    console.warn(`No *.l2j region files found in ${SOURCE_DIR}.`);
    return;
  }

  let totalTiles = 0;
  for (const fileName of regionFiles) {
    const match = REGION_FILE_PATTERN.exec(fileName)!;
    const rawRegionX = Number(match[1]);
    const rawRegionY = Number(match[2]);

    console.log(`Converting ${fileName} (region ${rawRegionX}_${rawRegionY})...`);
    totalTiles += await convertRegionFile(path.join(SOURCE_DIR, fileName), rawRegionX, rawRegionY);
  }

  console.log(`Converted ${regionFiles.length} region(s) into ${totalTiles} tile(s), written to ${OUT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
