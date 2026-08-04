import { useEffect, useRef, useState } from "react";
import { GEO_REGION_SIZE, GEO_TILE_CELLS, GEO_TILE_SIZE, getGeodataRegionUrl } from "../../config/geodata";
import { parseL2jRegion } from "./l2j-region-parser";
import { sliceGeoTile } from "./slice-geo-tile";
import { tileKey, worldToTileCoords } from "./world-to-tile";
import { regionKey } from "./world-to-region";
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
  /** Decoded regions farther than this (in region units) from the center region are dropped from the cache. */
  keepRegionRadius?: number;
}

/** How many of the frontend's streaming tiles fit along one region side -- both are whole L2 geodata units, so this is always exact. */
const TILES_PER_REGION_SIDE = GEO_REGION_SIZE / GEO_TILE_SIZE;

function tileToRegionCoords(tileX: number, tileY: number): [regionX: number, regionY: number] {
  return [Math.floor(tileX / TILES_PER_REGION_SIDE), Math.floor(tileY / TILES_PER_REGION_SIDE)];
}

/**
 * Loads and caches geodata tiles around a moving world position: fetches
 * newly-needed neighbors as the position crosses into a new tile, and evicts
 * tiles that fall out of range so memory stays bounded.
 *
 * There's no per-tile file on the wire -- the server only has raw .l2j
 * region files (one region = TILES_PER_REGION_SIDE^2 tiles). A whole
 * region is fetched and decoded once (and cached, since a player usually
 * stays within one for a while), then every tile inside it is cut out of
 * that decoded region in memory (see slice-geo-tile.ts) -- no server-side
 * re-encoding step, no bespoke tile format on disk.
 */
export function useGeoTiles(worldX: number, worldY: number, options: UseGeoTilesOptions = {}): LoadedGeoTile[] {
  const { loadRadius = 1, keepRadius = 2, keepRegionRadius = 1 } = options;
  const tileCacheRef = useRef(new Map<string, GeoTile>());
  const regionCacheRef = useRef(new Map<string, GeoTile>());
  const regionInFlightRef = useRef(new Set<string>());
  const [, forceRender] = useState(0);

  const [centerTileX, centerTileY] = worldToTileCoords(worldX, worldY);

  useEffect(() => {
    let cancelled = false;
    const tileCache = tileCacheRef.current;
    const regionCache = regionCacheRef.current;
    const regionInFlight = regionInFlightRef.current;

    // Cuts out every currently-wanted tile that belongs to this region --
    // one region fetch typically satisfies several (often all) of the
    // tiles in the load ring at once.
    function sliceTilesFromRegion(regionX: number, regionY: number, region: GeoTile): void {
      let sliced = false;
      for (let dy = -loadRadius; dy <= loadRadius; dy++) {
        for (let dx = -loadRadius; dx <= loadRadius; dx++) {
          const tileX = centerTileX + dx;
          const tileY = centerTileY + dy;
          const key = tileKey(tileX, tileY);
          if (tileCache.has(key)) {
            continue;
          }

          const [ownerX, ownerY] = tileToRegionCoords(tileX, tileY);
          if (ownerX !== regionX || ownerY !== regionY) {
            continue;
          }

          const cellOffsetX = (tileX - regionX * TILES_PER_REGION_SIDE) * GEO_TILE_CELLS;
          const cellOffsetY = (tileY - regionY * TILES_PER_REGION_SIDE) * GEO_TILE_CELLS;
          tileCache.set(key, sliceGeoTile(region, cellOffsetX, cellOffsetY));
          sliced = true;
        }
      }
      if (sliced) {
        forceRender((n) => n + 1);
      }
    }

    for (let dy = -loadRadius; dy <= loadRadius; dy++) {
      for (let dx = -loadRadius; dx <= loadRadius; dx++) {
        const tileX = centerTileX + dx;
        const tileY = centerTileY + dy;
        if (tileCache.has(tileKey(tileX, tileY))) {
          continue;
        }

        const [regionX, regionY] = tileToRegionCoords(tileX, tileY);
        const rKey = regionKey(regionX, regionY);

        const cachedRegion = regionCache.get(rKey);
        if (cachedRegion) {
          sliceTilesFromRegion(regionX, regionY, cachedRegion);
          continue;
        }

        if (regionInFlight.has(rKey)) {
          continue;
        }

        const url = getGeodataRegionUrl(regionX, regionY);
        if (!url) {
          continue;
        }

        regionInFlight.add(rKey);
        fetch(url)
          .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(new Error(`${res.status} ${url}`))))
          .then((buffer) => {
            if (cancelled) return;
            const region = parseL2jRegion(buffer);
            regionCache.set(rKey, region);
            sliceTilesFromRegion(regionX, regionY, region);
          })
          .catch((error: unknown) => {
            console.warn(`[geodata] failed to load region ${rKey}`, error);
          })
          .finally(() => {
            regionInFlight.delete(rKey);
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

    const [centerRegionX, centerRegionY] = tileToRegionCoords(centerTileX, centerTileY);
    for (const key of regionCache.keys()) {
      const [rx, ry] = key.split("_").map(Number);
      if (Math.abs(rx - centerRegionX) > keepRegionRadius || Math.abs(ry - centerRegionY) > keepRegionRadius) {
        regionCache.delete(key);
      }
    }

    return () => {
      cancelled = true;
    };
  }, [centerTileX, centerTileY, loadRadius, keepRadius, keepRegionRadius]);

  const loaded: LoadedGeoTile[] = [];
  for (const [key, tile] of tileCacheRef.current) {
    const [tileX, tileY] = key.split("_").map(Number);
    loaded.push({ tileX, tileY, tile });
  }
  return loaded;
}
