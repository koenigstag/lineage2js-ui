import { useEffect, useRef, useState } from "react";
import { getGeodataTileUrl } from "../../config/geodata";
import { parseGeoTile } from "./geo-tile-parser";
import { publishGeoTiles, registerGeoTileSource, releaseGeoTileSource } from "./geo-tile-index";
import { tileKey, worldToTileCoords } from "./world-to-tile";
import type { GeoTile } from "./geo-tile.types";

export interface LoadedGeoTile {
  tileX: number;
  tileY: number;
  tile: GeoTile;
}

interface UseGeoTilesOptions {
  /** Ring of tiles fetched around the center tile (1 = 3x3, 2 = 5x5). */
  loadRadius?: number;
  /** Tiles farther than this (in tile units) from the center are dropped from the cache. Should be >= loadRadius. */
  keepRadius?: number;
}

/**
 * Loads and caches geodata tiles around a moving world position: fetches
 * newly-needed neighbors as the position crosses into a new tile, and evicts
 * tiles that fall out of range so memory stays bounded.
 *
 * Every tile is a small pre-baked file (see
 * packages/assets-server/scripts/convert-l2j-geodata.ts), not a raw .l2j
 * region -- the expensive decode (CSR multilayer construction from the
 * community .l2j block/cell layout) happens once, offline, not on every
 * player's device on every load. geo-tile-parser.ts's deserialize is a
 * straight read, no recomputation.
 *
 * Also mirrors whatever it currently holds into geo-tile-index.ts, so the
 * consumers that live outside the React tree (movement validation in
 * GameStore, creature-movement's gravity) can read the same tiles without a
 * loader of their own -- see that module for why it's a union across
 * instances rather than one shared cache.
 */
export function useGeoTiles(worldX: number, worldY: number, options: UseGeoTilesOptions = {}): LoadedGeoTile[] {
  const { loadRadius = 1, keepRadius = 2 } = options;
  const tileCacheRef = useRef(new Map<string, GeoTile>());
  const tileInFlightRef = useRef(new Set<string>());
  const sourceIdRef = useRef<number>();
  sourceIdRef.current ??= registerGeoTileSource();
  const sourceId = sourceIdRef.current;
  const [, forceRender] = useState(0);

  const [centerTileX, centerTileY] = worldToTileCoords(worldX, worldY);

  useEffect(() => {
    let cancelled = false;
    const tileCache = tileCacheRef.current;
    const tileInFlight = tileInFlightRef.current;
    // Keys *this* effect invocation added to tileInFlight (which itself
    // lives in a ref and survives past this invocation's cleanup). Needed
    // because React 18 StrictMode runs an effect, cleans it up, then runs it
    // again immediately, before any fetch has had a chance to settle -- if
    // the first invocation's still-pending fetch is left in tileInFlight,
    // the second (real) invocation sees "already in flight" and skips
    // re-fetching, while the first invocation's own result gets discarded
    // by its own `cancelled` check once it does resolve. Net effect without
    // this: geodata never loads at all in dev. Evicting this invocation's
    // own entries on cleanup (only if still pending) lets the next
    // invocation start a fresh fetch instead of waiting on a dead one.
    const startedThisRun = new Set<string>();

    for (let dy = -loadRadius; dy <= loadRadius; dy++) {
      for (let dx = -loadRadius; dx <= loadRadius; dx++) {
        const tileX = centerTileX + dx;
        const tileY = centerTileY + dy;
        const key = tileKey(tileX, tileY);

        if (tileCache.has(key) || tileInFlight.has(key)) {
          continue;
        }

        const url = getGeodataTileUrl(tileX, tileY);
        if (!url) {
          continue;
        }

        tileInFlight.add(key);
        startedThisRun.add(key);
        fetch(url)
          .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(new Error(`${res.status} ${url}`))))
          .then((buffer) => {
            if (cancelled) return;
            tileCache.set(key, parseGeoTile(buffer));
            forceRender((n) => n + 1);
          })
          .catch((error: unknown) => {
            console.warn(`[geodata] failed to load tile ${key}`, error);
          })
          .finally(() => {
            tileInFlight.delete(key);
          });
      }
    }

    let evicted = false;
    for (const key of tileCache.keys()) {
      const [tx, ty] = key.split("_").map(Number);
      if (Math.abs(tx - centerTileX) > keepRadius || Math.abs(ty - centerTileY) > keepRadius) {
        tileCache.delete(key);
        evicted = true;
      }
    }
    if (evicted) {
      forceRender((n) => n + 1);
    }

    return () => {
      cancelled = true;
      for (const key of startedThisRun) {
        tileInFlight.delete(key);
      }
    };
  }, [centerTileX, centerTileY, loadRadius, keepRadius]);

  const loaded: LoadedGeoTile[] = [];
  for (const [key, tile] of tileCacheRef.current) {
    const [tileX, tileY] = key.split("_").map(Number);
    loaded.push({ tileX, tileY, tile });
  }

  // Republished after every render (the set changes as fetches land and
  // eviction runs, neither of which has a dependency this could key on), and
  // dropped on unmount so a dead instance's tiles don't linger in the union.
  useEffect(() => {
    publishGeoTiles(sourceId, loaded);
  });
  useEffect(() => () => releaseGeoTileSource(sourceId), [sourceId]);

  return loaded;
}
