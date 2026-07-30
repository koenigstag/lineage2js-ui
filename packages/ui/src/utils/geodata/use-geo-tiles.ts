import { useEffect, useRef, useState } from "react";
import { getGeodataTileUrl } from "../../config/geodata";
import { parseGeoTile } from "./geo-tile-parser";
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
 */
export function useGeoTiles(worldX: number, worldY: number, options: UseGeoTilesOptions = {}): LoadedGeoTile[] {
  const { loadRadius = 1, keepRadius = 2 } = options;
  const cacheRef = useRef(new Map<string, GeoTile>());
  const inFlightRef = useRef(new Set<string>());
  const [, forceRender] = useState(0);

  const [centerTileX, centerTileY] = worldToTileCoords(worldX, worldY);

  useEffect(() => {
    let cancelled = false;
    const cache = cacheRef.current;
    const inFlight = inFlightRef.current;

    for (let dy = -loadRadius; dy <= loadRadius; dy++) {
      for (let dx = -loadRadius; dx <= loadRadius; dx++) {
        const tileX = centerTileX + dx;
        const tileY = centerTileY + dy;
        const key = tileKey(tileX, tileY);

        if (cache.has(key) || inFlight.has(key)) {
          continue;
        }

        const url = getGeodataTileUrl(tileX, tileY);
        if (!url) {
          continue;
        }

        inFlight.add(key);
        fetch(url)
          .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(new Error(`${res.status} ${url}`))))
          .then((buffer) => {
            if (cancelled) return;
            cache.set(key, parseGeoTile(buffer));
            forceRender((n) => n + 1);
          })
          .catch((error: unknown) => {
            console.warn(`[geodata] failed to load tile ${key}`, error);
          })
          .finally(() => {
            inFlight.delete(key);
          });
      }
    }

    let evicted = false;
    for (const key of cache.keys()) {
      const [tx, ty] = key.split("_").map(Number);
      if (Math.abs(tx - centerTileX) > keepRadius || Math.abs(ty - centerTileY) > keepRadius) {
        cache.delete(key);
        evicted = true;
      }
    }
    if (evicted) {
      forceRender((n) => n + 1);
    }

    return () => {
      cancelled = true;
    };
  }, [centerTileX, centerTileY, loadRadius, keepRadius]);

  const loaded: LoadedGeoTile[] = [];
  for (const [key, tile] of cacheRef.current) {
    const [tileX, tileY] = key.split("_").map(Number);
    loaded.push({ tileX, tileY, tile });
  }
  return loaded;
}
