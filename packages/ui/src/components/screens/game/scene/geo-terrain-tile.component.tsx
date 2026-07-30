import { useMemo } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import { GEO_CELL_SIZE, GEO_TILE_SIZE } from "../../../../config/geodata";
import { l2ToThree } from "../../../../utils/coords";
import type { GeoTile } from "../../../../utils/geodata/geo-tile.types";

interface GeoTerrainTileProps {
  tileX: number;
  tileY: number;
  tile: GeoTile;
  /** Left-click on the terrain surface -- fired with the raycast hit point (three.js space). */
  onGroundClick?: (event: ThreeEvent<MouseEvent>) => void;
}

/** Wireframe mesh for one geodata tile, converted from L2 world space to three.js via utils/coords. */
export function GeoTerrainTile({ tileX, tileY, tile, onGroundClick }: GeoTerrainTileProps) {
  const geometry = useMemo(() => {
    const { cellsX, cellsY, heights } = tile;
    const geo = new THREE.BufferGeometry();

    const positions = new Float32Array(cellsX * cellsY * 3);
    const v = new THREE.Vector3();
    for (let y = 0; y < cellsY; y++) {
      for (let x = 0; x < cellsX; x++) {
        const i = y * cellsX + x;
        const l2X = tileX * GEO_TILE_SIZE + x * GEO_CELL_SIZE;
        const l2Y = tileY * GEO_TILE_SIZE + y * GEO_CELL_SIZE;
        l2ToThree(l2X, l2Y, heights[i], v);
        positions[i * 3] = v.x;
        positions[i * 3 + 1] = v.y;
        positions[i * 3 + 2] = v.z;
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
  }, [tileX, tileY, tile]);

  return (
    <mesh
      geometry={geometry}
      onClick={
        onGroundClick &&
        ((event) => {
          event.stopPropagation();
          onGroundClick(event);
        })
      }
    >
      <meshBasicMaterial color="#3fae63" wireframe />
    </mesh>
  );
}
