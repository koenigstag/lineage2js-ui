import type { MutableRefObject } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import type { LoadedGeoTile } from "../../../../utils/geodata/use-geo-tiles";
import { tileKey } from "../../../../utils/geodata/world-to-tile";
import { GeoTerrainTile } from "./geo-terrain-tile.component";

interface GeoTerrainFieldProps {
  tiles: LoadedGeoTile[];
  onGroundClick?: (event: ThreeEvent<MouseEvent>) => void;
  /** See GeoTerrainTile's own doc comment -- lets a touch tap tell itself apart from a camera-orbit drag. */
  orbitDragActiveRef?: MutableRefObject<boolean>;
}

/**
 * Renders a set of loaded geodata tiles as wireframe meshes.
 *
 * Each tile also gets whichever of its 8 neighbors are currently loaded, so
 * the corner welding in computeCornerHeights can reach across the tile seam
 * -- the outermost cells would otherwise average over their in-tile
 * neighbors alone and leave a step along every tile border. A tile's mesh
 * is rebuilt when a neighbor arrives or is evicted (see GeoTerrainTile's
 * memo), which is exactly when its border corners can change.
 */
export function GeoTerrainField({ tiles, onGroundClick, orbitDragActiveRef }: GeoTerrainFieldProps) {
  const tilesByKey = new Map(tiles.map(({ tileX, tileY, tile }) => [tileKey(tileX, tileY), tile]));

  return (
    <>
      {tiles.map(({ tileX, tileY, tile }) => (
        <GeoTerrainTile
          key={tileKey(tileX, tileY)}
          tileX={tileX}
          tileY={tileY}
          tile={tile}
          neighbors={{
            north: tilesByKey.get(tileKey(tileX, tileY - 1)),
            south: tilesByKey.get(tileKey(tileX, tileY + 1)),
            west: tilesByKey.get(tileKey(tileX - 1, tileY)),
            east: tilesByKey.get(tileKey(tileX + 1, tileY)),
            northWest: tilesByKey.get(tileKey(tileX - 1, tileY - 1)),
            northEast: tilesByKey.get(tileKey(tileX + 1, tileY - 1)),
            southWest: tilesByKey.get(tileKey(tileX - 1, tileY + 1)),
            southEast: tilesByKey.get(tileKey(tileX + 1, tileY + 1)),
          }}
          onGroundClick={onGroundClick}
          orbitDragActiveRef={orbitDragActiveRef}
        />
      ))}
    </>
  );
}
