import type { MutableRefObject } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import type { LoadedGeoTile } from "../../../../utils/geodata/use-geo-tiles";
import { GeoTerrainTile } from "./geo-terrain-tile.component";

interface GeoTerrainFieldProps {
  tiles: LoadedGeoTile[];
  onGroundClick?: (event: ThreeEvent<MouseEvent>) => void;
  /** See GeoTerrainTile's own doc comment -- lets a touch tap tell itself apart from a camera-orbit drag. */
  orbitDragActiveRef?: MutableRefObject<boolean>;
}

/** Renders a set of loaded geodata tiles as wireframe meshes. */
export function GeoTerrainField({ tiles, onGroundClick, orbitDragActiveRef }: GeoTerrainFieldProps) {
  return (
    <>
      {tiles.map(({ tileX, tileY, tile }) => (
        <GeoTerrainTile
          key={`${tileX}_${tileY}`}
          tileX={tileX}
          tileY={tileY}
          tile={tile}
          onGroundClick={onGroundClick}
          orbitDragActiveRef={orbitDragActiveRef}
        />
      ))}
    </>
  );
}
