import { useMemo } from "react";
import * as THREE from "three";
import { GEO_CELL_SIZE, GEO_TILE_SIZE } from "../../../../config/geodata";
import type { GeoTile } from "../../../../utils/geodata/geo-tile.types";

interface GeoTerrainTileProps {
  tileX: number;
  tileY: number;
  tile: GeoTile;
}

/**
 * Wireframe mesh for one geodata tile. L2's (x, y) horizontal / z-height
 * axes map to three.js's (x, z) horizontal / y-up, so tile.heights (L2 Z)
 * become the mesh's Y coordinate.
 */
export function GeoTerrainTile({ tileX, tileY, tile }: GeoTerrainTileProps) {
  const geometry = useMemo(() => {
    const { cellsX, cellsY, heights } = tile;
    const geo = new THREE.BufferGeometry();

    const positions = new Float32Array(cellsX * cellsY * 3);
    for (let y = 0; y < cellsY; y++) {
      for (let x = 0; x < cellsX; x++) {
        const i = y * cellsX + x;
        positions[i * 3] = x * GEO_CELL_SIZE;
        positions[i * 3 + 1] = heights[i];
        positions[i * 3 + 2] = y * GEO_CELL_SIZE;
      }
    }

    const indices: number[] = [];
    for (let y = 0; y < cellsY - 1; y++) {
      for (let x = 0; x < cellsX - 1; x++) {
        const a = y * cellsX + x;
        const b = a + 1;
        const c = a + cellsX;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }

    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    return geo;
  }, [tile]);

  return (
    <mesh position={[tileX * GEO_TILE_SIZE, 0, tileY * GEO_TILE_SIZE]} geometry={geometry}>
      <meshBasicMaterial color="#3fae63" wireframe />
    </mesh>
  );
}
