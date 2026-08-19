import type { ThreeEvent } from "@react-three/fiber";
import type { LoadedGeoTile } from "../../../../utils/geodata/use-geo-tiles";
import { GeoTerrainTile } from "./geo-terrain-tile.component";

interface GeoTerrainFieldProps {
  tiles: LoadedGeoTile[];
  onGroundClick?: (event: ThreeEvent<MouseEvent>) => void;
}

/** Renders a set of loaded geodata tiles as wireframe meshes. */
export function GeoTerrainField({ tiles, onGroundClick }: GeoTerrainFieldProps) {
  return (
    <>
      {tiles.map(({ tileX, tileY, tile }) => (
        <GeoTerrainTile key={`${tileX}_${tileY}`} tileX={tileX} tileY={tileY} tile={tile} onGroundClick={onGroundClick} />
      ))}
    </>
  );
}
