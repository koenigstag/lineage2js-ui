import { useEffect, useRef, useState } from "react";
import { getMapSceneUrl, mapKey, worldToMapCoords } from "../../config/world-assets";
import type { MapScene } from "./map-scene.types";

export interface LoadedMapScene {
  mapX: number;
  mapY: number;
  scene: MapScene;
}

interface UseMapScenesOptions {
  /** Ring of maps fetched around the one the player is in (1 = 3x3). */
  loadRadius?: number;
  /** Maps farther than this are dropped. Should be >= loadRadius. */
  keepRadius?: number;
}

/**
 * Streams baked map scenes around a moving world position.
 *
 * The unit is a whole `.unr` map -- 32768 world units, the same span as a
 * geodata region -- and not the geodata tile, which is 32 times smaller. That
 * is deliberate, for two reasons:
 *
 * - **Ownership.** A static mesh is a single object with a single transform
 *   and cannot be split at a chunk border, and measured across three real
 *   maps, 39% of actors straddle a 1024-unit boundary while the largest single
 *   mesh spans 14 of them. On the map grid the question does not arise: the
 *   client authored every actor inside exactly one map. This is also what the
 *   retail client and the reference renderer both do.
 * - **Range.** Geodata is needed at walking distance, for collision and
 *   pathing. Scenery is needed at viewing distance. Sharing one grid would tie
 *   two things with different lifetimes together.
 *
 * Mirrors useGeoTiles' structure otherwise, including its StrictMode
 * in-flight handling -- see the comment there for why that is needed.
 */
export function useMapScenes(worldX: number, worldY: number, options: UseMapScenesOptions = {}): LoadedMapScene[] {
  const { loadRadius = 1, keepRadius = 2 } = options;
  const cacheRef = useRef(new Map<string, MapScene>());
  const inFlightRef = useRef(new Set<string>());
  const [, forceRender] = useState(0);

  const [centerMapX, centerMapY] = worldToMapCoords(worldX, worldY);

  useEffect(() => {
    let cancelled = false;
    const cache = cacheRef.current;
    const inFlight = inFlightRef.current;
    const startedThisRun = new Set<string>();

    for (let dy = -loadRadius; dy <= loadRadius; dy++) {
      for (let dx = -loadRadius; dx <= loadRadius; dx++) {
        const mapX = centerMapX + dx;
        const mapY = centerMapY + dy;
        const key = mapKey(mapX, mapY);

        if (cache.has(key) || inFlight.has(key)) continue;

        const url = getMapSceneUrl(mapX, mapY);
        if (!url) continue;

        inFlight.add(key);
        startedThisRun.add(key);
        fetch(url)
          .then((res) => (res.ok ? (res.json() as Promise<MapScene>) : Promise.reject(new Error(`${res.status} ${url}`))))
          .then((scene) => {
            if (cancelled) return;
            cache.set(key, scene);
            forceRender((n) => n + 1);
          })
          .catch((error: unknown) => {
            // Most of the world has no map file at all -- the client ships 203
            // of a possible 32x32 grid -- so a miss here is ordinary.
            console.debug(`[world] no map scene ${key}`, error);
          })
          .finally(() => {
            inFlight.delete(key);
          });
      }
    }

    let evicted = false;
    for (const key of cache.keys()) {
      const [mx, my] = key.split("_").map(Number);
      if (Math.abs(mx - centerMapX) > keepRadius || Math.abs(my - centerMapY) > keepRadius) {
        cache.delete(key);
        evicted = true;
      }
    }
    if (evicted) forceRender((n) => n + 1);

    return () => {
      cancelled = true;
      for (const key of startedThisRun) inFlight.delete(key);
    };
  }, [centerMapX, centerMapY, loadRadius, keepRadius]);

  const loaded: LoadedMapScene[] = [];
  for (const [key, scene] of cacheRef.current) {
    const [mapX, mapY] = key.split("_").map(Number);
    loaded.push({ mapX, mapY, scene });
  }
  return loaded;
}
