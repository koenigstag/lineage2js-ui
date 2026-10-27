import { useEffect, useRef, useState } from "react";
import { getMapHeightmapUrl, getMapQuadsUrl, mapKey } from "../../config/world-assets";
import { parseTerrainQuads, type TerrainQuads } from "./terrain-geometry";
import type { LoadedMapScene } from "./use-map-scenes";

/**
 * Fetches the raw heightmap of every loaded map.
 *
 * Kept separate from the scene files because it is a different shape of data
 * and an order of magnitude larger: 128kB of 16-bit samples against 63kB of
 * JSON. A map's terrain simply does not draw until its heightmap lands.
 */
export interface MapHeightfield {
  heights: Uint16Array;
  /** The per-quad bitmaps, when the map has them. */
  quads: TerrainQuads | null;
}

export function useHeightmaps(scenes: LoadedMapScene[]): Map<string, MapHeightfield> {
  const cacheRef = useRef(new Map<string, MapHeightfield>());
  const inFlightRef = useRef(new Set<string>());
  const [, forceRender] = useState(0);

  const keys = scenes.map(({ mapX, mapY }) => mapKey(mapX, mapY)).join(",");

  useEffect(() => {
    let cancelled = false;
    const cache = cacheRef.current;
    const inFlight = inFlightRef.current;
    const startedThisRun = new Set<string>();
    const wanted = new Set<string>();

    for (const { mapX, mapY, scene } of scenes) {
      const key = mapKey(mapX, mapY);
      wanted.add(key);
      if (!scene.terrain || cache.has(key) || inFlight.has(key)) continue;

      const url = getMapHeightmapUrl(mapX, mapY);
      if (!url) continue;

      inFlight.add(key);
      startedThisRun.add(key);
      const quadsUrl = getMapQuadsUrl(mapX, mapY);
      Promise.all([
        fetch(url).then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(new Error(`${res.status} ${url}`)))),
        // The bitmaps are optional: a map baked before they existed simply
        // draws every quad, which is what it did anyway.
        quadsUrl
          ? fetch(quadsUrl)
              .then((res) => (res.ok ? res.arrayBuffer() : null))
              .catch(() => null)
          : Promise.resolve(null),
      ])
        .then(([heightBuffer, quadBuffer]) => {
          if (cancelled) return;
          const heights = new Uint16Array(heightBuffer);
          const { width, height } = scene.terrain!.heightmap;
          cache.set(key, {
            heights,
            quads: quadBuffer ? parseTerrainQuads(quadBuffer, width, height) : null,
          });
          forceRender((n) => n + 1);
        })
        .catch(() => {
          // Most of the grid has no map at all; a miss is ordinary.
        })
        .finally(() => {
          inFlight.delete(key);
        });
    }

    // A heightmap outlives nothing -- when its map is evicted, so is it.
    let evicted = false;
    for (const key of cache.keys()) {
      if (!wanted.has(key)) {
        cache.delete(key);
        evicted = true;
      }
    }
    if (evicted) forceRender((n) => n + 1);

    return () => {
      cancelled = true;
      for (const key of startedThisRun) inFlight.delete(key);
    };
    // scenes is rebuilt on every render of the owner; the keys are what
    // actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys]);

  return cacheRef.current;
}
