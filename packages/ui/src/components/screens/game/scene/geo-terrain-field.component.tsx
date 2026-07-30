import type { LoadedGeoTile } from "../../../../utils/geodata/use-geo-tiles";
import { GeoTerrainTile } from "./geo-terrain-tile.component";

interface GeoTerrainFieldProps {
  tiles: LoadedGeoTile[];
}

/** Renders a set of loaded geodata tiles as wireframe meshes. */
export function GeoTerrainField({ tiles }: GeoTerrainFieldProps) {
  return (
    <>
      {tiles.map(({ tileX, tileY, tile }) => (
        <GeoTerrainTile key={`${tileX}_${tileY}`} tileX={tileX} tileY={tileY} tile={tile} />
      ))}
    </>
  );
}
