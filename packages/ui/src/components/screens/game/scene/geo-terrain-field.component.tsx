import { useGeoTiles } from "../../../../utils/geodata/use-geo-tiles";
import { GeoTerrainTile } from "./geo-terrain-tile.component";

interface GeoTerrainFieldProps {
  worldX: number;
  worldY: number;
}

/** Renders the geodata tiles currently loaded around a world position as wireframe meshes. */
export function GeoTerrainField({ worldX, worldY }: GeoTerrainFieldProps) {
  const tiles = useGeoTiles(worldX, worldY);

  return (
    <>
      {tiles.map(({ tileX, tileY, tile }) => (
        <GeoTerrainTile key={`${tileX}_${tileY}`} tileX={tileX} tileY={tileY} tile={tile} />
      ))}
    </>
  );
}
