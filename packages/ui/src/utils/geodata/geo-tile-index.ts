import { tileKey } from "./world-to-tile";
import type { LoadedGeoTile } from "./use-geo-tiles";

/**
 * Process-wide view of every geodata tile any live useGeoTiles instance
 * currently holds.
 *
 * useGeoTiles is a hook, and its cache lives in a ref -- fine for the
 * components that render terrain, useless for the consumers that also need
 * geodata but sit outside the React tree entirely: GameStore (which vets a
 * move order before the packet leaves) and creature-movement's gravity
 * (which runs per creature per frame). Rather than thread tiles through the
 * store or mount a third loader, each hook instance publishes its own loaded
 * set here and the union is readable from anywhere.
 *
 * A union, not a single cache, because the instances are independent and
 * don't agree on a centre (the radar debug panel follows the server-reported
 * player, the scene falls back to the local test character) -- one evicting a
 * tile must not yank it out from under another that still holds it.
 */
const sources = new Map<number, LoadedGeoTile[]>();
let nextSourceId = 1;
/** Union of every source, rebuilt lazily -- publishGeoTiles runs per render, reads run per frame. */
let mergedTiles: LoadedGeoTile[] | null = null;

/** Claims an id for one publisher (one useGeoTiles instance). */
export function registerGeoTileSource(): number {
  return nextSourceId++;
}

export function publishGeoTiles(sourceId: number, tiles: LoadedGeoTile[]): void {
  // useGeoTiles rebuilds its return array every render but the GeoTile objects
  // in it are stable, so the common case is "same tiles, new array" -- taking
  // that as a change would throw away the merged union (rebuilt on the next
  // read, which happens per creature per frame) for nothing.
  if (isSameTileSet(sources.get(sourceId), tiles)) {
    sources.set(sourceId, tiles);
    return;
  }
  sources.set(sourceId, tiles);
  mergedTiles = null;
}

function isSameTileSet(previous: LoadedGeoTile[] | undefined, next: LoadedGeoTile[]): boolean {
  if (!previous || previous.length !== next.length) {
    return false;
  }
  return previous.every((tile, i) => tile.tile === next[i].tile && tile.tileX === next[i].tileX && tile.tileY === next[i].tileY);
}

export function releaseGeoTileSource(sourceId: number): void {
  sources.delete(sourceId);
  mergedTiles = null;
}

/** Every distinct tile currently loaded anywhere in the app. Empty when nothing has loaded (or geodata isn't configured). */
export function loadedGeoTiles(): LoadedGeoTile[] {
  if (!mergedTiles) {
    const byKey = new Map<string, LoadedGeoTile>();
    for (const tiles of sources.values()) {
      for (const tile of tiles) {
        byKey.set(tileKey(tile.tileX, tile.tileY), tile);
      }
    }
    mergedTiles = Array.from(byKey.values());
  }
  return mergedTiles;
}
