import { GEO_CELL_SIZE, GEO_TILE_CELLS, GEO_TILE_SIZE } from "../../config/geodata";
import { tileKey, worldToTileCoords } from "./world-to-tile";
import type { LoadedGeoTile } from "./use-geo-tiles";

/** Nearest-cell height (L2 Z) at a world (x, y), or null if that tile isn't loaded yet. */
export function heightAtWorld(tiles: LoadedGeoTile[], worldX: number, worldY: number): number | null {
  const [tileX, tileY] = worldToTileCoords(worldX, worldY);
  const key = tileKey(tileX, tileY);
  const loaded = tiles.find((t) => tileKey(t.tileX, t.tileY) === key);
  if (!loaded) {
    return null;
  }

  const localX = clampCell((worldX - tileX * GEO_TILE_SIZE) / GEO_CELL_SIZE);
  const localY = clampCell((worldY - tileY * GEO_TILE_SIZE) / GEO_CELL_SIZE);

  return loaded.tile.heights[localY * loaded.tile.cellsX + localX];
}

function clampCell(cell: number): number {
  return Math.min(GEO_TILE_CELLS - 1, Math.max(0, Math.floor(cell)));
}
